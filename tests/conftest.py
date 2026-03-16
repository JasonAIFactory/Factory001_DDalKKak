"""
tests/conftest.py — Shared pytest fixtures for all tests.

Uses an in-memory SQLite database (not PostgreSQL) for fast, isolated tests.
Each test gets a fresh DB — no state leaks between tests.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from backend.models import Base

# ── Test database ─────────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create a fresh in-memory SQLite engine for each test."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine):
    """Provide a clean database session for each test."""
    factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """
    HTTP test client with the test DB injected.
    Overrides the get_db dependency so tests use SQLite, not PostgreSQL.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Shared test data ──────────────────────────────────────────────────────────

@pytest.fixture
def user_payload() -> dict:
    """Valid user registration payload."""
    return {
        "email": "jason@dalkkak.ai",
        "name": "Jason",
        "password": "securepassword123",
    }


@pytest.fixture
def startup_payload() -> dict:
    """Valid startup creation payload."""
    return {
        "name": "ReviewPro",
        "description": "A SaaS that helps restaurants manage and respond to reviews automatically using AI.",
    }
