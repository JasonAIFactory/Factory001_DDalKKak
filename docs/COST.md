# COST.md — AI Cost Strategy

> Rule #1: The best AI call is the one you never make.

## Cost Hierarchy (always try in this order)

```
1. Can I answer this WITHOUT AI?
   → DB query, cached response, template, regex, static rule
   → Cost: $0
   → Example: "What's my MRR?" → SELECT SUM(amount) FROM payments

2. Can I answer this with a TEMPLATE + variables?
   → Pre-written response with dynamic data inserted
   → Cost: $0
   → Example: "Send welcome email" → template + user.name + user.email

3. Can I use the CHEAPEST model?
   → Haiku for classification, short text, yes/no decisions
   → Cost: ~$0.005 per call
   → Example: "Is this support ticket about billing?" → Haiku classifies

4. Do I need real generation?
   → Sonnet for code, content, analysis
   → Cost: ~$0.10 per call
   → Example: "Add a pricing page to my app" → Sonnet generates code

5. Is this a MAJOR architectural task?
   → Opus only for complex multi-file reasoning
   → Cost: ~$0.50 per call
   → Example: "Build me a restaurant review SaaS from scratch"
```

## Zero-Cost Operations (NEVER use AI for these)

| Operation | Implementation | Why |
|-----------|---------------|-----|
| Show MRR/revenue | SQL query on payments table | Simple aggregation |
| Show user count | SQL COUNT on users table | Simple query |
| Show uptime | Ping health endpoint | HTTP check |
| Deploy | GitHub push + Railway webhook | Script |
| Rollback | Railway API rollback | API call |
| Restart service | Railway API restart | API call |
| Show logs | Read from log storage | File/API read |
| Change settings | DB UPDATE | Direct write |
| Send templated email | Resend API + template | No generation needed |
| Show activity feed | Query events table | SQL query |
| Authentication | JWT validation | Standard library |
| File listing | Git API | Direct API |

## Caching Strategy

```
Cache Layer 1: In-memory (Redis)
  - User session data (TTL: 1 hour)
  - Dashboard metrics (TTL: 5 minutes)
  - AI classification results (TTL: 1 hour)

Cache Layer 2: Response cache
  - Identical AI queries → return cached response
  - Hash the input → check cache → return if exists
  - TTL: 24 hours for content, 1 hour for analysis

Cache Layer 3: Pre-computed
  - Daily metrics computed by cron job at midnight
  - Weekly reports generated once, stored
  - SEO meta tags generated once per page, cached indefinitely
```

## Smart Classification (the $0.001 gatekeeper)

Before any expensive AI call, use Haiku to classify the intent:

```python
CLASSIFY_PROMPT = """
Classify this user request into one category:
- QUERY: asking for data/metrics (use database)
- ACTION: deploy, restart, rollback (use scripts)
- SETTING: change configuration (use database)
- GENERATE: needs AI to create content/code
- QUESTION: needs AI to answer/explain

Request: "{user_input}"
Category:
"""

# Cost of classification: ~$0.001 (50 input tokens, 5 output tokens)
# Savings: prevents $0.10+ Sonnet calls for simple DB queries
```

## Budget Alerts

```
Per-user monthly AI budget:
  Free plan:    $1.00 (roughly 10 Sonnet calls)
  Starter:      $5.00 (roughly 50 Sonnet calls)
  Growth:       $15.00 (roughly 150 Sonnet calls)
  Scale:        $50.00 (roughly 500 Sonnet calls)

When user hits 80% budget:
  → Show warning: "You've used 80% of your AI credits this month"
  → Automatically downgrade to Haiku for non-critical tasks
  
When user hits 100%:
  → Zero-cost operations continue working
  → AI generation paused until next billing cycle
  → User can buy additional credits
```

## Model Selection Matrix

| Task | Model | Max Tokens | Est. Cost | Cache? |
|------|-------|-----------|-----------|--------|
| Classify intent | Haiku | 50 | $0.001 | Yes (1h) |
| Answer simple question | Haiku | 200 | $0.005 | Yes (1h) |
| Auto-reply to support | Haiku | 300 | $0.008 | No |
| Generate email subject | Haiku | 50 | $0.002 | Yes (24h) |
| Generate blog post | Sonnet | 2000 | $0.12 | Yes (24h) |
| Generate ad copy | Sonnet | 500 | $0.04 | Yes (24h) |
| Generate feature code | Sonnet | 4000 | $0.15 | No |
| Fix bug | Sonnet | 2000 | $0.10 | No |
| Business analysis | Sonnet | 1000 | $0.08 | Yes (1h) |
| Build full startup | Opus | 8000 | $0.80 | No |
| Architecture decision | Opus | 4000 | $0.50 | No |

## Tracking

Every AI call is logged:

```python
ai_usage_log = {
    "user_id": "uuid",
    "startup_id": "uuid", 
    "model": "haiku|sonnet|opus",
    "task_type": "classify|generate|analyze|build",
    "tokens_in": 150,
    "tokens_out": 500,
    "cost_usd": 0.008,
    "duration_ms": 1200,
    "cached": False,
    "timestamp": "2026-03-16T14:32:00Z"
}
```

This data powers:
- User-facing "AI credits used" meter
- Internal cost dashboard
- Model routing optimization (if Haiku handles 95% of task X correctly, stop using Sonnet)
- Billing accuracy
