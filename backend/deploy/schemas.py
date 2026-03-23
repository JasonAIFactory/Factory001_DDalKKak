"""
deploy/schemas.py — Pydantic models for the deployment module.

Covers request/response shapes for deploy, status check, and rollback endpoints.
Data model mirrors the deployments table defined in docs/DEPLOY.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request models ────────────────────────────────────────────────────────────


class DeployRequest(BaseModel):
    """Payload for POST /api/startups/{id}/deploy."""

    environment: str = Field(
        default="production",
        pattern="^(staging|production)$",
        description="Target environment: staging or production.",
    )


class RollbackRequest(BaseModel):
    """Payload for POST /api/startups/{id}/deploy/rollback."""

    reason: str | None = Field(
        default=None,
        max_length=500,
        description="Optional reason for the rollback.",
    )


# ── Response models ───────────────────────────────────────────────────────────


class DeploymentResponse(BaseModel):
    """Single deployment record returned to the client."""

    id: uuid.UUID
    startup_id: uuid.UUID
    version: int
    environment: str
    git_commit: str
    git_branch: str
    status: str
    deploy_url: str | None
    build_logs: str | None
    health_status: str
    build_duration: int | None
    deploy_duration: int | None
    previous_deploy_id: uuid.UUID | None
    created_at: datetime
    completed_at: datetime | None


class DeployStatusResponse(BaseModel):
    """Lightweight status view returned by the status endpoint."""

    deployment_id: uuid.UUID
    status: str
    health_status: str
    deploy_url: str | None
    version: int
    environment: str
    created_at: datetime
    completed_at: datetime | None
