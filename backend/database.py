"""
database.py — Async SQLAlchemy engine and session factory.

Usage:
    from backend.database import get_db

    async def my_endpoint(db: AsyncSession = Depends(get_db)):
        result = await db.execute(select(User))
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
# echo=False in production — never log raw SQL with user data
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # SQL logging off — too noisy, hides real errors
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # reconnect if DB dropped the connection
)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # keep objects usable after commit
    autocommit=False,
    autoflush=False,
)


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.
    Automatically commits on success, rolls back on exception.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
