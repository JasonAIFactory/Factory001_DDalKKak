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
import json as _json
import logging
import os
import re
import socket
import uuid
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# How long to wait for a preview container to become healthy
PREVIEW_STARTUP_TIMEOUT = 15  # seconds

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


@dataclass
class AppDetection:
    """Everything needed to run a detected app in Docker."""

    app_type: str
    start_cmd: str
    container_port: int
    image: str
    install_cmd: str = ""
    language: str = "python"


# Docker base image per language
_LANGUAGE_IMAGES: dict[str, str] = {
    "python": "python:3.11-slim",
    "node": "node:20-slim",
    "nodejs": "node:20-slim",
    "javascript": "node:20-slim",
    "go": "golang:1.22-alpine",
    "golang": "golang:1.22-alpine",
    "ruby": "ruby:3.3-slim",
    "java": "eclipse-temurin:21-jre",
    "rust": "rust:1.77-slim",
    "static": "python:3.11-slim",
}

# Default ports per language / framework
_DEFAULT_PORTS: dict[str, int] = {
    "python": 8000,
    "flask": 5000,
    "fastapi": 8000,
    "django": 8000,
    "node": 3000,
    "nodejs": 3000,
    "javascript": 3000,
    "nextjs": 3000,
    "go": 8080,
    "golang": 8080,
    "ruby": 3000,
    "java": 8080,
    "rust": 8080,
    "static": 8080,
}

# Regex patterns for port detection in source files
_PORT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"""(?:port|PORT)\s*[=:]\s*(\d{2,5})"""),
    re.compile(r"""\.listen\(\s*(\d{2,5})"""),
    re.compile(r""":(\d{2,5})['")\s]"""),
    re.compile(r"""--port[= ](\d{2,5})"""),
    re.compile(r"""-p\s+(\d{2,5})"""),
]


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


def _health_check_url(preview_url: str) -> str:
    """
    Convert a preview URL to one reachable from inside the API container.

    The preview container's port is mapped to the Docker host. From inside the
    API container, 'localhost' means the API container itself — not the host.
    On Windows/Mac Docker Desktop, 'host.docker.internal' resolves to the host.
    On Linux, we fall back to localhost (containers share the host network).
    """
    import os

    # When running inside Docker (ENVIRONMENT is set), use host.docker.internal
    # to reach ports mapped on the Docker host.
    in_docker = os.path.exists("/.dockerenv") or os.environ.get("ENVIRONMENT")
    if in_docker:
        # host.docker.internal works on Docker Desktop (Windows/Mac)
        # and on Linux with --add-host=host.docker.internal:host-gateway
        return preview_url.replace("localhost", "host.docker.internal")
    return preview_url


async def _wait_until_healthy(url: str, timeout: int = PREVIEW_STARTUP_TIMEOUT) -> bool:
    """
    Poll a URL until it responds 200 or timeout expires.
    Used to wait for preview containers to finish starting.

    The url should already be converted via _health_check_url() so it is
    reachable from inside the API container.
    """
    import httpx

    check_url = _health_check_url(url)
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient() as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                response = await client.get(check_url, timeout=2.0)
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


def _detect_port(worktree_path: str, app_type: str) -> int:
    """
    Scan code files to auto-detect the port the app listens on.

    Search order:
      1. .env files for PORT=
      2. Source files for common port patterns (listen, PORT, etc.)
      3. Fall back to default port for the detected app type
    """
    path = Path(worktree_path)

    # 1. Check .env files for PORT=
    for env_file in (".env", ".env.local", ".env.development"):
        env_path = path / env_file
        if env_path.exists():
            try:
                for line in env_path.read_text(errors="ignore").splitlines():
                    line = line.strip()
                    if line.startswith("PORT="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val.isdigit() and 1024 <= int(val) <= 65535:
                            return int(val)
            except Exception:
                continue

    # 2. Scan source files for port patterns
    extensions = ("*.py", "*.js", "*.ts", "*.jsx", "*.tsx", "*.go", "*.rb")
    found_ports: list[int] = []
    for ext in extensions:
        for src_file in path.glob(ext):
            try:
                content = src_file.read_text(errors="ignore")[:8192]
                for pattern in _PORT_PATTERNS:
                    for match in pattern.finditer(content):
                        port_val = int(match.group(1))
                        if 1024 <= port_val <= 65535:
                            found_ports.append(port_val)
            except Exception:
                continue
    if found_ports:
        # Most common port wins (in case multiple files mention different ports)
        return max(set(found_ports), key=found_ports.count)

    # 3. Default port for app type
    return _DEFAULT_PORTS.get(app_type, 8000)


def _detect_python_framework(worktree: Path) -> tuple[str, str]:
    """
    Scan Python files to detect the web framework and entry point.

    Returns (framework_name, entry_filename).
    framework_name is one of: 'fastapi', 'flask', 'django', 'python'.
    """
    py_files = list(worktree.glob("*.py"))
    framework = "python"
    entry = None

    # Priority: app.py / main.py / server.py — check these first
    priority_names = ["app.py", "main.py", "server.py", "run.py", "wsgi.py"]
    priority_files = [worktree / n for n in priority_names if (worktree / n).exists()]
    scan_order = priority_files + [f for f in py_files if f not in priority_files]

    for f in scan_order:
        try:
            content = f.read_text(errors="ignore")[:8192]
            if "FastAPI(" in content or "fastapi" in content.lower():
                framework = "fastapi"
                entry = f.name
                break
            if "Flask(" in content or "flask" in content.lower():
                framework = "flask"
                entry = f.name
                break
            if "django" in content.lower():
                framework = "django"
                entry = f.name
                break
            if "app.run(" in content or "uvicorn" in content:
                entry = f.name
                break
        except Exception:
            continue

    if not entry and py_files:
        # Fall back to first priority file or first .py file
        if priority_files:
            entry = priority_files[0].name
        else:
            entry = py_files[0].name

    return framework, entry or "app.py"


def _image_for_language(language: str) -> str:
    """Return the Docker base image for a given language."""
    return _LANGUAGE_IMAGES.get(language, "python:3.11-slim")


async def _detect_app(worktree_path: str) -> AppDetection:
    """
    Detect what kind of app is in the worktree and how to run it.

    Priority order (first match wins):
      1. dalkkak.json — explicit config (always wins)
      2. Procfile — industry standard
      3. Dockerfile — docker build and run
      4. package.json — Node.js (check scripts.start, detect Next.js)
      5. requirements.txt + *.py — Python (scan for Flask/FastAPI/Django)
      6. index.html — static site (python http.server)
      7. unknown — fallback with helpful error message
    """
    path = Path(worktree_path)

    # ── Priority 1: dalkkak.json (explicit config, always wins) ──
    dalkkak_conf = path / "dalkkak.json"
    if dalkkak_conf.exists():
        try:
            conf = _json.loads(dalkkak_conf.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Invalid dalkkak.json: %s", exc)
            conf = {}

        lang = conf.get("language", "python")
        start = conf.get("start", "")
        port = conf.get("port", _DEFAULT_PORTS.get(lang, 8000))
        install = conf.get("install", "")

        if not start:
            # dalkkak.json exists but no start command — fall through to auto-detect
            logger.warning("dalkkak.json has no 'start' field, falling through")
        else:
            return AppDetection(
                app_type="dalkkak",
                start_cmd=start,
                container_port=port,
                image=_image_for_language(lang),
                install_cmd=install,
                language=lang,
            )

    # ── Priority 2: Procfile ──
    procfile_path = path / "Procfile"
    if procfile_path.exists():
        try:
            procfile_text = procfile_path.read_text(encoding="utf-8")
            start_cmd = ""
            for line in procfile_text.splitlines():
                if line.strip().startswith("web:"):
                    start_cmd = line.split(":", 1)[1].strip()
                    break
            if not start_cmd:
                first_line = procfile_text.strip().splitlines()[0]
                start_cmd = first_line.split(":", 1)[-1].strip()
        except Exception:
            start_cmd = ""

        if start_cmd:
            has_pkg = (path / "package.json").exists()
            lang = "nodejs" if has_pkg else "python"
            port = _detect_port(worktree_path, lang)
            return AppDetection(
                app_type="procfile",
                start_cmd=start_cmd,
                container_port=port,
                image=_image_for_language(lang),
                language=lang,
            )

    # ── Priority 3: Dockerfile ──
    if (path / "Dockerfile").exists():
        port = _detect_port(worktree_path, "docker")
        return AppDetection(
            app_type="dockerfile",
            start_cmd="",
            container_port=port,
            image="",  # built from Dockerfile
            language="docker",
        )

    # ── Priority 4: package.json (Node.js / Next.js) ──
    pkg_path = path / "package.json"
    if pkg_path.exists():
        is_nextjs = any(
            (path / f).exists()
            for f in ("next.config.js", "next.config.ts", "next.config.mjs")
        )
        pkg_start = None
        try:
            pkg = _json.loads(pkg_path.read_text(encoding="utf-8"))
            pkg_start = pkg.get("scripts", {}).get("start")
        except Exception:
            pass

        port = _detect_port(worktree_path, "nodejs")

        if is_nextjs:
            return AppDetection(
                app_type="nextjs",
                start_cmd=f"npm run dev -- -p {port}",
                container_port=port,
                image="node:20-slim",
                install_cmd="npm install --silent",
                language="nodejs",
            )

        if pkg_start:
            start_cmd = "npm start"
        else:
            start_cmd = (
                "if [ -f server.js ]; then node server.js; "
                "elif [ -f src/index.js ]; then node src/index.js; "
                "elif [ -f index.js ]; then node index.js; "
                "else npm start; fi"
            )
        return AppDetection(
            app_type="nodejs",
            start_cmd=start_cmd,
            container_port=port,
            image="node:20-slim",
            install_cmd="npm install --silent",
            language="nodejs",
        )

    # ── Priority 5: Python (requirements.txt or *.py files) ──
    has_requirements = (path / "requirements.txt").exists()
    has_any_py = any(path.glob("*.py"))
    if has_requirements or has_any_py:
        framework, entry = _detect_python_framework(path)
        port = _detect_port(worktree_path, framework)

        if framework == "fastapi":
            # Extract the FastAPI app variable name (usually 'app')
            start_cmd = f"uvicorn {entry.replace('.py', '')}:app --host 0.0.0.0 --port {port}"
        elif framework == "django":
            start_cmd = f"python manage.py runserver 0.0.0.0:{port}"
        else:
            start_cmd = f"python {entry}"

        install_cmd = ""
        if has_requirements:
            install_cmd = "pip install -r requirements.txt -q"

        return AppDetection(
            app_type=framework,
            start_cmd=start_cmd,
            container_port=port,
            image="python:3.11-slim",
            install_cmd=install_cmd,
            language="python",
        )

    # ── Priority 6: Static HTML ──
    if (path / "index.html").exists():
        return AppDetection(
            app_type="static",
            start_cmd="python -m http.server 8080",
            container_port=8080,
            image="python:3.11-slim",
            language="static",
        )

    # ── Priority 7: Unknown ──
    return AppDetection(
        app_type="unknown",
        start_cmd="echo 'Cannot detect how to run this app. Add dalkkak.json with start command and port.'",
        container_port=8000,
        image="python:3.11-slim",
        language="unknown",
    )


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

    detection = await _detect_app(worktree_path)
    preview_port = _find_free_port()
    container_name = f"dalkkak-preview-{session_id[:12]}"
    preview_db_url = await _create_preview_db_schema(session_id)

    logger.info(
        "Launching preview: session=%s type=%s lang=%s port=%d container=%s",
        session_id, detection.app_type, detection.language,
        preview_port, container_name,
    )

    # Remove any old container with the same name (idempotent)
    await _run(["docker", "rm", "-f", container_name])

    # Build the docker run command based on detection
    docker_cmd = _build_docker_command(
        container_name=container_name,
        worktree_path=str(path.resolve()),
        preview_port=preview_port,
        preview_db_url=preview_db_url,
        detection=detection,
    )

    # Start the container
    rc, _, err = await _run(docker_cmd)
    if rc != 0:
        logger.error("Failed to start preview container: %s", err)
        return PreviewResult(success=False, error=f"Preview launch failed: {err}")

    # Track it so we can clean up later
    _running_previews[session_id] = container_name

    preview_url = f"http://localhost:{preview_port}"

    # Quick health check — the container may need a few seconds to start.
    # Use host.docker.internal so we can reach the host-mapped port from
    # inside the API container.
    healthy = await _wait_until_healthy(preview_url, timeout=PREVIEW_STARTUP_TIMEOUT)
    if not healthy:
        logger.warning(
            "Preview container started but health check timed out: session=%s url=%s "
            "(container may still be installing dependencies)",
            session_id, preview_url,
        )
        # Don't fail — the container is running, it just might be slow to start.
        # The user's browser will retry naturally.

    logger.info("Preview launched: session=%s url=%s healthy=%s", session_id, preview_url, healthy)
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
    detection: AppDetection,
) -> list[str]:
    """
    Build the `docker run` command for a preview container.

    Uses detection result from _detect_app() — all logic for choosing
    image, port, start command, and install command lives there.
    This function just assembles the docker CLI arguments.
    """
    # Convert container path (/workspace/...) to host path for Docker volume mount
    # HOST_PROJECT_ROOT must be the absolute host path to the project root
    host_root = os.environ.get("HOST_PROJECT_ROOT", "")
    if host_root and worktree_path.startswith("/workspace/"):
        relative = worktree_path[len("/workspace/"):]
        host_path = f"{host_root}/workspace/{relative}"
    else:
        host_path = worktree_path

    # ── Dockerfile type: build image then run ──
    if detection.app_type == "dockerfile":
        # Build a tagged image from the Dockerfile, then run it
        image_tag = f"dalkkak-preview:{container_name}"
        return [
            "sh", "-c",
            f"docker build -t {image_tag} {host_path} && "
            f"docker run --detach "
            f"--name {container_name} "
            f"--publish {preview_port}:{detection.container_port} "
            f"--env DATABASE_URL='{preview_db_url}' "
            f"--env ENVIRONMENT=preview "
            f"--env PORT={detection.container_port} "
            f"--env SECRET_KEY=preview-{container_name} "
            f"--add-host host.docker.internal:host-gateway "
            f"--network factory001_ddalkkak_default "
            f"{image_tag}",
        ]

    # ── All other types: mount worktree as volume ──
    # Build the full shell command: install deps (if any) then start
    parts: list[str] = []
    if detection.install_cmd:
        parts.append(f"{detection.install_cmd} 2>/dev/null")
    if detection.start_cmd:
        parts.append(detection.start_cmd)
    full_cmd = "; ".join(parts) if parts else "echo 'No start command detected'"

    return [
        "docker", "run",
        "--detach",
        "--name", container_name,
        "--publish", f"{preview_port}:{detection.container_port}",
        "--volume", f"{host_path}:/app",
        "--workdir", "/app",
        "--env", f"DATABASE_URL={preview_db_url}",
        "--env", "ENVIRONMENT=preview",
        "--env", f"PORT={detection.container_port}",
        "--env", f"SECRET_KEY=preview-{container_name}",
        "--env", "ANTHROPIC_API_KEY=placeholder",
        # Ensure host.docker.internal resolves on Linux too
        "--add-host", "host.docker.internal:host-gateway",
        "--network", "factory001_ddalkkak_default",
        detection.image,
        "sh", "-c", full_cmd,
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
