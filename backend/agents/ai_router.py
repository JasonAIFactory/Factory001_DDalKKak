"""
agents/ai_router.py — The AI Cost Router. DalkkakAI's secret weapon.

Every user request goes through this BEFORE any AI model is called.
Goal: use the cheapest option that can handle the task.

Routing order (COST.md rule #1):
  1. Zero-cost  — regex/DB/script ($0)
  2. Haiku      — classification, short answers ($0.001)
  3. Sonnet     — code gen, content, analysis ($0.10)
  4. Opus       — full builds, architecture ($0.80)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

import anthropic

from backend.config import settings

_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Model constants ───────────────────────────────────────────────────────────

class ModelTier(str, Enum):
    """Available model tiers. Cheapest first."""

    ZERO_COST = "zero_cost"   # No AI needed — direct DB query or script
    HAIKU = "haiku"           # claude-haiku-4-5-20251001  — $0.25/1M tokens
    SONNET = "sonnet"         # claude-sonnet-4-6          — $3/1M tokens
    OPUS = "opus"             # claude-opus-4-6            — $15/1M tokens


MODEL_IDS = {
    ModelTier.HAIKU: "claude-haiku-4-5-20251001",
    ModelTier.SONNET: "claude-sonnet-4-6",
    ModelTier.OPUS: "claude-opus-4-6",
}

MAX_TOKENS = {
    ModelTier.HAIKU: 500,     # Fast classification, short answers
    ModelTier.SONNET: 4000,   # Code gen, content
    ModelTier.OPUS: 8000,     # Full builds, complex architecture
}


# ── Task categories ───────────────────────────────────────────────────────────

class TaskCategory(str, Enum):
    """What kind of task the user request maps to."""

    # Zero-cost operations
    DEPLOY = "deploy"
    ROLLBACK = "rollback"
    RESTART = "restart"
    GET_METRICS = "get_metrics"
    GET_LOGS = "get_logs"
    CHANGE_SETTING = "change_setting"
    SEND_EMAIL = "send_email"
    CHECK_STATUS = "check_status"

    # Haiku operations
    ANSWER_QUESTION = "answer_question"
    CLASSIFY_TICKET = "classify_ticket"
    GENERATE_COPY = "generate_copy"
    SUMMARIZE_DATA = "summarize_data"
    AUTO_REPLY = "auto_reply"
    SEO_META = "seo_meta"

    # Sonnet operations
    GENERATE_CODE = "generate_code"
    FIX_BUG = "fix_bug"
    GENERATE_BLOG = "generate_blog"
    CREATE_CAMPAIGN = "create_campaign"
    ANALYZE_BUSINESS = "analyze_business"
    BUILD_LANDING = "build_landing"

    # Opus operations
    BUILD_STARTUP = "build_startup"
    ARCHITECT = "architect"
    MAJOR_REFACTOR = "major_refactor"
    COMPLEX_DEBUG = "complex_debug"


# Maps task category → model tier (from SPEC.md routing rules)
ROUTING_RULES: dict[TaskCategory, ModelTier] = {
    # Zero-cost
    TaskCategory.DEPLOY: ModelTier.ZERO_COST,
    TaskCategory.ROLLBACK: ModelTier.ZERO_COST,
    TaskCategory.RESTART: ModelTier.ZERO_COST,
    TaskCategory.GET_METRICS: ModelTier.ZERO_COST,
    TaskCategory.GET_LOGS: ModelTier.ZERO_COST,
    TaskCategory.CHANGE_SETTING: ModelTier.ZERO_COST,
    TaskCategory.SEND_EMAIL: ModelTier.ZERO_COST,
    TaskCategory.CHECK_STATUS: ModelTier.ZERO_COST,

    # Haiku
    TaskCategory.ANSWER_QUESTION: ModelTier.HAIKU,
    TaskCategory.CLASSIFY_TICKET: ModelTier.HAIKU,
    TaskCategory.GENERATE_COPY: ModelTier.HAIKU,
    TaskCategory.SUMMARIZE_DATA: ModelTier.HAIKU,
    TaskCategory.AUTO_REPLY: ModelTier.HAIKU,
    TaskCategory.SEO_META: ModelTier.HAIKU,

    # Sonnet
    TaskCategory.GENERATE_CODE: ModelTier.SONNET,
    TaskCategory.FIX_BUG: ModelTier.SONNET,
    TaskCategory.GENERATE_BLOG: ModelTier.SONNET,
    TaskCategory.CREATE_CAMPAIGN: ModelTier.SONNET,
    TaskCategory.ANALYZE_BUSINESS: ModelTier.SONNET,
    TaskCategory.BUILD_LANDING: ModelTier.SONNET,

    # Opus
    TaskCategory.BUILD_STARTUP: ModelTier.OPUS,
    TaskCategory.ARCHITECT: ModelTier.OPUS,
    TaskCategory.MAJOR_REFACTOR: ModelTier.OPUS,
    TaskCategory.COMPLEX_DEBUG: ModelTier.OPUS,
}


# ── Zero-cost pattern matching ────────────────────────────────────────────────
# Check these BEFORE spending any tokens on AI classification.

_ZERO_COST_PATTERNS: list[tuple[re.Pattern, TaskCategory]] = [
    (re.compile(r"\b(deploy|push to prod|ship it|go live)\b", re.I), TaskCategory.DEPLOY),
    (re.compile(r"\b(rollback|revert|undo deploy)\b", re.I), TaskCategory.ROLLBACK),
    (re.compile(r"\b(restart|reboot|reload)\b", re.I), TaskCategory.RESTART),
    (re.compile(r"\b(metrics|revenue|mrr|arr|users|signups|churn)\b", re.I), TaskCategory.GET_METRICS),
    (re.compile(r"\b(logs|errors|exceptions|traceback)\b", re.I), TaskCategory.GET_LOGS),
    (re.compile(r"\b(setting|config|env|variable|key)\b", re.I), TaskCategory.CHANGE_SETTING),
    (re.compile(r"\b(send email|email blast|newsletter)\b", re.I), TaskCategory.SEND_EMAIL),
    (re.compile(r"\b(status|uptime|health|is.*down|is.*up)\b", re.I), TaskCategory.CHECK_STATUS),
]


@dataclass
class RouteResult:
    """Result of routing a user request."""

    category: TaskCategory
    tier: ModelTier
    model_id: str | None          # None for zero-cost
    max_tokens: int | None        # None for zero-cost
    estimated_cost_usd: float     # Rough estimate before calling


def route_request(user_input: str) -> RouteResult | None:
    """
    Step 1: Try zero-cost pattern matching.
    Returns a RouteResult if matched, None if needs AI classification.

    This prevents wasting $0.001 on Haiku classification for obvious
    commands like "deploy" or "show me my revenue".
    """
    text = user_input.strip()

    for pattern, category in _ZERO_COST_PATTERNS:
        if pattern.search(text):
            return RouteResult(
                category=category,
                tier=ModelTier.ZERO_COST,
                model_id=None,
                max_tokens=None,
                estimated_cost_usd=0.0,
            )
    return None


async def classify_with_haiku(user_input: str, context: dict) -> TaskCategory:
    """
    Step 2: Use Haiku to classify ambiguous requests.
    Cost: ~$0.001 per call (50 tokens in, 5 tokens out).

    Returns the best-matching TaskCategory.
    """
    categories = ", ".join(c.value for c in TaskCategory)

    response = await _client.messages.create(
        model=MODEL_IDS[ModelTier.HAIKU],
        max_tokens=20,
        system=(
            "You classify user requests into one of these categories:\n"
            f"{categories}\n\n"
            "Reply with ONLY the category name. No explanation."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Startup: {context.get('startup_name', 'unknown')}\n"
                    f"Request: {user_input}"
                ),
            }
        ],
    )

    raw = response.content[0].text.strip().lower()

    # Match to a valid category
    for category in TaskCategory:
        if category.value == raw:
            return category

    # Default: generate_code (Sonnet) — safe fallback for ambiguous requests
    return TaskCategory.GENERATE_CODE


async def get_model_for_request(user_input: str, context: dict) -> RouteResult:
    """
    Full routing pipeline:
    1. Try zero-cost pattern match ($0)
    2. If ambiguous → classify with Haiku ($0.001)
    3. Return the model + estimated cost

    This is the entry point called by all API endpoints that need AI.
    """
    # Step 1: Zero-cost check
    zero_cost = route_request(user_input)
    if zero_cost:
        return zero_cost

    # Step 2: Haiku classification
    category = await classify_with_haiku(user_input, context)
    tier = ROUTING_RULES.get(category, ModelTier.SONNET)

    if tier == ModelTier.ZERO_COST:
        return RouteResult(
            category=category,
            tier=tier,
            model_id=None,
            max_tokens=None,
            estimated_cost_usd=0.0,
        )

    model_id = MODEL_IDS[tier]
    max_tokens = MAX_TOKENS[tier]

    # Rough cost estimates (input tokens ~200, varies by tier)
    cost_per_million = {ModelTier.HAIKU: 0.25, ModelTier.SONNET: 3.0, ModelTier.OPUS: 15.0}
    estimated_cost = (200 / 1_000_000) * cost_per_million[tier]

    return RouteResult(
        category=category,
        tier=tier,
        model_id=model_id,
        max_tokens=max_tokens,
        estimated_cost_usd=estimated_cost,
    )
