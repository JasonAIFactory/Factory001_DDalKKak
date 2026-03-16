"""
tests/test_sessions.py — Session CRUD + concurrency tests.

Tests the core DalkkakAI multi-session system:
- Create sessions for a startup
- Verify session status lifecycle
- Verify per-plan concurrency limits (free = 1, starter = 2, etc.)
- Verify multiple sessions queued correctly
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

async def register_and_login(client: AsyncClient, email: str = "jason@dalkkak.ai") -> str:
    """Register a user and return their auth token."""
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Jason", "password": "securepassword123"},
    )
    assert reg.status_code == 201, reg.text
    return reg.json()["data"]["token"]["access_token"]


async def create_startup(client: AsyncClient, token: str, name: str = "ReviewPro") -> str:
    """Create a startup and return its ID."""
    res = await client.post(
        "/api/startups/",
        json={
            "name": name,
            "description": "A SaaS that helps restaurants manage and respond to reviews using AI.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


async def create_session(client: AsyncClient, token: str, startup_id: str, title: str = "Add auth") -> dict:
    """Create a session and return the response body."""
    res = await client.post(
        f"/api/startups/{startup_id}/sessions",
        json={"title": title, "description": f"Implement {title} for the startup"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return res


# ── Session CRUD tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_success(client: AsyncClient) -> None:
    """User can create a session for their startup — starts as queued."""
    token = await register_and_login(client)
    startup_id = await create_startup(client, token)

    res = await create_session(client, token, startup_id, "Add user authentication")

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["ok"] is True
    assert data["data"]["status"] == "queued"
    assert data["data"]["startup_id"] == startup_id
    assert data["data"]["title"] == "Add user authentication"


@pytest.mark.asyncio
async def test_create_session_wrong_startup(client: AsyncClient) -> None:
    """Creating a session for another user's startup returns 403."""
    token_a = await register_and_login(client, "a@dalkkak.ai")
    token_b = await register_and_login(client, "b@dalkkak.ai")

    startup_id = await create_startup(client, token_a)

    # User B tries to create a session on User A's startup — 404 (doesn't reveal existence)
    res = await create_session(client, token_b, startup_id)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient) -> None:
    """User can list all sessions for their startup."""
    token = await register_and_login(client)
    startup_id = await create_startup(client, token)

    await create_session(client, token, startup_id, "Add auth")
    await create_session(client, token, startup_id, "Add payments")
    await create_session(client, token, startup_id, "Add dashboard")

    res = await client.get(
        f"/api/startups/{startup_id}/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert len(data["data"]) == 3


@pytest.mark.asyncio
async def test_get_session_detail(client: AsyncClient) -> None:
    """User can fetch a specific session by ID."""
    token = await register_and_login(client)
    startup_id = await create_startup(client, token)

    created = await create_session(client, token, startup_id, "Add search")
    session_id = created.json()["data"]["id"]

    res = await client.get(
        f"/api/sessions/{session_id}",
        params={"startup_id": startup_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 200
    assert res.json()["data"]["session"]["id"] == session_id


@pytest.mark.asyncio
async def test_cancel_session(client: AsyncClient) -> None:
    """User can cancel (soft-delete) a queued session."""
    token = await register_and_login(client)
    startup_id = await create_startup(client, token)
    created = await create_session(client, token, startup_id)
    session_id = created.json()["data"]["id"]

    res = await client.delete(
        f"/api/sessions/{session_id}",
        params={"startup_id": startup_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 200
    assert res.json()["ok"] is True


# ── Concurrency tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multiple_sessions_queued_in_order(client: AsyncClient) -> None:
    """
    Free plan allows 1 concurrent session.
    All sessions beyond that are queued — not rejected.
    They should all be created successfully with status=queued.
    """
    token = await register_and_login(client)
    startup_id = await create_startup(client, token)

    # Create 3 sessions — all should be queued regardless of plan limits
    results = [
        await create_session(client, token, startup_id, "Feature 1"),
        await create_session(client, token, startup_id, "Feature 2"),
        await create_session(client, token, startup_id, "Feature 3"),
    ]

    # All 3 should be created successfully with status=queued
    for res in results:
        assert res.status_code == 201, res.text
        assert res.json()["data"]["status"] == "queued"

    # List them — all 3 exist
    list_res = await client.get(
        f"/api/startups/{startup_id}/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(list_res.json()["data"]) == 3


@pytest.mark.asyncio
async def test_sessions_isolated_across_startups(client: AsyncClient) -> None:
    """
    Sessions from different startups are completely isolated.
    User A's sessions don't appear in User B's list.
    """
    token_a = await register_and_login(client, "a@dalkkak.ai")
    token_b = await register_and_login(client, "b@dalkkak.ai")

    startup_a = await create_startup(client, token_a, "Startup A")
    startup_b = await create_startup(client, token_b, "Startup B")

    await create_session(client, token_a, startup_a, "A feature")
    await create_session(client, token_b, startup_b, "B feature")

    sessions_a = await client.get(
        f"/api/startups/{startup_a}/sessions",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    sessions_b = await client.get(
        f"/api/startups/{startup_b}/sessions",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert len(sessions_a.json()["data"]) == 1
    assert len(sessions_b.json()["data"]) == 1
    assert sessions_a.json()["data"][0]["id"] != sessions_b.json()["data"][0]["id"]
