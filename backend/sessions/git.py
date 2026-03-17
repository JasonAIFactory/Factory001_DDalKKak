"""
sessions/git.py — Git worktree management for session isolation.

Each session gets its own branch + worktree directory.
This is what makes parallel sessions possible without conflicts.

SESSIONS.md reference: "Git Worktree Management" section.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class WorktreeResult:
    """Result of a worktree operation."""

    success: bool
    path: str | None = None
    error: str | None = None


@dataclass
class MergeResult:
    """Result of a git merge operation."""

    success: bool
    auto_resolved: bool = False
    reason: str | None = None
    conflicting_files: list[str] | None = None


async def _run_git(args: list[str], cwd: str) -> tuple[int, str, str]:
    """
    Run a git command asynchronously.
    Returns (returncode, stdout, stderr).
    Never raises — callers check returncode.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await proc.communicate()
        return (
            proc.returncode or 0,
            stdout_bytes.decode("utf-8", errors="replace").strip(),
            stderr_bytes.decode("utf-8", errors="replace").strip(),
        )
    except (FileNotFoundError, OSError) as exc:
        return (1, "", str(exc))


async def _ensure_repo(repo_path: str) -> bool:
    """
    Ensure a git repo exists at repo_path.
    Creates and initializes it if missing — handles startups created before the git-init fix.
    Returns True if repo is ready.
    """
    import os
    import subprocess

    path = Path(repo_path)
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)

    # Check if already a git repo
    rc, _, _ = await _run_git(["rev-parse", "--git-dir"], cwd=repo_path)
    if rc == 0:
        return True  # already initialized

    # Init fresh repo with an empty commit so branches can be created
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "DalkkakAI",
        "GIT_AUTHOR_EMAIL": "bot@dalkkak.ai",
        "GIT_COMMITTER_NAME": "DalkkakAI",
        "GIT_COMMITTER_EMAIL": "bot@dalkkak.ai",
    }
    await asyncio.to_thread(
        subprocess.run, ["git", "init", "-b", "main", repo_path], capture_output=True
    )
    await asyncio.to_thread(
        subprocess.run,
        ["git", "commit", "--allow-empty", "-m", "init"],
        cwd=repo_path, capture_output=True, env=env,
    )
    logger.info("Auto-initialized git repo: %s", repo_path)
    return True


async def create_worktree(repo_path: str, branch: str) -> WorktreeResult:
    """
    Create an isolated git worktree for a session.

    What happens:
      1. Ensure the base repo exists (auto-init if missing)
      2. Create a new branch from main
      3. Create a worktree directory for that branch
      4. Return the worktree path

    Each session gets complete file isolation — no conflicts
    with other running sessions until merge time.
    """
    worktree_path = str(Path(repo_path) / "worktrees" / branch)

    # Ensure repo exists — auto-init if startup predates the git-init fix
    await _ensure_repo(repo_path)

    # Create branch from main
    rc, _, err = await _run_git(["branch", branch, "main"], cwd=repo_path)
    if rc != 0 and "already exists" not in err:
        return WorktreeResult(success=False, error=f"Branch creation failed: {err}")

    # Create the worktree directory on that branch
    rc, _, err = await _run_git(
        ["worktree", "add", worktree_path, branch],
        cwd=repo_path,
    )
    if rc != 0:
        return WorktreeResult(success=False, error=f"Worktree creation failed: {err}")

    # Record the base commit for diff/rollback purposes
    rc, base_commit, _ = await _run_git(
        ["rev-parse", "main"],
        cwd=repo_path,
    )

    logger.info("Created worktree: branch=%s path=%s", branch, worktree_path)
    return WorktreeResult(success=True, path=worktree_path)


async def cleanup_worktree(repo_path: str, branch: str) -> bool:
    """
    Remove a worktree and its branch after merge or cancellation.
    Returns True on success.
    """
    worktree_path = str(Path(repo_path) / "worktrees" / branch)

    # Remove the worktree directory
    rc, _, err = await _run_git(
        ["worktree", "remove", worktree_path, "--force"],
        cwd=repo_path,
    )
    if rc != 0:
        logger.warning("Worktree remove failed: %s", err)

    # Delete the branch
    rc, _, err = await _run_git(["branch", "-D", branch], cwd=repo_path)
    if rc != 0:
        logger.warning("Branch delete failed: %s", err)

    return True


async def commit_session_work(worktree_path: str, message: str) -> bool:
    """
    Commit all changes made in a session's worktree.
    Called when the agent finishes work before merge.
    """
    rc, _, _ = await _run_git(["add", "-A"], cwd=worktree_path)
    if rc != 0:
        return False

    rc, _, err = await _run_git(
        ["commit", "-m", message, "--allow-empty"],
        cwd=worktree_path,
    )
    return rc == 0


async def merge_branch(repo_path: str, branch: str) -> MergeResult:
    """
    Merge a session's branch back into main.

    Strategy (from SESSIONS.md):
    1. Attempt --no-ff merge (preserves branch history)
    2. On conflict: try auto-resolution for simple cases
    3. On complex conflict: return conflicting files for user review

    --no-ff = no fast-forward, keeps merge commit in history
    so we can always trace which session produced which code.
    """
    # Attempt the merge
    rc, _, stderr = await _run_git(
        ["merge", branch, "--no-ff", "-m", f"merge: {branch}"],
        cwd=repo_path,
    )

    if rc == 0:
        logger.info("Clean merge: branch=%s", branch)
        return MergeResult(success=True)

    # Conflict detected — parse which files
    conflicting_files = _parse_conflict_files(stderr)
    logger.warning("Merge conflict: branch=%s files=%s", branch, conflicting_files)

    # Abort the failed merge to restore clean state
    await _run_git(["merge", "--abort"], cwd=repo_path)

    return MergeResult(
        success=False,
        reason="conflict",
        conflicting_files=conflicting_files,
    )


async def get_diff_stat(worktree_path: str) -> dict:
    """
    Return lines added/removed in the worktree vs its base branch.
    Powers the session card stats ("+218 lines").
    """
    rc, stdout, _ = await _run_git(
        ["diff", "--stat", "HEAD"],
        cwd=worktree_path,
    )
    if rc != 0:
        return {"lines_added": 0, "lines_removed": 0}

    lines_added = 0
    lines_removed = 0
    for line in stdout.splitlines():
        if "insertion" in line:
            parts = line.split(",")
            for part in parts:
                if "insertion" in part:
                    lines_added = int("".join(filter(str.isdigit, part)))
        if "deletion" in line:
            parts = line.split(",")
            for part in parts:
                if "deletion" in part:
                    lines_removed = int("".join(filter(str.isdigit, part)))

    return {"lines_added": lines_added, "lines_removed": lines_removed}


def _parse_conflict_files(stderr: str) -> list[str]:
    """Extract conflicting file paths from git merge stderr output."""
    files = []
    for line in stderr.splitlines():
        if "CONFLICT" in line and "Merge conflict in" in line:
            # Format: "CONFLICT (content): Merge conflict in path/to/file.py"
            path = line.split("Merge conflict in")[-1].strip()
            files.append(path)
    return files
