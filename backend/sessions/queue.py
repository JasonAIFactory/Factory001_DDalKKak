"""
sessions/queue.py — Session queue worker.

Runs as a background asyncio task inside the FastAPI process.
Continuously polls for queued sessions and dispatches them to the
AgentExecutor, respecting per-user concurrency limits.

This is what makes "parallel sessions" work:
  - Free plan: 1 session at a time
  - Starter:   2 sessions at a time
  - Growth:    5 sessions at a time
  - Scale:     10 sessions at a time

SESSIONS.md reference: "Session Queue & Concurrency" section.
"""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from backend.database import AsyncSessionLocal
from backend.models.session import Session
from backend.models.startup import Startup
from backend.models.user import User
from backend.sessions.service import (
    _get_local_repo_path,
    count_running_sessions,
    get_concurrency_limit,
)

logger = logging.getLogger(__name__)

# How often the queue worker polls for new sessions (seconds)
POLL_INTERVAL = 10.0


async def _get_next_queued_session(db: DbSession, user_id: str) -> Session | None:
    """
    Get the highest-priority queued session for a user.
    Priority: higher number first, then oldest first (FIFO within priority).
    """
    result = await db.execute(
        select(Session)
        .join(Startup, Session.startup_id == Startup.id)
        .where(
            Startup.user_id == user_id,
            Session.status == "queued",
            Session.deleted_at.is_(None),
        )
        .order_by(Session.priority.desc(), Session.queued_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_all_active_users(db: DbSession) -> list[str]:
    """Get IDs of all users who have queued sessions right now."""
    result = await db.execute(
        select(Startup.user_id)
        .join(Session, Session.startup_id == Startup.id)
        .where(Session.status == "queued", Session.deleted_at.is_(None))
        .distinct()
    )
    return [str(row[0]) for row in result.fetchall()]


async def _get_user_plan(db: DbSession, user_id: str) -> str:
    """Fetch a user's plan for concurrency limit calculation."""
    result = await db.execute(
        select(User.plan).where(User.id == user_id)
    )
    row = result.scalar_one_or_none()
    return row or "free"


async def _dispatch_session(session: Session, startup: Startup) -> None:
    """
    Run a session in the background.
    Updates session status before and after execution.
    Handles errors gracefully — session goes to 'error' state, never crashes the worker.
    """
    from backend.agents.executor import AgentExecutor
    from backend.websocket.hub import broadcast_completed, broadcast_error

    session_id = str(session.id)
    startup_id = str(startup.id)

    try:
        # Mark as running in DB
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Session)
                .where(Session.id == session.id)
                .values(status="running")
            )
            await db.commit()

        # Get the local repo path (worktree lives here)
        repo_path = _get_local_repo_path(startup)

        # Build and run the executor
        executor = AgentExecutor(
            session_id=session_id,
            startup_id=startup_id,
            startup_name=startup.name,
            worktree_path=session.worktree_path or f"{repo_path}/worktrees/{session.branch_name}",
            description=session.description,
            agent_type=session.agent_type,
            model_tier=session.model_tier,
        )

        result = await executor.run()

        # Update session with final result
        async with AsyncSessionLocal() as db:
            new_status = "review" if result.success else "error"
            update_values = {
                "status": new_status,
                "progress": 100 if result.success else session.progress,
                "total_cost": result.total_cost,
                "total_tokens_in": result.total_tokens_in,
                "total_tokens_out": result.total_tokens_out,
                "model_calls": result.model_calls,
            }
            if result.success:
                from datetime import UTC, datetime
                update_values["completed_at"] = datetime.now(UTC)

            await db.execute(
                update(Session).where(Session.id == session.id).values(**update_values)
            )
            await db.commit()

        # Auto-run tests when agent succeeds — zero manual work
        if result.success:
            worktree = session.worktree_path or f"{repo_path}/worktrees/{session.branch_name}"
            logger.info("Auto-running tests: session=%s worktree=%s", session_id, worktree)
            from backend.sessions.test_runner import run_tests
            test_result = await run_tests(
                worktree_path=worktree,
                startup_id=startup_id,
                session_id=session_id,
                stream_to_websocket=True,
            )
            # Persist test results to DB
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Session)
                    .where(Session.id == session.id)
                    .values(test_results={
                        "passed": test_result.passed,
                        "failed": test_result.failed,
                        "errors": test_result.errors,
                        "skipped": test_result.skipped,
                        "all_passed": test_result.all_passed,
                        "summary": test_result.summary(),
                    })
                )
                await db.commit()

            # Auto-launch preview if tests passed — user can click URL immediately
            if test_result.all_passed:
                worktree = session.worktree_path or f"{repo_path}/worktrees/{session.branch_name}"
                from backend.sessions.preview import launch_preview
                asyncio.create_task(launch_preview(
                    worktree_path=worktree,
                    startup_id=startup_id,
                    session_id=session_id,
                ))

            await broadcast_completed(startup_id, session_id, result.summary)
            logger.info("Session completed: %s cost=$%s tests=%s", session_id, result.total_cost, test_result.summary())
        else:
            error_msg = result.error or "Session failed"
            await broadcast_error(startup_id, session_id, error_msg)
            logger.warning("Session failed: %s error=%s", session_id, error_msg)

    except Exception:
        logger.exception("Unhandled error dispatching session %s", session_id)

        # Ensure session doesn't stay in 'running' state on crash
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Session)
                    .where(Session.id == session.id)
                    .values(status="error")
                )
                await db.commit()
            await broadcast_error(startup_id, session_id, "Unexpected error — session failed")
        except Exception:
            pass


async def _process_queue_tick() -> None:
    """
    One tick of the queue worker:
    1. Find all users with queued sessions
    2. For each user, check if they have a free concurrency slot
    3. If yes, dispatch the highest-priority queued session
    """
    async with AsyncSessionLocal() as db:
        active_user_ids = await _get_all_active_users(db)

        for user_id in active_user_ids:
            plan = await _get_user_plan(db, user_id)
            limit = get_concurrency_limit(plan)
            running = await count_running_sessions(db, user_id)

            if running >= limit:
                # User is at concurrency limit — skip
                continue

            # Get next session to run
            import uuid
            session = await _get_next_queued_session(db, user_id)
            if not session:
                continue

            # Load the startup for this session
            startup_result = await db.execute(
                select(Startup).where(Startup.id == session.startup_id)
            )
            startup = startup_result.scalar_one_or_none()
            if not startup:
                continue

            logger.info(
                "Dispatching session: session=%s user=%s plan=%s (%d/%d running)",
                session.id, user_id, plan, running + 1, limit,
            )

            # Dispatch as a background task — don't await it here
            # so the queue worker can pick up the next session immediately
            asyncio.create_task(_dispatch_session(session, startup))


async def run_queue_worker() -> None:
    """
    Long-running background task that powers the session queue.
    Started at app startup. Runs forever.

    Architecture note: This is Phase 1 (monolith) — single process,
    single worker. Phase 2 will use Redis-based distributed queue
    so multiple API replicas can share the work.
    """
    logger.info("Session queue worker started (poll interval: %ss)", POLL_INTERVAL)

    while True:
        try:
            await _process_queue_tick()
        except Exception:
            # Never crash the worker — log and continue
            logger.exception("Queue worker tick failed")

        await asyncio.sleep(POLL_INTERVAL)
