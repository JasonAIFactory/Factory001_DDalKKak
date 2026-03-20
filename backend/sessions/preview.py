"""
sessions/preview.py — Auto-preview deployment for completed sessions.

When a session's tests pass:
  1. Spin up a Docker container for that session's worktree
  2. Give it a free port (no conflicts with other sessions)
  3. Give it its own isolated DB schema (no conflicts with other previews)
  4. Broadcast the preview URL via WebSocket
  5. User clicks the URL → sees their actual running startup

This is why you never install PostgreSQL manually.
Everything runs in Docker containers managed by this module.

Called by: sessions/queue.py after test_runner passes
"""

from __future__ import annotations

import asyncio
import logging
import socket
import uuid
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# How long to wait for a preview container to become healthy
PREVIEW_STARTUP_TIMEOUT = 60  # seconds

# Track running previews: session_id → container_name
_running_previews: dict[str, str] = {}


@dataclass
class PreviewResult:
    """Result of launching a preview environment."""

    success: bool
    url: str | None = None
    port: int | None = None
    container_name: str | None = None
    error: str | None = None


def _find_free_port() -> int:
    """Return a free TCP port. Each call = different port = no conflicts."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


async def _run(cmd: list[str], cwd: str | None = None) -> tuple[int, str, str]:
    """Run a shell command asynchronously. Returns (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout_b, stderr_b = await proc.communicate()
    return (
        proc.returncode or 0,
        stdout_b.decode("utf-8", errors="replace").strip(),
        stderr_b.decode("utf-8", errors="replace").strip(),
    )


async def _wait_until_healthy(url: str, timeout: int = PREVIEW_STARTUP_TIMEOUT) -> bool:
    """
    Poll a URL until it responds 200 or timeout expires.
    Used to wait for preview containers to finish starting.
    """
    import httpx

    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient() as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                response = await client.get(url, timeout=2.0)
                if response.status_code < 500:
                    return True
            except Exception:
                pass
            await asyncio.sleep(2)
    return False


async def _create_preview_db_schema(session_id: str) -> str:
    """
    Create an isolated PostgreSQL schema for this preview session.

    Why schemas, not separate databases:
      - All previews share the same running Postgres container
      - Each preview gets schema named `preview_{session_short_id}`
      - Schemas are instant to create, zero overhead
      - Zero port conflicts — one Postgres, many schemas

    Returns the DATABASE_URL for this preview's schema.
    """
    from backend.config import settings

    # Short ID to keep schema names readable
    short_id = session_id.replace("-", "")[:12]
    schema_name = f"preview_{short_id}"

    # Connect to Postgres and create the schema
    # Use the existing DATABASE_URL but with schema override
    try:
        import asyncpg

        # Parse connection info from DATABASE_URL
        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(db_url)
        await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
        await conn.close()
        logger.info("Created preview schema: %s", schema_name)
    except Exception as exc:
        logger.warning("Could not create preview schema %s: %s", schema_name, exc)

    # Return a DATABASE_URL that uses this schema
    base_url = settings.DATABASE_URL
    if "?" in base_url:
        return f"{base_url}&options=-csearch_path={schema_name}"
    return f"{base_url}?options=-csearch_path={schema_name}"


async def _detect_startup_type(worktree_path: str) -> str:
    """
    Detect what kind of app is in the worktree.

    Returns one of:
      'fastapi'   — Python FastAPI app
      'nextjs'    — Next.js app
      'fullstack' — Both FastAPI backend + Next.js frontend
      'unknown'   — Can't detect, use generic runner
    """
    path = Path(worktree_path)
    has_main_py = (path / "main.py").exists() or (path / "backend" / "main.py").exists()
    has_package_json = (path / "package.json").exists() or (path / "frontend" / "package.json").exists()
    has_next_config = (path / "next.config.js").exists() or (path / "next.config.ts").exists()

    if has_main_py and (has_package_json or has_next_config):
        return "fullstack"
    if has_main_py:
        return "fastapi"
    if has_package_json:
        return "nextjs"
    return "unknown"


async def launch_preview(
    worktree_path: str,
    startup_id: str,
    session_id: str,
) -> PreviewResult:
    """
    Launch an isolated preview environment for a completed session.

    Steps:
      1. Detect app type (FastAPI / Next.js / fullstack)
      2. Create isolated DB schema for this preview
      3. Find free port (no conflicts)
      4. Start Docker container pointed at worktree
      5. Wait until healthy
      6. Broadcast preview URL via WebSocket
      7. Return PreviewResult with URL

    The container name includes session_id so multiple previews
    never conflict — each is fully isolated.
    """
    from backend.websocket.hub import broadcast_test_output

    await broadcast_test_output(
        startup_id, session_id,
        event="test.preview",
        data={"message": "Launching preview environment..."},
    )

    path = Path(worktree_path)
    if not path.exists():
        return PreviewResult(success=False, error="Worktree directory not found")

    # Check Docker is available
    rc, _, _ = await _run(["docker", "info"])
    if rc != 0:
        logger.warning("Docker not available — skipping preview for session %s", session_id)
        return PreviewResult(
            success=False,
            error="Docker not running — preview unavailable. Start Docker Desktop and retry.",
        )

    app_type = await _detect_startup_type(worktree_path)
    preview_port = _find_free_port()
    container_name = f"dalkkak-preview-{session_id[:12]}"
    preview_db_url = await _create_preview_db_schema(session_id)

    logger.info(
        "Launching preview: session=%s type=%s port=%d container=%s",
        session_id, app_type, preview_port, container_name,
    )

    # Remove any old container with the same name (idempotent)
    await _run(["docker", "rm", "-f", container_name])

    # Build the docker run command based on app type
    docker_cmd = _build_docker_command(
        container_name=container_name,
        worktree_path=str(path.resolve()),
        preview_port=preview_port,
        preview_db_url=preview_db_url,
        app_type=app_type,
    )

    # Start the container
    rc, _, err = await _run(docker_cmd)
    if rc != 0:
        logger.error("Failed to start preview container: %s", err)
        return PreviewResult(success=False, error=f"Preview launch failed: {err}")

    # Track it so we can clean up later
    _running_previews[session_id] = container_name

    # Wait for the container to respond
    preview_url = f"http://localhost:{preview_port}"
    health_url = f"{preview_url}/health"

    await broadcast_test_output(
        startup_id, session_id,
        event="test.preview",
        data={"message": f"Waiting for preview to start on port {preview_port}..."},
    )

    is_healthy = await _wait_until_healthy(health_url)

    if not is_healthy:
        # Still return the URL — container might just be slow or have no /health
        logger.warning("Preview health check timed out: session=%s port=%d", session_id, preview_port)

    # Broadcast the clickable URL to the UI
    await broadcast_test_output(
        startup_id, session_id,
        event="test.preview",
        data={
            "url": preview_url,
            "port": preview_port,
            "app_type": app_type,
            "container": container_name,
            "ready": is_healthy,
            "message": f"Preview ready at {preview_url}" if is_healthy else f"Preview starting at {preview_url}",
        },
    )

    logger.info("Preview launched: session=%s url=%s", session_id, preview_url)
    return PreviewResult(
        success=True,
        url=preview_url,
        port=preview_port,
        container_name=container_name,
    )


def _build_docker_command(
    container_name: str,
    worktree_path: str,
    preview_port: int,
    preview_db_url: str,
    app_type: str,
) -> list[str]:
    """
    Build the `docker run` command for a preview container.

    Uses the same Python image as the main API (already cached on dev machines).
    Mounts the worktree as a volume — no image rebuild needed per session.
    """
    # Determine start command, container port, and base image based on app type
    if app_type in ("fastapi", "unknown"):
        start_cmd = "pip install -r requirements.txt -q 2>/dev/null; uvicorn main:app --host 0.0.0.0 --port 8000 2>/dev/null || python main.py"
        container_port = 8000
        image = "python:3.11-slim"
    elif app_type == "nextjs":
        start_cmd = "npm install --silent && npm start"
        container_port = 3000
        image = "node:20-slim"
    else:  # fullstack or generic node
        start_cmd = "npm install --silent && npm start"
        container_port = 3000
        image = "node:20-slim"

    return [
        "docker", "run",
        "--detach",
        "--name", container_name,
        "--publish", f"{preview_port}:{container_port}",
        "--volume", f"{worktree_path}:/app",
        "--workdir", "/app",
        "--env", f"DATABASE_URL={preview_db_url}",
        "--env", "ENVIRONMENT=preview",
        "--env", f"PORT={container_port}",
        "--env", f"SECRET_KEY=preview-{container_name}",
        "--env", "ANTHROPIC_API_KEY=placeholder",
        "--network", "factory001_ddalkkak_default",
        image,
        "sh", "-c", start_cmd,
    ]


async def stop_preview(session_id: str) -> bool:
    """
    Stop and remove a preview container.
    Called when user merges the session or explicitly closes the preview.
    """
    container_name = _running_previews.pop(session_id, None)
    if not container_name:
        return True  # Already gone

    rc, _, err = await _run(["docker", "rm", "-f", container_name])
    if rc != 0:
        logger.warning("Failed to stop preview container %s: %s", container_name, err)
        return False

    logger.info("Stopped preview: session=%s container=%s", session_id, container_name)
    return True


async def stop_all_previews() -> None:
    """Stop all running preview containers. Called on app shutdown."""
    session_ids = list(_running_previews.keys())
    await asyncio.gather(*[stop_preview(sid) for sid in session_ids])
