"""
config.py — Application settings loaded from environment variables.

All configuration lives here. Nothing is hardcoded anywhere else.
Use `from backend.config import settings` to access.
"""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central config loaded from .env file.
    Every field maps 1:1 to an environment variable.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────
    DATABASE_URL: str

    # ── Cache ─────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── Auth ──────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key-replace-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── AI ────────────────────────────────────────────────
    # Optional in dev — AI endpoints will return an error if not set
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""      # GPT-4o, Codex
    GOOGLE_AI_API_KEY: str = ""   # Gemini Pro / Flash

    # ── External services ─────────────────────────────────
    GITHUB_TOKEN: str = ""
    RAILWAY_API_KEY: str = ""
    RAILWAY_API_URL: str = "https://backboard.railway.app/graphql/v2"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STARTER: str = ""   # Stripe Price ID for Starter ($29/mo)
    STRIPE_PRICE_GROWTH: str = ""    # Stripe Price ID for Growth ($99/mo)
    STRIPE_PRICE_SCALE: str = ""     # Stripe Price ID for Scale ($299/mo)
    RESEND_API_KEY: str = ""

    # ── Storage ───────────────────────────────────────────
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "dalkkak-generated"

    # ── App ───────────────────────────────────────────────
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    # Stored as comma-separated string, parsed into list via property.
    # pydantic-settings v2 JSON-parses list fields before validators run,
    # so we keep this as str and expose the list via a property.
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── AI cost budgets per plan (USD/month) ──────────────
    AI_BUDGET_FREE: float = 1.0
    AI_BUDGET_STARTER: float = 5.0
    AI_BUDGET_GROWTH: float = 15.0
    AI_BUDGET_SCALE: float = 50.0

    # ── Session limits per plan ───────────────────────────
    SESSION_CONCURRENCY_FREE: int = 1
    SESSION_CONCURRENCY_STARTER: int = 2
    SESSION_CONCURRENCY_GROWTH: int = 5
    SESSION_CONCURRENCY_SCALE: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a list (comma-separated in env)."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        """True when running in production environment."""
        return self.ENVIRONMENT == "production"


settings = Settings()
