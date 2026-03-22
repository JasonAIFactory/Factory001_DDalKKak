"""
billing/router.py — Billing API endpoints for DalkkakAI platform subscriptions.

Routes:
    POST  /api/billing/checkout      → create Stripe checkout session
    POST  /api/billing/webhook       → handle Stripe webhook events
    GET   /api/billing/subscription  → get current subscription status
    POST  /api/billing/portal        → create Stripe customer portal link
    GET   /api/billing/plans         → list available plans and pricing
"""

from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.models.user import User

from .schemas import (
    CheckoutRequest,
    PLAN_CONFIGS,
    PlanInfo,
    PortalRequest,
    VALID_PLANS,
)
from .service import (
    create_checkout_session,
    create_portal_session,
    get_subscription_status,
    handle_checkout_completed,
    handle_invoice_payment_failed,
    handle_subscription_deleted,
    handle_subscription_updated,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ── Checkout ─────────────────────────────────────────────────────────────────

@router.post("/checkout", response_model=dict)
async def checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a Stripe Checkout Session for plan upgrade.
    Returns a checkout URL that the frontend redirects the user to.
    """
    if body.plan not in VALID_PLANS or body.plan == "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan. Choose starter, growth, or scale.",
        )

    if body.plan == current_user.plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already on the {body.plan} plan.",
        )

    try:
        result = await create_checkout_session(
            db=db,
            user=current_user,
            plan=body.plan,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except stripe.StripeError as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service temporarily unavailable. Please try again.",
        ) from e

    return {
        "ok": True,
        "data": result.model_dump(),
    }


# ── Webhook ──────────────────────────────────────────────────────────────────

@router.post("/webhook", response_model=dict)
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Handle incoming Stripe webhook events.
    Verifies the webhook signature before processing.
    No auth required — Stripe calls this directly.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature header",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        logger.warning("Invalid webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload",
        )
    except stripe.SignatureVerificationError:
        logger.warning("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    event_type = event["type"]
    event_data = event["data"]["object"]

    logger.info("Received Stripe webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        await handle_checkout_completed(db, event_data)

    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(db, event_data)

    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(db, event_data)

    elif event_type == "invoice.payment_failed":
        await handle_invoice_payment_failed(db, event_data)

    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)

    return {"ok": True}


# ── Subscription status ─────────────────────────────────────────────────────

@router.get("/subscription", response_model=dict)
async def subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get the current user's subscription status and plan details.
    Works for both free and paid users.
    """
    try:
        result = await get_subscription_status(db, current_user)
    except stripe.StripeError as e:
        logger.error("Stripe subscription query error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service temporarily unavailable.",
        ) from e

    return {
        "ok": True,
        "data": result.model_dump(),
    }


# ── Customer portal ─────────────────────────────────────────────────────────

@router.post("/portal", response_model=dict)
async def portal(
    body: PortalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a Stripe Customer Portal session.
    Users can manage billing, update payment method, cancel subscription.
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Subscribe to a plan first.",
        )

    try:
        result = await create_portal_session(
            db=db,
            user=current_user,
            return_url=body.return_url,
        )
    except stripe.StripeError as e:
        logger.error("Stripe portal error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service temporarily unavailable.",
        ) from e

    return {
        "ok": True,
        "data": result.model_dump(),
    }


# ── Plans listing ────────────────────────────────────────────────────────────

@router.get("/plans", response_model=dict)
async def list_plans() -> dict:
    """
    List all available plans with pricing info.
    Public endpoint — no auth required.
    """
    plans = [
        PlanInfo(
            name=config["name"],
            plan_key=key,
            price_monthly=config["price_monthly"],
            concurrent_sessions=config["concurrent_sessions"],
            ai_credits_included=config["ai_credits_included"],
        )
        for key, config in PLAN_CONFIGS.items()
    ]

    return {
        "ok": True,
        "data": [p.model_dump() for p in plans],
    }
