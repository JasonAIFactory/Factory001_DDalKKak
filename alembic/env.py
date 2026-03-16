"""
alembic/env.py — Alembic migration environment.

Uses async SQLAlchemy to match the production setup.
DATABASE_URL is read from the .env file via backend.config.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Import all models so Alembic can detect schema changes
from backend.models import Base  # noqa: F401 — registers all models
from backend.models.session import Session, SessionFileChange, SessionMessage  # noqa: F401
from backend.models.startup import Startup  # noqa: F401
from backend.models.user import User  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata Alembic diffs against
target_metadata = Base.metadata


def get_database_url() -> str:
    """Read DATABASE_URL from environment, not from alembic.ini."""
    from backend.config import settings

    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    """
    Run migrations without a live DB connection.
    Useful for generating SQL scripts without running them.
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Execute migrations on an open connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """
    Run migrations with an async DB connection.
    This is how we run in CI and production.
    """
    engine = create_async_engine(get_database_url())

    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
