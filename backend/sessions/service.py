"""
sessions/service.py — Session lifecycle management.

The heart of DalkkakAI's "visual tmux" system.
Each session = isolated AI work unit with its own git worktree.

Lifecycle: created → queued → running → review → done → merging → merged
           (or: paused, error, conflict at various points)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from backend.config import settings
from backend.models.session import Session, SessionFileChange, SessionMessage
from backend.models.startup import Startup
from backend.sessions.git import cleanup_worktree, create_worktree, merge_branch


def _branch_name(title: str, session_id: uuid.UUID) -> str:
    """
    Generate a git branch name from the session title.
    Example: "Add pricing page" + uuid → "feat/add-pricing-page-a1b2c3"
    """
    import re

    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = slug[:40].strip("-")
    short_id = str(session_id)[:6]
    return f"feat/{slug}-{short_id}"


# ── Concurrency guard ─────────────────────────────────────────────────────────

async def count_running_sessions(db: DbSession, user_id: uuid.UUID) -> int:
    """Count sessions currently running for a user across all their startups."""
    result = await db.execute(
        select(func.count(Session.id))
        .join(Startup, Session.startup_id == Startup.id)
        .where(
            Startup.user_id == user_id,
            Session.status == "running",
            Session.deleted_at.is_(None),
        )
    )
    return result.scalar_one()


def get_concurrency_limit(plan: str) -> int:
    """Return how many sessions a user can run in parallel based on their plan."""
    limits = {
        "free": settings.SESSION_CONCURRENCY_FREE,
        "starter": settings.SESSION_CONCURRENCY_STARTER,
        "growth": settings.SESSION_CONCURRENCY_GROWTH,
        "scale": settings.SESSION_CONCURRENCY_SCALE,
    }
    return limits.get(plan, 1)


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create_session(
    db: DbSession,
    startup: Startup,
    title: str,
    description: str,
    agent_type: str = "feature",
    priority: int = 5,
) -> Session:
    """
    Create a session record and its git worktree.

    Steps (from SESSIONS.md):
    1. Create session record (status: created)
    2. Generate branch name
    3. Create git worktree
    4. Queue the session
    """
    session_id = uuid.uuid4()
    branch = _branch_name(title, session_id)

    session = Session(
        id=session_id,
        startup_id=startup.id,
        title=title,
        description=description,
        branch_name=branch,
        agent_type=agent_type,
        priority=priority,
        status="created",
    )
    db.add(session)
    await db.flush()  # get the ID before creating worktree

    # Create isolated git worktree (if startup has a repo)
    if startup.git_repo_url:
        result = await create_worktree(
            repo_path=_get_local_repo_path(startup),
            branch=branch,
        )
        if result.success:
            session.worktree_path = result.path

    return session


async def get_session(
    db: DbSession,
    session_id: uuid.UUID,
    startup_id: uuid.UUID,
) -> Session | None:
    """Fetch a session, verifying it belongs to the given startup."""
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.startup_id == startup_id,
            Session.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_sessions(
    db: DbSession,
    startup_id: uuid.UUID,
    status_filter: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Session], int]:
    """List sessions for a startup, optionally filtered by status."""
    query = select(Session).where(
        Session.startup_id == startup_id,
        Session.deleted_at.is_(None),
    )
    count_query = select(func.count(Session.id)).where(
        Session.startup_id == startup_id,
        Session.deleted_at.is_(None),
    )

    if status_filter:
        query = query.where(Session.status == status_filter)
        count_query = count_query.where(Session.status == status_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(
        query
        .order_by(Session.priority.desc(), Session.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_session_detail(
    db: DbSession,
    session_id: uuid.UUID,
    startup_id: uuid.UUID,
) -> tuple[Session, list[SessionMessage], list[SessionFileChange]] | None:
    """Fetch session with its messages and file changes."""
    session = await get_session(db, session_id, startup_id)
    if not session:
        return None

    msg_result = await db.execute(
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc())
    )
    messages = list(msg_result.scalars().all())

    fc_result = await db.execute(
        select(SessionFileChange)
        .where(SessionFileChange.session_id == session_id)
        .order_by(SessionFileChange.created_at.asc())
    )
    file_changes = list(fc_result.scalars().all())

    return session, messages, file_changes


# ── Session control ───────────────────────────────────────────────────────────

async def queue_session(db: DbSession, session: Session) -> Session:
    """Move session to queued state, ready for agent pickup."""
    session.status = "queued"
    session.queued_at = datetime.now(UTC)
    await db.flush()
    return session


async def start_session(db: DbSession, session: Session) -> Session:
    """Mark session as running. Called by the agent executor."""
    session.status = "running"
    session.started_at = datetime.now(UTC)
    await db.flush()
    return session


async def pause_session(db: DbSession, session: Session) -> Session:
    """Pause a running session. Agent saves state before stopping."""
    if session.status != "running":
        raise ValueError(f"Cannot pause session with status: {session.status}")
    session.status = "paused"
    await db.flush()
    return session


async def resume_session(db: DbSession, session: Session) -> Session:
    """Resume a paused session."""
    if session.status != "paused":
        raise ValueError(f"Cannot resume session with status: {session.status}")
    session.status = "running"
    await db.flush()
    return session


async def cancel_session(db: DbSession, session: Session, startup: Startup) -> Session:
    """
    Cancel a session and clean up its git worktree.
    Soft-delete the session record.
    """
    # Clean up git worktree if it exists
    if session.worktree_path and startup.git_repo_url:
        await cleanup_worktree(
            repo_path=_get_local_repo_path(startup),
            branch=session.branch_name,
        )
        session.worktree_path = None

    session.deleted_at = datetime.now(UTC)
    await db.flush()
    return session


async def complete_session(db: DbSession, session: Session) -> Session:
    """Mark session as ready for review. Called by agent when done."""
    session.status = "review"
    session.completed_at = datetime.now(UTC)
    session.progress = 100
    await db.flush()
    return session


async def merge_session(
    db: DbSession,
    session: Session,
    startup: Startup,
) -> dict:
    """
    Merge a session's branch into main.

    Steps (from SESSIONS.md):
    1. Verify status is 'done' or 'review'
    2. Attempt git merge --no-ff
    3. If clean → mark merged, trigger deploy
    4. If conflict → mark conflict, return conflicting files
    """
    if session.status not in ("review", "done"):
        raise ValueError(f"Cannot merge session with status: {session.status}")

    session.status = "merging"
    await db.flush()

    repo_path = _get_local_repo_path(startup)
    result = await merge_branch(repo_path, session.branch_name)

    if result.success:
        session.status = "merged"
        await db.flush()

        # Clean up worktree — no longer needed after merge
        if session.worktree_path:
            await cleanup_worktree(repo_path, session.branch_name)
            session.worktree_path = None
            await db.flush()

        return {"success": True}
    else:
        session.status = "conflict"
        await db.flush()
        return {
            "success": False,
            "reason": result.reason,
            "conflicting_files": result.conflicting_files or [],
        }


# ── Messages ──────────────────────────────────────────────────────────────────

async def add_message(
    db: DbSession,
    session_id: uuid.UUID,
    role: str,
    content: str,
    model_used: str | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    cost: float | None = None,
    duration_ms: int | None = None,
) -> SessionMessage:
    """Append a message to a session's conversation history."""
    from decimal import Decimal

    message = SessionMessage(
        session_id=session_id,
        role=role,
        content=content,
        model_used=model_used,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost=Decimal(str(cost)) if cost else None,
        duration_ms=duration_ms,
        created_at=datetime.now(UTC),
    )
    db.add(message)
    await db.flush()
    return message


async def record_file_change(
    db: DbSession,
    session_id: uuid.UUID,
    file_path: str,
    change_type: str,
    lines_added: int = 0,
    lines_removed: int = 0,
) -> SessionFileChange:
    """Record that the agent created, modified, or deleted a file."""
    change = SessionFileChange(
        session_id=session_id,
        file_path=file_path,
        change_type=change_type,
        lines_added=lines_added,
        lines_removed=lines_removed,
        created_at=datetime.now(UTC),
    )
    db.add(change)
    await db.flush()
    return change


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_local_repo_path(startup: Startup) -> str:
    """
    Return the local filesystem path where a startup's repo is cloned.
    In production, repos live at /workspace/{startup_id}/.
    """
    import os

    workspace = os.environ.get("WORKSPACE_PATH", "/workspace")
    return f"{workspace}/{startup.id}"
