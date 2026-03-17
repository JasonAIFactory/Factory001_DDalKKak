"""
auth/router.py — Authentication API endpoints.

Routes:
    POST /auth/register  → create account + return token
    POST /auth/login     → authenticate + return token
    GET  /auth/me        → get current user
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.auth.schemas import AuthResponse, LoginRequest, RegisterRequest, SaveApiKeyRequest, TokenResponse, UserResponse
from backend.auth.service import authenticate_user, create_access_token, create_user
from backend.database import get_db
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a new account.
    Returns JWT token + user object on success.
    Returns 409 if email already exists.
    """
    try:
        user = await create_user(db, body.email, body.name, body.password)
    except ValueError as exc:
        if "already registered" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        raise

    token = create_access_token(str(user.id))
    return {
        "ok": True,
        "data": AuthResponse(
            token=TokenResponse(access_token=token),
            user=UserResponse.model_validate(user),
        ).model_dump(),
    }


@router.post("/login", response_model=dict)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Authenticate with email + password.
    Returns JWT token + user object on success.
    Returns 401 on wrong credentials (intentionally vague — no email enumeration).
    """
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id))
    return {
        "ok": True,
        "data": AuthResponse(
            token=TokenResponse(access_token=token),
            user=UserResponse.model_validate(user),
        ).model_dump(),
    }


@router.get("/me", response_model=dict)
async def me(current_user: User = Depends(get_current_user)) -> dict:
    """Return the currently authenticated user's profile."""
    return {
        "ok": True,
        "data": UserResponse.model_validate(current_user).model_dump(),
    }


@router.put("/me/api-key", response_model=dict)
async def save_api_key(
    body: SaveApiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Save (or replace) the user's own Anthropic API key.
    This key will be used for all AI sessions instead of the platform key.
    The raw key is stored — never returned in responses.
    """
    current_user.anthropic_api_key = body.anthropic_api_key
    await db.flush()
    return {"ok": True, "data": {"has_api_key": True}}


@router.delete("/me/api-key", response_model=dict)
async def delete_api_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove the user's saved API key. Sessions will use the platform key."""
    current_user.anthropic_api_key = None
    await db.flush()
    return {"ok": True, "data": {"has_api_key": False}}


@router.post("/refresh", response_model=dict)
async def refresh(current_user: User = Depends(get_current_user)) -> dict:
    """
    Issue a fresh token for an authenticated user.
    Client calls this before the current token expires.
    """
    token = create_access_token(str(current_user.id))
    return {
        "ok": True,
        "data": TokenResponse(access_token=token).model_dump(),
    }
