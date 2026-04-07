"""
main.py — FastAPI application entry point.

Registers all routers, middleware, and startup/shutdown handlers.
This is what Railway runs: uvicorn backend.main:app
"""

from __future__ import annotations

import asyncio
import logging
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.auth.router import router as auth_router
from backend.billing.router import router as billing_router
from backend.config import settings
from backend.deploy.router import router as deploy_router
from backend.sessions.router import router as sessions_router
from backend.startups.router import router as startups_router
from backend.terminal.router import router as terminal_router
from backend.websocket.hub import hub

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.is_production else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic using the modern lifespan pattern."""
    logger.info("DalkkakAI API starting — env=%s", settings.ENVIRONMENT)
    logger.info("Running database migrations...")
    await _run_migrations()
    logger.info("Migrations complete")

    from backend.sessions.queue import run_queue_worker
    queue_task = asyncio.create_task(run_queue_worker())
    logger.info("Session queue worker started")

    yield

    queue_task.cancel()
    # Don't stop previews on reload — they should survive API restarts
    # Only stop on production shutdown (not dev hot-reload)
    if os.environ.get("ENVIRONMENT") != "development":
        from backend.sessions.preview import stop_all_previews
        await stop_all_previews()
    logger.info("DalkkakAI API shut down cleanly")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DalkkakAI API",
    description="Startup operating system — describe it, click once, run everything.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Only allow frontend origin. Never wildcard in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(billing_router)
app.include_router(startups_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(deploy_router, prefix="/api")
app.include_router(terminal_router)  # WebSocket at /ws/terminal

# ── HTTP exception handler ────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Return all HTTP errors in the standard {"ok": false, "error": ...} envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": exc.detail},
    )


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch all unhandled exceptions.
    Log the full traceback internally, return a clean message to the client.
    NEVER expose Python tracebacks to users (CLAUDE.md rule).
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": "An unexpected error occurred. Our team has been notified.",
            "code": "INTERNAL_ERROR",
        },
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    """
    Health check endpoint used by Railway and monitoring.
    Returns 200 if the server is running.
    """
    return {"ok": True, "status": "healthy"}


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/sessions/{startup_id}")
async def websocket_sessions(websocket: WebSocket, startup_id: str) -> None:
    """
    Real-time session updates for a startup's dashboard.

    Client connects here and receives live events:
      - session.progress    (progress bar updates)
      - session.file_change (files tab updates)
      - session.message     (chat tab streaming)
      - session.test_result (tests tab updates)
      - session.completed   (session finished)
      - session.error       (session failed)
      - session.merged      (merge completed)

    Client can also send:
      - session.chat        (mid-session instructions)
      - session.pause       (pause running session)
      - session.cancel      (cancel session)
    """
    await hub.connect(startup_id, websocket)
    try:
        while True:
            # Keep connection alive and handle incoming client messages
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "session.chat":
                # Client sent a mid-session instruction — handled by session router
                # For now, just acknowledge receipt
                await websocket.send_json({"event": "ack", "data": {"event": event}})

    except WebSocketDisconnect:
        hub.disconnect(startup_id, websocket)
    except Exception:
        logger.exception("WebSocket error: startup=%s", startup_id)
        hub.disconnect(startup_id, websocket)


async def _run_migrations() -> None:
    """
    Run Alembic migrations programmatically on startup.
    Eliminates the need to run `alembic upgrade head` manually.
    """
    import subprocess
    import sys

    result = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error("Migration failed:\n%s", result.stderr)
        raise RuntimeError(f"Database migration failed: {result.stderr}")
    if result.stdout:
        logger.info("Migration output: %s", result.stdout.strip())


