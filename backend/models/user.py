"""
models/user.py — User table.

One user can own multiple startups.
Plan controls AI budget and session concurrency limits.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """
    Platform user. Authenticated via JWT.
    Plan determines feature access and AI cost limits.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Subscription plan — controls AI budget and session concurrency
    plan: Mapped[str] = mapped_column(
        String(20), nullable=False, default="free"
    )  # free | starter | growth | scale

    # User's own Anthropic API key (BYOK — Bring Your Own Key)
    # If set, ALL AI calls for this user use their key instead of the platform key.
    anthropic_api_key: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    startups: Mapped[list["Startup"]] = relationship(  # noqa: F821
        "Startup", back_populates="user", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} plan={self.plan}>"
