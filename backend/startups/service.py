"""
startups/service.py — Startup business logic.

Handles: create, list, get, update, soft-delete.
Domain auto-assigned as {slug}.dalkkak.ai on creation.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.startup import Startup


def _slugify(name: str) -> str:
    """
    Convert startup name to a URL-safe slug.
    Example: "My Coffee Shop!" → "my-coffee-shop"
    """
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = slug.strip("-")
    return slug


async def _generate_unique_domain(db: AsyncSession, name: str) -> str:
    """
    Generate a unique {slug}.dalkkak.ai domain.
    Appends a short UUID suffix if the slug is already taken.
    """
    base_slug = _slugify(name)
    candidate = f"{base_slug}.dalkkak.ai"

    existing = await db.execute(
        select(Startup).where(Startup.domain == candidate)
    )
    if existing.scalar_one_or_none() is None:
        return candidate

    # Slug taken — append 6-char UUID fragment
    suffix = str(uuid.uuid4())[:6]
    return f"{base_slug}-{suffix}.dalkkak.ai"


async def create_startup(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    description: str,
) -> Startup:
    """Create a new startup and assign an auto-generated domain."""
    domain = await _generate_unique_domain(db, name)

    startup = Startup(
        user_id=user_id,
        name=name,
        description=description,
        domain=domain,
        status="building",
        deploy_status="stopped",
        settings={},
    )
    db.add(startup)
    await db.flush()

    # Auto-init a git repo so sessions have a worktree to work in
    import asyncio
    import os
    import subprocess
    repo_path = f"{os.environ.get('WORKSPACE_PATH', '/workspace')}/{startup.id}"
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "DalkkakAI",
        "GIT_AUTHOR_EMAIL": "bot@dalkkak.ai",
        "GIT_COMMITTER_NAME": "DalkkakAI",
        "GIT_COMMITTER_EMAIL": "bot@dalkkak.ai",
    }
    await asyncio.to_thread(subprocess.run, ["git", "init", "-b", "main", repo_path], capture_output=True)
    await asyncio.to_thread(subprocess.run, ["git", "commit", "--allow-empty", "-m", "init"], cwd=repo_path, capture_output=True, env=env)

    return startup


async def list_startups(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Startup], int]:
    """
    Return paginated list of startups owned by a user.
    Returns (startups, total_count).
    """
    from sqlalchemy import func

    offset = (page - 1) * limit

    # Total count
    count_result = await db.execute(
        select(func.count(Startup.id)).where(
            Startup.user_id == user_id,
            Startup.deleted_at.is_(None),
        )
    )
    total = count_result.scalar_one()

    # Paginated results
    result = await db.execute(
        select(Startup)
        .where(Startup.user_id == user_id, Startup.deleted_at.is_(None))
        .order_by(Startup.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    startups = list(result.scalars().all())
    return startups, total


async def get_startup(
    db: AsyncSession,
    startup_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Startup | None:
    """
    Fetch a single startup by ID, verifying ownership.
    Returns None if not found or not owned by user.
    """
    result = await db.execute(
        select(Startup).where(
            Startup.id == startup_id,
            Startup.user_id == user_id,
            Startup.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def update_startup(
    db: AsyncSession,
    startup: Startup,
    name: str | None = None,
    description: str | None = None,
    custom_domain: str | None = None,
    settings: dict | None = None,
) -> Startup:
    """Apply partial updates to a startup record."""
    if name is not None:
        startup.name = name
    if description is not None:
        startup.description = description
    if custom_domain is not None:
        startup.custom_domain = custom_domain
    if settings is not None:
        # Merge settings — don't replace entirely
        startup.settings = {**startup.settings, **settings}

    await db.flush()
    return startup


async def delete_startup(db: AsyncSession, startup: Startup) -> None:
    """
    Soft-delete a startup.
    Sets deleted_at — never drops the row (audit trail + recovery).
    """
    from datetime import UTC, datetime

    startup.deleted_at = datetime.now(UTC)
    await db.flush()
