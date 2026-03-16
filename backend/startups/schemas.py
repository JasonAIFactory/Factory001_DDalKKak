"""
startups/schemas.py — Pydantic models for startup CRUD.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request models ────────────────────────────────────────────────────────────

class CreateStartupRequest(BaseModel):
    """Payload for POST /startups/."""

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=2000)


class UpdateStartupRequest(BaseModel):
    """Payload for PATCH /startups/{id}. All fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=2000)
    custom_domain: str | None = None
    settings: dict | None = None


# ── Response models ───────────────────────────────────────────────────────────

class StartupResponse(BaseModel):
    """Startup representation returned to the client."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str
    domain: str | None
    custom_domain: str | None
    status: str
    stack: dict | None
    git_repo_url: str | None
    deploy_url: str | None
    deploy_status: str
    settings: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
