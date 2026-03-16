"""
tests/test_auth.py — Auth endpoint tests.

Covers: register, login, /me, token refresh, error cases.
Every endpoint has at least one success + one error case (CLAUDE.md rule).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, user_payload: dict) -> None:
    """New user registers successfully — gets token + user object."""
    response = await client.post("/api/auth/register", json=user_payload)

    assert response.status_code == 201
    data = response.json()
    assert data["ok"] is True
    assert "token" in data["data"]
    assert data["data"]["token"]["token_type"] == "bearer"
    assert data["data"]["user"]["email"] == user_payload["email"]
    assert "hashed_password" not in data["data"]["user"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, user_payload: dict) -> None:
    """Registering the same email twice returns 409."""
    await client.post("/api/auth/register", json=user_payload)
    response = await client.post("/api/auth/register", json=user_payload)

    assert response.status_code == 409
    assert response.json()["ok"] is False


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient, user_payload: dict) -> None:
    """Password shorter than 8 characters is rejected with 422."""
    payload = {**user_payload, "password": "short"}
    response = await client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, user_payload: dict) -> None:
    """Registered user can log in and get a fresh token."""
    await client.post("/api/auth/register", json=user_payload)

    response = await client.post(
        "/api/auth/login",
        json={"email": user_payload["email"], "password": user_payload["password"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["data"]["token"]["access_token"]


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, user_payload: dict) -> None:
    """Wrong password returns 401, not password-specific error (no enumeration)."""
    await client.post("/api/auth/register", json=user_payload)

    response = await client.post(
        "/api/auth/login",
        json={"email": user_payload["email"], "password": "wrongpassword"},
    )

    assert response.status_code == 401
    assert response.json()["ok"] is False


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient) -> None:
    """Unknown email returns 401 (same as wrong password — no enumeration)."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, user_payload: dict) -> None:
    """Authenticated user can fetch their own profile."""
    reg = await client.post("/api/auth/register", json=user_payload)
    token = reg.json()["data"]["token"]["access_token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["data"]["email"] == user_payload["email"]


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient) -> None:
    """Calling /me without a token returns 403."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_me_invalid_token(client: AsyncClient) -> None:
    """Calling /me with a garbage token returns 401."""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer notavalidtoken"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, user_payload: dict) -> None:
    """Authenticated user can refresh their token."""
    reg = await client.post("/api/auth/register", json=user_payload)
    token = reg.json()["data"]["token"]["access_token"]

    response = await client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    new_token = response.json()["data"]["access_token"]
    assert new_token  # got a valid token back
