"""
sessions/schemas.py — Pydantic models for the session system.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Request models ────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    """Payload for POST /startups/{id}/sessions."""

    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=2000)
    agent_type: str = Field(default="feature")  # build | feature | fix | marketing | support
    priority: int = Field(default=5, ge=1, le=10)


class UpdateSessionRequest(BaseModel):
    """Payload for PATCH /sessions/{id}. All fields optional."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=2000)
    priority: int | None = Field(default=None, ge=1, le=10)


class ChatRequest(BaseModel):
    """Payload for POST /sessions/{id}/chat."""

    content: str = Field(min_length=1, max_length=4000)


# ── Response models ───────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    """Session representation returned to the client."""

    id: uuid.UUID
    startup_id: uuid.UUID
    title: str
    description: str
    branch_name: str
    status: str
    progress: int
    agent_type: str
    model_tier: str
    priority: int
    files_changed: list
    lines_added: int
    lines_removed: int
    test_results: dict
    total_cost: Decimal
    model_calls: int
    preview_url: str | None = None
    error_message: str | None = None
    summary: str | None = None
    queued_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class SessionMessageResponse(BaseModel):
    """One message in a session's conversation."""

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    model_used: str | None
    tokens_in: int | None
    tokens_out: int | None
    cost: Decimal | None
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class SessionDetailResponse(BaseModel):
    """Full session detail with messages and file changes."""

    session: SessionResponse
    messages: list[SessionMessageResponse]
    file_changes: list[dict]
