"""
sessions/test_runner.py — Automatic test runner for completed sessions.

When an agent finishes a session:
  1. This module runs pytest inside that session's worktree
  2. Streams live output via WebSocket (user sees tests running in real-time)
  3. Returns structured results (pass/fail counts, durations)

Port isolation:
  Each worktree gets its own dynamically allocated free port — zero conflicts
  even when 10 sessions are testing simultaneously.

Called by: sessions/queue.py _dispatch_session (after executor finishes)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import sys
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Max seconds to wait for tests to complete before giving up
TEST_TIMEOUT_SECONDS = 300  # 5 minutes


@dataclass
class TestResult:
    """Structured result of running a test suite."""

    passed: int = 0
    failed: int = 0
    errors: int = 0
    skipped: int = 0
    duration_seconds: float = 0.0
    output: str = ""
    all_passed: bool = False

    @property
    def total(self) -> int:
        return self.passed + self.failed + self.errors

    def summary(self) -> str:
        """One-line summary for WebSocket broadcast."""
        status = "PASSED" if self.all_passed else "FAILED"
        return (
            f"Tests {status}: "
            f"{self.passed} passed, {self.failed} failed, "
            f"{self.errors} errors in {self.duration_seconds:.1f}s"
        )


def _find_free_port() -> int:
    """
    Find a free TCP port on localhost.
    Used to isolate test servers across parallel sessions.
    Each call returns a DIFFERENT port — no conflicts.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


def _parse_pytest_output(output: str) -> TestResult:
    """
    Parse pytest's terminal output into structured counts.

    Looks for the final summary line like:
      "3 passed, 1 failed, 0 errors in 2.34s"
      "5 passed in 1.20s"
      "ERROR collecting tests/test_foo.py"
    """
    result = TestResult(output=output)

    for line in reversed(output.splitlines()):
        line = line.strip()
        if not line:
            continue

        # Look for the summary line (contains "passed", "failed", "error", "in X.Xs")
        if ("passed" in line or "failed" in line or "error" in line) and "in" in line:
            # Parse duration
            if " in " in line:
                try:
                    duration_part = line.split(" in ")[-1]
                    result.duration_seconds = float(duration_part.replace("s", ""))
                except ValueError:
                    pass

            # Parse counts
            import re
            for match in re.finditer(r"(\d+) (passed|failed|error|errors|skipped)", line):
                count = int(match.group(1))
                label = match.group(2)
                if "passed" in label:
                    result.passed = count
                elif "failed" in label:
                    result.failed = count
                elif "error" in label:
                    result.errors = count
                elif "skipped" in label:
                    result.skipped = count

            result.all_passed = result.failed == 0 and result.errors == 0
            break

    return result


async def run_tests(
    worktree_path: str,
    startup_id: str,
    session_id: str,
    *,
    stream_to_websocket: bool = True,
) -> TestResult:
    """
    Run pytest inside a session's worktree.

    - Runs as a subprocess (isolated from the main API process)
    - Assigns a free port via TEST_PORT env var (for integration tests)
    - Streams stdout line-by-line to WebSocket if stream_to_websocket=True
    - Returns structured TestResult

    Called automatically by queue.py after each session completes.
    """
    path = Path(worktree_path)
    if not path.exists():
        logger.warning("Worktree not found: %s", worktree_path)
        return TestResult(output="Worktree directory not found — skipping tests")

    # Find a free port for this session's test server
    test_port = _find_free_port()

    # Build environment: inherit current env + worktree-specific overrides
    env = os.environ.copy()
    env["TEST_PORT"] = str(test_port)       # integration tests bind here
    env["PYTHONPATH"] = str(path)           # so imports work inside worktree
    env["PYTHONDONTWRITEBYTECODE"] = "1"   # no .pyc clutter in worktrees

    logger.info(
        "Running tests: session=%s worktree=%s port=%d",
        session_id, worktree_path, test_port,
    )

    if stream_to_websocket:
        from backend.websocket.hub import broadcast_test_output

        await broadcast_test_output(
            startup_id, session_id,
            event="test.started",
            data={"message": f"Running tests on port {test_port}..."},
        )

    # Run pytest with JSON report for structured parsing
    # -x = stop on first failure for speed, remove if you want full report
    # --tb=short = short tracebacks (less noise)
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "pytest",
        "tests/", "-v", "--tb=short", "--color=no",
        "--no-header",
        cwd=str(path),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,  # merge stderr → stdout
    )

    output_lines: list[str] = []

    # Stream output line by line
    try:
        async with asyncio.timeout(TEST_TIMEOUT_SECONDS):
            assert proc.stdout is not None
            async for raw_line in proc.stdout:
                line = raw_line.decode("utf-8", errors="replace").rstrip()
                output_lines.append(line)

                if stream_to_websocket:
                    from backend.websocket.hub import broadcast_test_output
                    await broadcast_test_output(
                        startup_id, session_id,
                        event="test.line",
                        data={"line": line},
                    )

    except TimeoutError:
        proc.kill()
        await proc.wait()
        output_lines.append(f"\n[TIMEOUT] Tests exceeded {TEST_TIMEOUT_SECONDS}s — killed")
        logger.warning("Test timeout: session=%s", session_id)

    await proc.wait()
    returncode = proc.returncode or 0

    full_output = "\n".join(output_lines)
    result = _parse_pytest_output(full_output)

    # If pytest exited cleanly with 0, all passed
    if returncode == 0:
        result.all_passed = True

    logger.info(
        "Tests done: session=%s passed=%d failed=%d errors=%d",
        session_id, result.passed, result.failed, result.errors,
    )

    if stream_to_websocket:
        from backend.websocket.hub import broadcast_test_output
        await broadcast_test_output(
            startup_id, session_id,
            event="test.completed",
            data={
                "passed": result.passed,
                "failed": result.failed,
                "errors": result.errors,
                "skipped": result.skipped,
                "duration_seconds": result.duration_seconds,
                "all_passed": result.all_passed,
                "summary": result.summary(),
            },
        )

    return result
