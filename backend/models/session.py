"""
models/session.py — Session, SessionMessage, and SessionFileChange tables.

A session = one isolated AI work unit with its own git worktree.
Schema matches SESSIONS.md exactly.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin


class Session(Base, TimestampMixin):
    """
    One AI work session with git isolation.
    Each session runs on its own branch + worktree.
    """

    __tablename__ = "sessions"

    startup_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("startups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Identity
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Git isolation — each session lives on its own branch + worktree
    branch_name: Mapped[str] = mapped_column(String(100), nullable=False)
    worktree_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    base_commit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    head_commit: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Status — full lifecycle from SESSIONS.md
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="created", index=True
    )  # created | queued | running | paused | review | done | merging | merged | error | conflict

    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Agent configuration
    agent_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="feature"
    )  # build | feature | fix | marketing | support
    model_tier: Mapped[str] = mapped_column(
        String(10), nullable=False, default="sonnet"
    )  # haiku | sonnet | opus
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    # Results
    files_changed: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    lines_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lines_removed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    test_results: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"passed": 0, "failed": 0, "total": 0},
    )

    # Cost tracking — every session tracks its own spend
    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0")
    )
    total_tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Preview
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timing
    queued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    startup: Mapped["Startup"] = relationship(  # noqa: F821
        "Startup", back_populates="sessions", lazy="noload"
    )
    messages: Mapped[list["SessionMessage"]] = relationship(
        "SessionMessage", back_populates="session", lazy="noload"
    )
    file_changes: Mapped[list["SessionFileChange"]] = relationship(
        "SessionFileChange", back_populates="session", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Session id={self.id} title={self.title} status={self.status}>"


class SessionMessage(Base):
    """
    One message in a session's conversation history.
    Role = 'user' (founder) | 'agent' (Claude) | 'system' (internal events).
    """

    __tablename__ = "session_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # user | agent | system

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # AI metadata — only present for agent messages
    model_used: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 6), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationship
    session: Mapped["Session"] = relationship(
        "Session", back_populates="messages", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<SessionMessage id={self.id} role={self.role}>"


class SessionFileChange(Base):
    """
    Tracks which files a session created, modified, or deleted.
    Powers the Files tab in the session detail view.
    """

    __tablename__ = "session_file_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    change_type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # added | modified | deleted

    lines_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lines_removed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationship
    session: Mapped["Session"] = relationship(
        "Session", back_populates="file_changes", lazy="noload"
    )
