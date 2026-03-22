"""
billing/schemas.py — Pydantic models for billing endpoints.

Defines request/response shapes for checkout, subscription status,
portal links, and webhook payloads.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ── Plan definitions ─────────────────────────────────────────────────────────

PLAN_CONFIGS: dict[str, dict] = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "concurrent_sessions": 1,
        "ai_credits_included": 0.0,
        "stripe_price_id": None,
    },
    "starter": {
        "name": "Starter",
        "price_monthly": 29,
        "concurrent_sessions": 2,
        "ai_credits_included": 5.0,
        "stripe_price_id": None,  # Set via STRIPE_PRICE_STARTER env var
    },
    "growth": {
        "name": "Growth",
        "price_monthly": 99,
        "concurrent_sessions": 5,
        "ai_credits_included": 20.0,
        "stripe_price_id": None,  # Set via STRIPE_PRICE_GROWTH env var
    },
    "scale": {
        "name": "Scale",
        "price_monthly": 299,
        "concurrent_sessions": 10,
        "ai_credits_included": 50.0,
        "stripe_price_id": None,  # Set via STRIPE_PRICE_SCALE env var
    },
}

VALID_PLANS = {"free", "starter", "growth", "scale"}


# ── Request models ───────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    """Payload for POST /api/billing/checkout."""

    plan: str = Field(
        ...,
        description="Target plan: starter, growth, or scale",
    )
    success_url: str = Field(
        ...,
        description="URL to redirect after successful payment",
    )
    cancel_url: str = Field(
        ...,
        description="URL to redirect if user cancels checkout",
    )


class PortalRequest(BaseModel):
    """Payload for POST /api/billing/portal."""

    return_url: str = Field(
        ...,
        description="URL to redirect after leaving the customer portal",
    )


# ── Response models ──────────────────────────────────────────────────────────

class CheckoutResponse(BaseModel):
    """Response from POST /api/billing/checkout."""

    checkout_url: str = Field(..., description="Stripe checkout session URL")
    session_id: str = Field(..., description="Stripe checkout session ID")


class PortalResponse(BaseModel):
    """Response from POST /api/billing/portal."""

    portal_url: str = Field(..., description="Stripe customer portal URL")


class SubscriptionStatus(BaseModel):
    """Response from GET /api/billing/subscription."""

    plan: str = Field(..., description="Current plan: free, starter, growth, or scale")
    status: str = Field(
        ...,
        description="Subscription status: active, past_due, canceled, trialing, or none",
    )
    current_period_end: datetime | None = Field(
        default=None,
        description="End of the current billing period (UTC)",
    )
    cancel_at_period_end: bool = Field(
        default=False,
        description="Whether the subscription will cancel at period end",
    )
    stripe_subscription_id: str | None = Field(
        default=None,
        description="Stripe subscription ID for reference",
    )
    concurrent_sessions: int = Field(
        ...,
        description="Max concurrent sessions allowed on this plan",
    )
    ai_credits_included: float = Field(
        ...,
        description="AI credits (USD) included monthly",
    )


class PlanInfo(BaseModel):
    """Public info about a single plan."""

    name: str
    plan_key: str
    price_monthly: int
    concurrent_sessions: int
    ai_credits_included: float
