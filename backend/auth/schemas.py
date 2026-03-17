"""
auth/schemas.py — Pydantic models for auth request/response validation.

Every field is strictly typed. No 'any'. No optional security holes.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Request models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def name_no_whitespace_only(cls, v: str) -> str:
        """Reject names that are all spaces."""
        if not v.strip():
            raise ValueError("Name cannot be blank")
        return v.strip()


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr
    password: str


# ── Response models ───────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Safe user representation — never exposes hashed_password or raw API keys."""

    id: uuid.UUID
    email: str
    name: str
    plan: str
    onboarding_complete: bool
    has_api_key: bool = False  # True if user has saved their own Anthropic key

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj: object, **kwargs: object) -> "UserResponse":
        """Override to compute has_api_key from the raw model field."""
        data = super().model_validate(obj, **kwargs)
        if hasattr(obj, "anthropic_api_key"):
            data.has_api_key = bool(obj.anthropic_api_key)  # type: ignore[union-attr]
        return data


class SaveApiKeyRequest(BaseModel):
    """Payload for PUT /auth/me/api-key."""

    anthropic_api_key: str = Field(min_length=10, max_length=255)


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Combined response for register and login."""

    token: TokenResponse
    user: UserResponse
