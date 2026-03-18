"""
sessions/router.py — Session API endpoints.

Routes:
    POST   /startups/{id}/sessions          → create session
    GET    /startups/{id}/sessions          → list sessions
    GET    /sessions/{id}                   → session detail
    PATCH  /sessions/{id}                   → update session
    DELETE /sessions/{id}                   → cancel session

    POST   /sessions/{id}/start             → start queued session
    POST   /sessions/{id}/pause             → pause running session
    POST   /sessions/{id}/resume            → resume paused session
    POST   /sessions/{id}/merge             → merge into main

    POST   /sessions/{id}/chat              → send message to agent
    GET    /sessions/{id}/messages          → get conversation history
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from backend.auth.deps import get_current_user
from backend.database import get_db
from backend.models.user import User
from backend.sessions.schemas import (
    ChatRequest,
    CreateSessionRequest,
    SessionDetailResponse,
    SessionMessageResponse,
    SessionResponse,
    UpdateSessionRequest,
)
from backend.sessions.service import (
    add_message,
    cancel_session,
    complete_session,
    create_session,
    get_session,
    get_session_detail,
    list_sessions,
    merge_session,
    pause_session,
    queue_session,
    resume_session,
)
from backend.startups.service import get_startup

router = APIRouter(tags=["sessions"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_startup_or_404(db: DbSession, startup_id: uuid.UUID, user_id: uuid.UUID):
    """Shared helper: fetch startup and verify ownership."""
    startup = await get_startup(db, startup_id, user_id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
    return startup


async def _get_session_or_404(db: DbSession, session_id: uuid.UUID, startup_id: uuid.UUID):
    """Shared helper: fetch session and verify it belongs to startup."""
    session = await get_session(db, session_id, startup_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


# ── Session CRUD ──────────────────────────────────────────────────────────────

@router.post("/startups/{startup_id}/sessions", response_model=dict, status_code=201)
async def create(
    startup_id: uuid.UUID,
    body: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """
    Create a new session for a startup.
    Automatically creates a git branch + worktree for isolation.
    """
    startup = await _get_startup_or_404(db, startup_id, current_user.id)

    session = await create_session(
        db,
        startup=startup,
        title=body.title,
        description=body.description,
        agent_type=body.agent_type,
        priority=body.priority,
    )

    if body.agent_type == "terminal":
        # Terminal sessions skip the queue — user controls via web terminal
        session.status = "running"
    else:
        # AI sessions go through the queue → executor picks them up
        await queue_session(db, session)

    await db.refresh(session)

    return {
        "ok": True,
        "data": SessionResponse.model_validate(session).model_dump(),
    }


@router.get("/startups/{startup_id}/sessions", response_model=dict)
async def list_all(
    startup_id: uuid.UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """List all sessions for a startup, optionally filtered by status."""
    await _get_startup_or_404(db, startup_id, current_user.id)

    sessions, total = await list_sessions(db, startup_id, status_filter, page, limit)
    return {
        "ok": True,
        "data": [SessionResponse.model_validate(s).model_dump() for s in sessions],
        "total": total,
        "page": page,
    }


@router.get("/sessions/{session_id}", response_model=dict)
async def get_detail(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Get full session detail including messages and file changes."""
    await _get_startup_or_404(db, startup_id, current_user.id)

    result = await get_session_detail(db, session_id, startup_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session, messages, file_changes = result
    return {
        "ok": True,
        "data": {
            "session": SessionResponse.model_validate(session).model_dump(),
            "messages": [SessionMessageResponse.model_validate(m).model_dump() for m in messages],
            "file_changes": [
                {
                    "file_path": fc.file_path,
                    "change_type": fc.change_type,
                    "lines_added": fc.lines_added,
                    "lines_removed": fc.lines_removed,
                }
                for fc in file_changes
            ],
        },
    }


@router.patch("/sessions/{session_id}", response_model=dict)
async def update(
    session_id: uuid.UUID,
    body: UpdateSessionRequest,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Update session title, description, or priority."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    if body.title is not None:
        session.title = body.title
    if body.description is not None:
        session.description = body.description
    if body.priority is not None:
        session.priority = body.priority

    await db.flush()
    await db.refresh(session)
    return {
        "ok": True,
        "data": SessionResponse.model_validate(session).model_dump(),
    }


@router.delete("/sessions/{session_id}", response_model=dict)
async def cancel(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Cancel and soft-delete a session. Cleans up the git worktree."""
    startup = await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    await cancel_session(db, session, startup)
    return {"ok": True}


# ── Session control ───────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/start", response_model=dict)
async def start(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Manually start a queued session (bypasses queue priority)."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    if session.status != "queued":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is {session.status}, expected queued",
        )

    from backend.sessions.service import start_session
    await start_session(db, session)
    # TODO: Dispatch to agent executor (Phase 1: background task)

    return {"ok": True, "data": SessionResponse.model_validate(session).model_dump()}


@router.post("/sessions/{session_id}/pause", response_model=dict)
async def pause(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Pause a running session."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    try:
        await pause_session(db, session)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    return {"ok": True, "data": SessionResponse.model_validate(session).model_dump()}


@router.post("/sessions/{session_id}/resume", response_model=dict)
async def resume(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Resume a paused session."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    try:
        await resume_session(db, session)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    return {"ok": True, "data": SessionResponse.model_validate(session).model_dump()}


@router.post("/sessions/{session_id}/approve", response_model=dict)
async def approve(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Approve a session in review status → marks as completed."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    if session.status != "review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve session with status: {session.status}",
        )

    session.status = "completed"
    session.progress = 100
    await db.flush()

    return {"ok": True, "data": SessionResponse.model_validate(session).model_dump()}


@router.post("/sessions/{session_id}/retry", response_model=dict)
async def retry(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Retry a failed or reviewed session → re-queue for executor."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    if session.status not in ("error", "review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry session with status: {session.status}",
        )

    session.status = "queued"
    session.error_message = None
    session.progress = 0
    await db.flush()

    return {"ok": True, "data": SessionResponse.model_validate(session).model_dump()}


@router.post("/sessions/{session_id}/cancel", response_model=dict)
async def cancel_running(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Cancel a running/queued session → soft delete + cleanup."""
    startup = await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    if session.status not in ("queued", "running", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel session with status: {session.status}",
        )

    await cancel_session(db, session, startup)

    return {"ok": True}


@router.post("/sessions/{session_id}/merge", response_model=dict)
async def merge(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """
    딸깍 Merge — merge the session's branch into main.
    On conflict, returns the conflicting files for user review.
    """
    startup = await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    try:
        result = await merge_session(db, session, startup)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    return {"ok": True, "data": result}


# ── File content ─────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/files/{file_path:path}", response_model=dict)
async def get_file_content(
    session_id: uuid.UUID,
    file_path: str,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Read a file from the session's worktree."""
    import os

    await _get_startup_or_404(db, startup_id, current_user.id)
    session = await _get_session_or_404(db, session_id, startup_id)

    # Determine file location
    if session.worktree_path:
        full_path = os.path.join(session.worktree_path, file_path)
    else:
        workspace = os.environ.get("WORKSPACE_PATH", "/workspace")
        full_path = os.path.join(workspace, str(startup_id), file_path)

    # Security: prevent path traversal
    real_path = os.path.realpath(full_path)
    workspace_root = os.path.realpath(os.environ.get("WORKSPACE_PATH", "/workspace"))
    if not real_path.startswith(workspace_root):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: path outside workspace",
        )

    if not os.path.isfile(real_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_path}",
        )

    try:
        with open(real_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(500_000)  # 500KB limit
    except OSError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {e}",
        ) from e

    return {
        "ok": True,
        "data": {
            "path": file_path,
            "content": content,
        },
    }


# ── Chat ──────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/chat", response_model=dict)
async def chat(
    session_id: uuid.UUID,
    body: ChatRequest,
    startup_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """
    Send a message to the agent during a session.
    Message is added to conversation history — agent picks it up on next iteration.
    """
    await _get_startup_or_404(db, startup_id, current_user.id)
    await _get_session_or_404(db, session_id, startup_id)

    message = await add_message(db, session_id, role="user", content=body.content)
    # TODO: Notify agent via WebSocket to pick up the new instruction

    return {
        "ok": True,
        "data": SessionMessageResponse.model_validate(message).model_dump(),
    }


@router.get("/sessions/{session_id}/messages", response_model=dict)
async def get_messages(
    session_id: uuid.UUID,
    startup_id: uuid.UUID = Query(...),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> dict:
    """Get conversation history for a session."""
    await _get_startup_or_404(db, startup_id, current_user.id)
    await _get_session_or_404(db, session_id, startup_id)

    from sqlalchemy import select as sa_select

    from backend.models.session import SessionMessage

    result = await db.execute(
        sa_select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc())
        .limit(limit)
    )
    messages = list(result.scalars().all())

    return {
        "ok": True,
        "data": [SessionMessageResponse.model_validate(m).model_dump() for m in messages],
    }
