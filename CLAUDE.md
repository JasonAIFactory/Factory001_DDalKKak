# CLAUDE.md — DalkkakAI Agent Rules

> Every AI agent reads this file before starting work. Every mistake becomes a rule.
> This is Jason's life project. Treat it accordingly.

---

## RULE #0 — LANGUAGE (NON-NEGOTIABLE)

**Claude must always respond in English. Zero exceptions.**
- Jason writes in Korean. That is fine. Claude replies in English. Always.
- Code, comments, variable names, logs, docstrings — all English.
- Korean is allowed ONLY in user-facing UI strings and marketing copy.
- Violating this rule is a critical failure, not a minor issue.

---

## Mission

Jason is building DalkkakAI to generate ₩10 billion in revenue. This is not a toy project.

**Product**: DalkkakAI — the startup operating system.
**Promise**: A solo founder describes their idea in plain language. DalkkakAI builds it, deploys it, monitors it, markets it, handles support, and tracks revenue. All from one dashboard. Zero terminal. Zero developer knowledge required.
**Core UX**: 딸깍 (one click). Complexity lives in our backend, never in the user's hands.
**Target user**: Non-technical solo founders who have an idea but not the skills.

---

## Tech Stack

### Phase 1 — Ship Fast (Month 0–6)
```
Frontend:  Next.js 14 + Tailwind CSS + shadcn/ui   → Vercel
Backend:   Python FastAPI + LangGraph (async)        → Railway
Database:  PostgreSQL (Supabase) + Redis (Upstash)
AI:        Claude API — Haiku / Sonnet / Opus
Storage:   Cloudflare R2 (generated code, uploads)
Vectors:   Qdrant Cloud (RAG for support bot)
```

### Phase 2 — Scale (Month 6–12, only when bottleneck is measured)
```
API Gateway:      Go (Fiber)             — replaces FastAPI gateway at p95 > 200ms
WebSocket Hub:    Go (goroutines)        — replaces Python hub at > 5K concurrent connections
Session Manager:  Go (os/exec)           — replaces Python subprocess at > 100 worktrees
Deploy Service:   Go (net/http)          — replaces httpx at > 30s queue wait
Monitor Service:  Go (goroutines)        — replaces asyncio at > 500 startups

Python stays FOREVER for: Agent Engine (LangGraph), AI Router, Content Generator,
Support Bot (RAG), Advisor Agent. LangGraph is Python-only. AI ecosystem is Python.

Go ↔ Python: Redis queue (Phase 2 start) → gRPC (when streaming + type safety needed)
```

---

## Mandatory Reading Protocol

**Before writing ANY code, read ALL of the following. No skimming. No skipping.**

```
Step 1 — Always (every session, no exceptions):
  CLAUDE.md   ← You are here
  docs/SPEC.md ← Master architecture, ALL data models, ALL API contracts

Step 2 — Always (list then read ALL files in docs/):
  ls docs/*.md → then read EVERY file fully.
  There are currently 11 docs. Read all 11.
  New docs may be added — the ls step catches them automatically.

  docs/AGENTS.md        — 7 agent types, model assignments, context budgets
  docs/COST.md          — cost hierarchy, zero-cost ops, caching, budget alerts
  docs/SESSIONS.md      — session lifecycle, worktrees, queue, UI spec, WebSocket events
  docs/SESSION_RULES.md — module-based parallel session architecture (READ THIS ALWAYS)
  docs/DEPLOY.md        — deployment flow, stack detection, health checks, rollback
  docs/MONITORING.md    — uptime, alerts, auto-heal rules
  docs/BILLING.md       — Stripe layers (DalkkakAI billing + user's startup billing)
  docs/ANALYTICS.md     — metrics, data model, AI insights via Haiku
  docs/MARKETING.md     — landing page, SEO, email sequences, ad campaigns, safety rules
  docs/SUPPORT.md       — RAG knowledge base, ticket flow, escalation, chat widget
```

**Why read all docs?**
Skipping any doc has caused real bugs. Missing SPEC.md caused wrong stack claims (Go).
The full docs/ is ~25KB. That is less than 3% of Claude's context window. Read it all.

**What NOT to do:**
- Do NOT skim. Do NOT assume. Do NOT rely on memory from prior sessions.
- Do NOT invent data models — SPEC.md defines them exactly.
- Do NOT invent API endpoints — feature docs define them exactly.
- Do NOT modify docs/ without explicit instruction from Jason.

---

## Product Architecture (summary — full details in SPEC.md + feature docs)

Every user request flows through:
```
User input → Router Agent (Haiku, $0.002) → one of:
  Zero-cost handler  (DB query, script, template)   = $0
  Haiku agent        (classify, summarize, reply)    = ~$0.005
  Sonnet agent       (code, content, analysis)       = ~$0.10
  Opus agent         (full build, architecture)      = ~$0.80
```

Agents (7 types — see AGENTS.md for full boundaries):
- **Router**: every request, Haiku, < 500ms, < $0.002
- **Build**: full startup generation, Opus → then Sonnet for features
- **Feature**: add to existing code, Sonnet, branch-per-session, max 10 files
- **Fix**: debug + repair, Sonnet first → Opus if Sonnet fails
- **Marketing**: content generation, Haiku (short) / Sonnet (long), never code
- **Support**: ticket auto-resolution, Haiku + RAG, escalate angry/refund cases
- **Advisor**: read-only business insights, Haiku (quick) / Sonnet (weekly report)

Sessions = isolated AI work units. Each gets its own git worktree + branch.
Queue is concurrency-aware: Free=1, Starter=2, Growth=5, Scale=10 parallel sessions.
When session finishes: auto-test → if tests pass → auto-preview Docker URL → user clicks.

### Session Module Rules (full detail in docs/SESSION_RULES.md — READ THAT FILE)

These 7 rules MUST be followed when planning or creating sessions:

```
Rule 1 — Split by MODULE, not by feature.
  WRONG: Session 1 "add login" + Session 2 "add register" → both touch auth/router.py → CONFLICT
  RIGHT: Session 1 "Auth module" OWNS backend/auth/* → zero conflicts

Rule 2 — Each session OWNS a directory. No two sessions touch the same files.
  Session owns: one or more directories + their model files.
  Example: Auth session owns backend/auth/* + backend/models/user.py

Rule 3 — Shared files (main.py, database.py, config.py) are pre-defined by orchestrator.
  Sessions ADD lines (new imports, dependencies). Sessions never MODIFY existing lines.
  Git auto-merges parallel additions cleanly.

Rule 4 — Interfaces before implementation.
  Define contracts in SPEC.md BEFORE sessions start. Sessions use the pre-defined interfaces.
  Example: Auth defines get_current_user(). Projects imports it without touching auth/.

Rule 5 — Session count: 3-5 sessions is the sweet spot.
  Full build: 3-4 sessions. Major feature: 2-3. Small fix: 1 session.
  Never more than 5 concurrent sessions — coordination overhead kills speed.

Rule 6 — Every session gets a preview URL after tests pass.
  Branch finishes → auto-deploy to staging → URL shown in session box → user clicks to test.

Rule 7 — Merge order: dependencies first.
  1. Core (auth, models, config) → 2. Features (projects, agents) → 3. Frontend
  Run integration tests after ALL merges. Rollback if tests fail.
```

---

## AI Cost Rules (CRITICAL — see COST.md for full detail)

1. Zero-cost first: DB query, cached result, template, regex. Never use AI for metrics.
2. Haiku for: classification, short answers, auto-replies, email subjects, SEO meta.
3. Sonnet for: code generation, blog posts, ad copy, business analysis.
4. Opus ONLY for: initial full startup build, architecture decisions, major refactors.
5. Cache AI responses: same input = return cached output. TTL: 1h classification, 24h content.
6. Log every AI call: model, tokens_in, tokens_out, cost_usd, duration_ms, cached.
7. Per-session cost limit: auto-pause at $5. Warn user at $2.
8. Set max_tokens correctly. Never send 4096 when 300 is enough.
9. Batch: do not make 10 Haiku calls when 1 Sonnet call covers it.
10. NEVER default to Opus. Start cheap. Escalate only when cheaper model fails.

---

## Code Standards

### Python (FastAPI backend)
- Python 3.11+, `from __future__ import annotations`, async everywhere
- FastAPI + Pydantic v2 + SQLAlchemy 2.0 async
- Type hints on every function. No exceptions.
- snake_case for files/functions/variables. PascalCase for classes.
- Never let exceptions reach the user — catch, log, return `{"ok": false, "error": "..."}`.
- Use `httpx` for async HTTP. Never `requests` in async context.
- Imports order: stdlib → third-party → local, blank line between each group.

### TypeScript (Next.js frontend)
- Next.js 14 App Router (`app/` directory). Server components by default.
- `"use client"` only when strictly needed.
- Tailwind CSS only. No CSS modules. No styled-components.
- shadcn/ui for all UI components.
- No `any` types. Proper interfaces for everything.

### Both
- Max 300 lines per file. Split before hitting the limit.
- Every function has a docstring: WHAT it does and WHY it exists.
- UTF-8 everywhere. English in all code artifacts.

---

## API Contract

```
Success: { "ok": true,  "data": {...} }
Error:   { "ok": false, "error": "Human message", "code": "SNAKE_CODE" }
Pagination: ?page=1&limit=20 → { "data": [], "total": N, "page": 1 }
All IDs: UUID. All timestamps: ISO 8601 UTC. Auth: Bearer token.
```

---

## Database Rules

- Alembic migrations always. Never touch schema directly.
- All tables: `id` (UUID PK), `created_at`, `updated_at`.
- Soft delete only: `deleted_at` column. Never `DELETE FROM`.
- Every FK has explicit `ON DELETE` behavior.
- Index every column used in `WHERE` clauses.

---

## Security Rules

- Never log: passwords, tokens, API keys, PII.
- Never commit `.env` files.
- Never expose Python tracebacks to users — catch and format.
- Rate limit: 100 req/min (authenticated), 10 req/min (public).
- Validate all user input with Pydantic. Trust nothing from outside.
- CORS: whitelist only `dalkkak.ai` and `localhost:3000`.

---

## Git & Testing

```
Branches:  feat/name | fix/name | chore/name
Commits:   type: short description  (e.g., feat: add session queue worker)
Tests:     pytest + asyncio. Every endpoint: 1 success + 1 error case minimum.
Test files: test_{module}.py
main branch is always deployable. Never commit broken code.
```

---

## Common Mistakes (every one of these has burned us before)

- DON'T use `localhost` in config — use environment variables
- DON'T hardcode ports — use `PORT` env var
- DON'T skip error handling on GitHub/Railway/Stripe calls
- DON'T assume DB is available — handle connection errors
- DON'T create circular imports — use dependency injection
- DON'T send full codebase to AI context — send only relevant files
- DON'T use synchronous HTTP in async FastAPI — use `httpx`
- DON'T forget CORS middleware — frontend fails silently without it
- DON'T store generated files in DB — use Cloudflare R2
- DON'T claim something isn't in the stack without reading SPEC.md fully (Go mistake)

---

## Learning Log Protocol (every session — no exceptions)

```
Logs live in: logs/learning/YYYY-MM-DD.md | logs/english/YYYY-MM-DD.md
              logs/troubleshooting/YYYY-MM-DD_topic.md

START of session:
  → Check if today's learning + english log files exist. Create if missing.

DURING session:
  → New concept / decision → append to logs/learning/YYYY-MM-DD.md
  → Jason writes awkward English → correct it in logs/english/YYYY-MM-DD.md
  → Bug solved → create logs/troubleshooting/YYYY-MM-DD_topic.md

END of session:
  → git add logs/ && git commit -m "logs: YYYY-MM-DD"

Limits: learning max 150 lines/day | english max 100 lines/day | troubleshooting max 80 lines
Format: #### Entry title — YYYY-MM-DD / Said: / Fix: / Why:
```
