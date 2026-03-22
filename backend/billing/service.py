"""
billing/service.py — Business logic for Stripe billing integration.

Handles creating Stripe customers, checkout sessions, portal sessions,
and processing webhook events for subscription lifecycle management.
All Stripe API calls are async-safe via stripe's built-in support.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import stripe
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models.user import User

from .schemas import (
    CheckoutResponse,
    PLAN_CONFIGS,
    PortalResponse,
    SubscriptionStatus,
    VALID_PLANS,
)

logger = logging.getLogger(__name__)

# ── Stripe configuration ────────────────────────────────────────────────────

stripe.api_key = settings.STRIPE_SECRET_KEY

# Map plan names to Stripe price IDs.
# These must be created in Stripe Dashboard and set as env vars.
_STRIPE_PRICE_MAP: dict[str, str] = {}


def _get_stripe_price_id(plan: str) -> str:
    """
    Look up the Stripe price ID for a plan.
    Price IDs are read from environment at import time — we use a lazy
    approach so tests can override settings before first call.
    """
    if not _STRIPE_PRICE_MAP:
        # Lazy-load from env-based config attrs if available
        _STRIPE_PRICE_MAP["starter"] = getattr(
            settings, "STRIPE_PRICE_STARTER", ""
        )
        _STRIPE_PRICE_MAP["growth"] = getattr(
            settings, "STRIPE_PRICE_GROWTH", ""
        )
        _STRIPE_PRICE_MAP["scale"] = getattr(
            settings, "STRIPE_PRICE_SCALE", ""
        )

    price_id = _STRIPE_PRICE_MAP.get(plan, "")
    if not price_id:
        raise ValueError(f"No Stripe price ID configured for plan: {plan}")
    return price_id


# ── Customer management ─────────────────────────────────────────────────────

async def get_or_create_stripe_customer(
    db: AsyncSession,
    user: User,
) -> str:
    """
    Ensure the user has a Stripe customer ID. Creates one if missing.
    Returns the stripe_customer_id string.
    """
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"dalkkak_user_id": str(user.id)},
    )

    user.stripe_customer_id = customer.id
    await db.flush()

    logger.info(
        "Created Stripe customer %s for user %s",
        customer.id,
        user.id,
    )
    return customer.id


# ── Checkout ─────────────────────────────────────────────────────────────────

async def create_checkout_session(
    db: AsyncSession,
    user: User,
    plan: str,
    success_url: str,
    cancel_url: str,
) -> CheckoutResponse:
    """
    Create a Stripe Checkout Session for upgrading to a paid plan.
    Returns a URL that the frontend redirects the user to.
    """
    if plan not in VALID_PLANS or plan == "free":
        raise ValueError(
            f"Invalid checkout plan: {plan}. Must be starter, growth, or scale."
        )

    customer_id = await get_or_create_stripe_customer(db, user)
    price_id = _get_stripe_price_id(plan)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "dalkkak_user_id": str(user.id),
            "plan": plan,
        },
        subscription_data={
            "metadata": {
                "dalkkak_user_id": str(user.id),
                "plan": plan,
            },
        },
    )

    logger.info(
        "Created checkout session %s for user %s, plan=%s",
        session.id,
        user.id,
        plan,
    )

    return CheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
    )


# ── Customer portal ─────────────────────────────────────────────────────────

async def create_portal_session(
    db: AsyncSession,
    user: User,
    return_url: str,
) -> PortalResponse:
    """
    Create a Stripe Customer Portal session.
    Lets users manage their subscription, update payment method, cancel, etc.
    """
    customer_id = await get_or_create_stripe_customer(db, user)

    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )

    logger.info(
        "Created portal session for user %s (customer %s)",
        user.id,
        customer_id,
    )

    return PortalResponse(portal_url=portal.url)


# ── Subscription status ─────────────────────────────────────────────────────

async def get_subscription_status(
    db: AsyncSession,
    user: User,
) -> SubscriptionStatus:
    """
    Fetch the current subscription status for a user.
    If the user has no Stripe customer or no active subscription,
    returns the free plan defaults.
    """
    plan_config = PLAN_CONFIGS.get(user.plan, PLAN_CONFIGS["free"])

    if not user.stripe_customer_id:
        return SubscriptionStatus(
            plan=user.plan,
            status="none",
            current_period_end=None,
            cancel_at_period_end=False,
            stripe_subscription_id=None,
            concurrent_sessions=plan_config["concurrent_sessions"],
            ai_credits_included=plan_config["ai_credits_included"],
        )

    # Fetch active subscriptions from Stripe
    subscriptions = stripe.Subscription.list(
        customer=user.stripe_customer_id,
        status="all",
        limit=1,
    )

    if not subscriptions.data:
        return SubscriptionStatus(
            plan=user.plan,
            status="none",
            current_period_end=None,
            cancel_at_period_end=False,
            stripe_subscription_id=None,
            concurrent_sessions=plan_config["concurrent_sessions"],
            ai_credits_included=plan_config["ai_credits_included"],
        )

    sub = subscriptions.data[0]
    period_end = datetime.fromtimestamp(
        sub.current_period_end, tz=timezone.utc
    )

    return SubscriptionStatus(
        plan=user.plan,
        status=sub.status,
        current_period_end=period_end,
        cancel_at_period_end=sub.cancel_at_period_end,
        stripe_subscription_id=sub.id,
        concurrent_sessions=plan_config["concurrent_sessions"],
        ai_credits_included=plan_config["ai_credits_included"],
    )


# ── Webhook processing ──────────────────────────────────────────────────────

async def handle_checkout_completed(
    db: AsyncSession,
    session_data: dict,
) -> None:
    """
    Handle checkout.session.completed webhook event.
    Updates the user's plan based on the checkout metadata.
    """
    metadata = session_data.get("metadata", {})
    user_id = metadata.get("dalkkak_user_id")
    plan = metadata.get("plan")

    if not user_id or not plan:
        logger.warning(
            "Checkout completed but missing metadata: user_id=%s plan=%s",
            user_id,
            plan,
        )
        return

    if plan not in VALID_PLANS:
        logger.warning("Checkout completed with invalid plan: %s", plan)
        return

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(plan=plan)
    )
    await db.flush()

    logger.info(
        "User %s upgraded to plan %s via checkout",
        user_id,
        plan,
    )


async def handle_subscription_updated(
    db: AsyncSession,
    subscription_data: dict,
) -> None:
    """
    Handle customer.subscription.updated webhook event.
    Syncs plan changes (upgrades/downgrades) from Stripe to our DB.
    """
    metadata = subscription_data.get("metadata", {})
    user_id = metadata.get("dalkkak_user_id")
    plan = metadata.get("plan")
    status = subscription_data.get("status")

    if not user_id:
        logger.warning(
            "Subscription updated but missing dalkkak_user_id in metadata"
        )
        return

    # If subscription is canceled or unpaid, downgrade to free
    if status in ("canceled", "unpaid"):
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(plan="free")
        )
        await db.flush()
        logger.info("User %s downgraded to free (status=%s)", user_id, status)
        return

    # Otherwise sync the plan from metadata
    if plan and plan in VALID_PLANS:
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(plan=plan)
        )
        await db.flush()
        logger.info("User %s plan synced to %s", user_id, plan)


async def handle_subscription_deleted(
    db: AsyncSession,
    subscription_data: dict,
) -> None:
    """
    Handle customer.subscription.deleted webhook event.
    Downgrades the user to the free plan.
    """
    metadata = subscription_data.get("metadata", {})
    user_id = metadata.get("dalkkak_user_id")

    if not user_id:
        logger.warning(
            "Subscription deleted but missing dalkkak_user_id in metadata"
        )
        return

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(plan="free")
    )
    await db.flush()

    logger.info("User %s downgraded to free (subscription deleted)", user_id)


async def handle_invoice_payment_failed(
    db: AsyncSession,
    invoice_data: dict,
) -> None:
    """
    Handle invoice.payment_failed webhook event.
    Logs the failure. Stripe retries automatically; if all retries fail,
    the subscription status changes and handle_subscription_updated catches it.
    """
    customer_id = invoice_data.get("customer")
    attempt_count = invoice_data.get("attempt_count", 0)
    amount_due = invoice_data.get("amount_due", 0)

    logger.warning(
        "Payment failed for customer %s: attempt=%d amount=%d cents",
        customer_id,
        attempt_count,
        amount_due,
    )
    # Future: send email notification to user about payment failure
