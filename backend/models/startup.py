"""
models/startup.py — Startup table.

One user can have multiple startups.
Each startup has its own GitHub repo, Railway deployment, and domain.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin


class Startup(Base, TimestampMixin):
    """
    A user's startup. The central entity in DalkkakAI.
    Everything (sessions, deployments, analytics) belongs to a startup.
    """

    __tablename__ = "startups"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Domain — auto-assigned as {slug}.dalkkak.ai
    domain: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )
    custom_domain: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Lifecycle status
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="building"
    )  # building | live | paused | error

    # Tech stack detected/chosen during build (e.g. {"frontend": "next", "backend": "fastapi"})
    stack: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # GitHub
    git_repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Railway deployment
    deploy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    deploy_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="stopped"
    )  # deploying | live | failed | stopped

    # Flexible settings bag (Stripe keys, analytics IDs, etc.)
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="startups", lazy="noload"
    )
    sessions: Mapped[list["Session"]] = relationship(  # noqa: F821
        "Session", back_populates="startup", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Startup id={self.id} name={self.name} status={self.status}>"
