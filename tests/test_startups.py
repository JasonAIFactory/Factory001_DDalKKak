"""
tests/test_startups.py — Startup CRUD endpoint tests.

Covers: create, list, get, update, delete, auth enforcement.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _auth_headers(client: AsyncClient, user_payload: dict) -> dict:
    """Register a user and return auth headers. Helper for all tests."""
    response = await client.post("/api/auth/register", json=user_payload)
    token = response.json()["data"]["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_startup_success(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """Authenticated user can create a startup."""
    headers = await _auth_headers(client, user_payload)
    response = await client.post("/api/startups/", json=startup_payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["ok"] is True
    assert data["data"]["name"] == startup_payload["name"]
    assert data["data"]["domain"].endswith(".dalkkak.ai")
    assert data["data"]["status"] == "building"


@pytest.mark.asyncio
async def test_create_startup_unauthenticated(
    client: AsyncClient, startup_payload: dict
) -> None:
    """Creating a startup without auth returns 403."""
    response = await client.post("/api/startups/", json=startup_payload)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_startups_empty(client: AsyncClient, user_payload: dict) -> None:
    """New user has no startups — returns empty list."""
    headers = await _auth_headers(client, user_payload)
    response = await client.get("/api/startups/", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["data"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_startups_returns_only_own(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """User only sees their own startups, not others'."""
    # User 1 creates a startup
    headers1 = await _auth_headers(client, user_payload)
    await client.post("/api/startups/", json=startup_payload, headers=headers1)

    # User 2 registers and lists startups
    headers2 = await _auth_headers(
        client, {"email": "other@dalkkak.ai", "name": "Other", "password": "password123"}
    )
    response = await client.get("/api/startups/", headers=headers2)

    assert response.json()["total"] == 0


@pytest.mark.asyncio
async def test_get_startup_success(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """User can fetch their own startup by ID."""
    headers = await _auth_headers(client, user_payload)
    create_response = await client.post("/api/startups/", json=startup_payload, headers=headers)
    startup_id = create_response.json()["data"]["id"]

    response = await client.get(f"/api/startups/{startup_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["id"] == startup_id


@pytest.mark.asyncio
async def test_get_startup_not_found(client: AsyncClient, user_payload: dict) -> None:
    """Fetching a non-existent startup returns 404."""
    headers = await _auth_headers(client, user_payload)
    response = await client.get(
        "/api/startups/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_startup_success(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """User can update their startup's name."""
    headers = await _auth_headers(client, user_payload)
    create_response = await client.post("/api/startups/", json=startup_payload, headers=headers)
    startup_id = create_response.json()["data"]["id"]

    response = await client.patch(
        f"/api/startups/{startup_id}",
        json={"name": "ReviewPro v2"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "ReviewPro v2"


@pytest.mark.asyncio
async def test_delete_startup_success(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """User can soft-delete their startup. It disappears from the list."""
    headers = await _auth_headers(client, user_payload)
    create_response = await client.post("/api/startups/", json=startup_payload, headers=headers)
    startup_id = create_response.json()["data"]["id"]

    delete_response = await client.delete(f"/api/startups/{startup_id}", headers=headers)
    assert delete_response.json()["ok"] is True

    # Startup no longer appears in list
    list_response = await client.get("/api/startups/", headers=headers)
    assert list_response.json()["total"] == 0


@pytest.mark.asyncio
async def test_cannot_access_others_startup(
    client: AsyncClient, user_payload: dict, startup_payload: dict
) -> None:
    """User cannot read or modify another user's startup."""
    # User 1 creates startup
    headers1 = await _auth_headers(client, user_payload)
    create_response = await client.post("/api/startups/", json=startup_payload, headers=headers1)
    startup_id = create_response.json()["data"]["id"]

    # User 2 tries to access it
    headers2 = await _auth_headers(
        client, {"email": "attacker@evil.com", "name": "Attacker", "password": "password123"}
    )
    response = await client.get(f"/api/startups/{startup_id}", headers=headers2)
    assert response.status_code == 404  # 404, not 403 — don't reveal existence
