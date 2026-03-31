<p align="center">
  <h1 align="center">DalkkakAI — The Startup Operating System</h1>
  <p align="center">
    <em>Describe your startup. Click once. We build, deploy, monitor, market, and bill — all from one dashboard.</em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white" alt="Next.js 14"/>
  <img src="https://img.shields.io/badge/Claude_API-Haiku%20%7C%20Sonnet%20%7C%20Opus-8B5CF6?logo=anthropic&logoColor=white" alt="Claude API"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/Stripe-billing-635BFF?logo=stripe&logoColor=white" alt="Stripe"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/>
</p>

---

## Overview

**DalkkakAI** is a full-stack AI platform that turns a natural-language startup description into a running, deployed web application — with monitoring, marketing, billing, and support baked in. The target user is a non-technical solo founder who has never opened a terminal.

The name comes from the Korean word **딸깍** — the sound of a single click. That is the entire user experience: one click, and the complexity disappears into our backend.

### How it differs from Devin / Cursor / Copilot Workspace

| | Devin / Cursor / Copilot | **DalkkakAI** |
|---|---|---|
| **Audience** | Developers writing code | Non-technical founders running a business |
| **Scope** | Code generation + editing | Code + Deploy + Monitor + Market + Bill + Support |
| **Session model** | Single sequential context | Parallel isolated sessions with git worktree branches |
| **Cost control** | Flat subscription | Per-request AI cost routing: $0 ops first, Haiku ($0.005), Sonnet ($0.10), Opus ($0.80) |
| **Output** | Code diffs | Running app at a live URL, with analytics dashboard |
| **Terminal required** | Yes | Never — or optionally via in-browser terminal |

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                            │
│           Next.js 14 + Tailwind CSS + shadcn/ui              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Landing   │ │Dashboard │ │ Session  │ │ Terminal │        │
│  │ Page      │ │ (i18n)   │ │ Detail   │ │ (xterm)  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└──────────────────┬─────────────────────────┬─────────────────┘
                   │ REST API                │ WebSocket
                   ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│               FASTAPI BACKEND (async, Python 3.11)           │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │ Auth   │ │ Startups │ │ Sessions │ │ AI Cost Router    │ │
│  │ (JWT)  │ │ (CRUD)   │ │ (Queue)  │ │ (zero→haiku→     │ │
│  │        │ │          │ │          │ │  sonnet→opus)     │ │
│  └────────┘ └──────────┘ └──────────┘ └────────┬──────────┘ │
│  ┌────────┐ ┌──────────┐ ┌──────────┐          │            │
│  │Billing │ │ Deploy   │ │ Terminal │   ┌──────▼──────┐     │
│  │(Stripe)│ │ Service  │ │ (PTY)   │   │ Agent       │     │
│  └────────┘ └──────────┘ └──────────┘   │ Executor    │     │
│  ┌────────────────────────────────────┐  │ (ReAct loop)│     │
│  │ WebSocket Hub — real-time events   │  └──────┬──────┘     │
│  └────────────────────────────────────┘         │            │
└────────┬──────────┬──────────┬──────────┬───────┤────────────┘
         │          │          │          │       │
         ▼          ▼          ▼          ▼       ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐
    │Postgres│ │ Redis  │ │ Docker │ │Claude│ │ GitHub │
    │   16   │ │   7    │ │ Socket │ │ API  │ │  API   │
    └────────┘ └────────┘ └────────┘ └──────┘ └────────┘
```

### Data Flow: User Request → Live App

```
User types: "Build me a restaurant review SaaS"
  │
  ▼
Router Agent (Haiku, ~$0.002, <500ms)
  → Classifies intent → "build_startup" → selects Opus
  │
  ▼
Session Queue (concurrency-aware, plan-based limits)
  → Free: 1 slot │ Starter: 2 │ Growth: 5 │ Scale: 10
  │
  ▼
Git Worktree created (isolated branch + directory)
  │
  ▼
Agent Executor (ReAct loop, max 30 iterations)
  → Claude reads files → writes code → runs tests → repeats
  → Tools: write_file, read_file, run_command, list_files, session_complete
  → Streams progress via WebSocket → UI updates in real-time
  │
  ▼
Auto-Test → pytest inside Docker container
  │
  ▼ (tests pass)
Preview → Docker container launched, dynamic port assigned
  → User clicks URL → sees running app in browser
  │
  ▼
Merge → Deploy → Live at *.dalkkak.ai
```

---

## Key Features

### Parallel AI Sessions (tmux-style)
Multiple AI sessions run simultaneously, each in its own git worktree branch. A visual grid shows all sessions side by side — progress bars, file changes, test results, and cost tracking — all updating in real-time via WebSocket.

### Dual Mode: Auto AI + Terminal
- **Auto AI mode**: Describe what you want in plain language. The AI executor does everything.
- **Terminal mode**: Full xterm.js terminal in the browser, backed by tmux + PTY. Use your own Claude Code subscription or any CLI tool. Sessions persist across page refreshes.

### Docker Preview System
One-click test launches the app in a Docker container with auto-detected stack (Node.js, Python/FastAPI, Next.js), dynamic port allocation, and hot-reload. Docker-in-Docker architecture: the API container creates preview containers on the host via socket mount.

### AI Cost Router (the $0.001 gatekeeper)
Every request passes through a hierarchical cost router before touching any AI model:
1. **Zero-cost** — DB query, cached response, template, regex ($0)
2. **Haiku** — classification, short answers, auto-replies (~$0.005)
3. **Sonnet** — code generation, content, analysis (~$0.10)
4. **Opus** — full startup build, architecture decisions (~$0.80)

Result: ~$6.75 AI cost per active user/month at $49+ subscription = 86%+ gross margin.

### Git Worktree Isolation
Each session gets its own worktree directory and branch. No two sessions touch the same files. Module-based splitting (not feature-based) ensures clean parallel merges. Merge order respects dependency topology: core modules first, features second, frontend last.

### CLAUDE.md Agent Sophistication
An 8-layer agent governance system defined in `CLAUDE.md`:
1. Prompt-level rules and constraints
2. Tool-use boundaries per agent type
3. Context budget management (Haiku: 2K tokens, Sonnet: 8K, Opus: 20K)
4. Cost escalation policy (try cheap first, escalate on failure)
5. Session ownership model (directory-level file boundaries)
6. Error recovery protocol (retry → escalate → notify)
7. Module-based parallel session rules (7 rules for zero-conflict merges)
8. Agent-type specialization (7 distinct agent types with clear boundaries)

### i18n (Korean / English)
Full internationalization support. Korean for the domestic market, English for global reach.

### Stripe Billing Integration
Four-tier subscription model (Free → Starter → Growth → Scale) controlling AI budget allocation, concurrent session limits, and feature access. Stripe Checkout + webhook-driven plan updates.

---

## Technical Deep Dive

### AI Agent Executor: ReAct Loop with Tool-Use

The core engine runs Claude in a ReAct (Reason + Act) loop. Each iteration:

```python
# Simplified from backend/agents/executor.py
class AgentExecutor:
    async def run(self):
        for iteration in range(MAX_ITERATIONS):  # max 30
            if self.total_cost >= Decimal("5.0"):
                return ExecutionResult(success=False, error="Cost limit")

            response = await client.messages.create(
                model="claude-sonnet-4-6",
                messages=self.conversation,
                tools=TOOL_DEFINITIONS,  # write_file, read_file, run_command, ...
            )

            for block in response.content:
                if block.type == "tool_use":
                    result = await self.tool_executor.execute(block.name, block.input)
                    if block.name == "session_complete":
                        return ExecutionResult(success=True)
```

Safety limits: $5 max cost per session, 30-minute timeout, loop detection (3 identical outputs → auto-pause).

### Session Queue: Concurrency-Aware, Plan-Based

```
Free plan:    1 concurrent session   → sequential execution
Starter:      2 concurrent sessions  → light parallelism
Growth:       5 concurrent sessions  → full parallel builds
Scale:        10 concurrent sessions → enterprise throughput
```

The queue worker polls every 10 seconds, dispatches sessions by priority (1-10), and auto-starts the next queued session when a slot opens. Per-session cost tracking with warnings at $2 and hard pause at $5.

### Preview System: Docker-in-Docker with Dynamic Ports

```
User clicks "Test"
  → POST /api/sessions/{id}/preview
  → detect_startup_type(worktree)        # package.json? main.py? next.config?
  → find_free_port()                      # OS-assigned via socket.bind(("", 0))
  → docker run --detach                   # on HOST via mounted docker.sock
      --publish {port}:{container_port}
      --volume {worktree}:/app
      {image} "npm install && npm start"
  → return http://localhost:{port}
```

Hot-reload: Node.js uses `--watch`, FastAPI uses `--reload`. File changes in the worktree are immediately reflected.

### WebSocket Hub: Real-Time Session Streaming

The hub broadcasts granular events per startup:

```
ws://localhost:8000/ws/sessions/{startup_id}

Events: session.progress   → { session_id, progress: 45, message: "Writing tests..." }
        session.file_change → { session_id, file_path, change_type }
        session.completed   → { session_id, summary }
        session.error       → { session_id, error_message }
```

A separate terminal WebSocket (`/ws/terminal/{session_id}`) provides full PTY forwarding: `Browser (xterm.js) ←→ WebSocket ←→ FastAPI ←→ PTY ←→ tmux ←→ bash`.

### 7 Specialized Agent Types

| Agent | Model | Purpose | File Ownership |
|-------|-------|---------|----------------|
| **Router** | Haiku | Classify every request (<500ms, <$0.002) | None (stateless) |
| **Build** | Opus→Sonnet | Generate complete startup from description | All files (initial build) |
| **Feature** | Sonnet | Add features to existing codebase | Scoped to feature directory |
| **Fix** | Sonnet→Opus | Diagnose and repair bugs | Scoped to affected files |
| **Marketing** | Haiku/Sonnet | Blog, SEO, ads, email campaigns | Marketing content only |
| **Support** | Haiku + RAG | Auto-resolve customer tickets | Knowledge base only |
| **Advisor** | Haiku/Sonnet | Business metrics and insights | Read-only (never writes) |

Agents do **not** communicate directly. All coordination flows through the shared database.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | Dashboard, session UI, landing page |
| **Backend** | Python 3.11 + FastAPI (async) + Pydantic v2 | REST API, WebSocket hub, session management |
| **AI Engine** | Claude API (Haiku / Sonnet / Opus) + LangGraph | Agent executor, cost routing, tool-use loop |
| **Database** | PostgreSQL 16 (Supabase) + SQLAlchemy 2.0 async | Users, startups, sessions, analytics |
| **Cache/Queue** | Redis 7 (Upstash) | Session queue, pub/sub, rate limiting, response cache |
| **Migrations** | Alembic | Auto-run on startup, never touch schema directly |
| **Terminal** | xterm.js + tmux + PTY | In-browser terminal with session persistence |
| **Preview** | Docker-in-Docker (socket mount) | Dynamic container launch for app testing |
| **Payments** | Stripe (Checkout + Webhooks) | Subscription billing, plan management |
| **Storage** | Cloudflare R2 | Generated code, build artifacts, uploads |
| **Vectors** | Qdrant Cloud | RAG knowledge base for support bot |
| **Git** | Git worktrees + GitHub API | Per-session branch isolation, auto-commit |
| **Email** | Resend | Transactional and marketing emails |
| **Monitoring** | Sentry + PostHog | Error tracking, analytics events |
| **DNS** | Cloudflare | Wildcard *.dalkkak.ai routing |
| **Deployment** | Railway + Docker Compose (dev) | One-command local dev, one-click production deploy |

---

## Getting Started

### Prerequisites

- **Docker Desktop** — runs the entire stack (API, PostgreSQL, Redis) in containers
- **Git** — for cloning and worktree management
- **Node.js 18+** — for frontend development (optional if only running backend)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/dalkkak-ai.git
cd dalkkak-ai

# 2. Start the full stack (API + PostgreSQL + Redis)
docker-compose up

# 3. Verify
curl http://localhost:8000/health    # → { "status": "ok" }
open http://localhost:8000/docs      # → Swagger UI with all endpoints
```

First run takes ~2-3 minutes (image download). Subsequent starts: ~10 seconds.

### Environment Variables

```env
# Required
DATABASE_URL=postgresql+asyncpg://dalkkak:dalkkak@db:5432/dalkkak
REDIS_URL=redis://redis:6379

# Optional — AI features require this
ANTHROPIC_API_KEY=sk-ant-...

# Optional — billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional — deployment
GITHUB_TOKEN=ghp_...
RAILWAY_TOKEN=...
```

The server, database, and tests all work without an API key. AI agent execution requires `ANTHROPIC_API_KEY`.

### Running Tests

```bash
# Run the full test suite inside Docker
docker-compose --profile test up --abort-on-container-exit

# Or locally with pytest
pytest tests/ -v --asyncio-mode=auto
```

---

## Project Structure

```
dalkkak-ai/
├── backend/
│   ├── main.py                 # FastAPI entry point + lifespan (auto-migrate)
│   ├── config.py               # Environment configuration
│   ├── database.py             # Async SQLAlchemy engine + session
│   ├── auth/                   # JWT signup/login/refresh
│   ├── startups/               # Startup CRUD (one user → many startups)
│   ├── sessions/               # Session lifecycle, queue worker, preview
│   ├── agents/                 # AI executor, cost router, 7 agent types
│   ├── billing/                # Stripe checkout + webhook handlers
│   ├── deploy/                 # Railway/GitHub deployment service
│   ├── terminal/               # PTY + tmux WebSocket bridge
│   ├── websocket/              # Real-time event hub
│   └── models/                 # SQLAlchemy ORM models
├── frontend/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (marketing)/        # Landing page (no sidebar)
│   │   ├── (auth)/             # Login / register
│   │   └── (dashboard)/        # Session grid, startup detail
│   ├── components/             # Terminal.tsx, SessionCard, FilesViewer
│   └── lib/                    # API client, WebSocket helpers
├── docs/                       # 15 spec docs (architecture, agents, cost, sessions, ...)
├── tests/                      # pytest + asyncio test suite
├── alembic/                    # Database migrations
├── docker-compose.yml          # Full stack: api + postgres + redis
├── Dockerfile                  # Multi-stage Python build
├── CLAUDE.md                   # AI agent governance rules (8-layer system)
└── logs/                       # Learning logs, English corrections, troubleshooting
```

---

## Roadmap

### Phase 1 — Ship Fast (Current, Month 0-3) — Agent Level 7
> Launch MVP, first paying customers. Target: 50 users, ~5M KRW/month.

- [x] Auth (signup, login, JWT, token refresh)
- [x] Startup CRUD with git repo initialization
- [x] AI Executor (Claude tool-use ReAct loop)
- [x] Multi-session queue with plan-based concurrency
- [x] Git worktree isolation per session
- [x] Auto-test (pytest inside Docker)
- [x] Docker preview with hot-reload
- [x] Real-time WebSocket streaming
- [x] AI cost router (zero → Haiku → Sonnet → Opus)
- [x] Web terminal (xterm.js + tmux + PTY)
- [x] Files tab (code viewer)
- [x] Chat → AI re-execution
- [ ] Merge (session → main branch)
- [ ] Deploy integration (Railway / Vercel)
- [ ] Stripe billing
- [ ] Landing page
- [ ] Beta launch

### Phase 2 — Differentiate (Month 3-6) — Agent Level 8-9
> Self-improving agents, domain templates, marketing/support automation.

- Self-improving Agent (failure → auto-analyze → fix → retry)
- Domain templates (manufacturing, medical, finance, e-commerce)
- GitHub auto-connect (private repo + push)
- Analytics dashboard (revenue, users, funnel)
- Marketing Agent (landing page, SEO, email sequences)
- Support Agent (RAG knowledge base, ticket auto-resolution)

### Phase 3 — Ontology + Human-AI Collaboration (Month 6-12) — Agent Level 10
> Enterprise-grade intelligence. Knowledge graphs power agent reasoning.

- Knowledge Graph auto-construction (Neo4j)
- Ontology-powered Agent reasoning
- Human-AI collaborative workflow (AI asks human when uncertain)
- Agentic RAG pipeline (Qdrant + ontology-guided retrieval)
- Text2SQL Agent, LLM-as-a-Judge evaluation, hallucination detection

### Phase 4 — Agent Society (Month 12+) — Agent Level 11
> Hundreds of agents, autonomous organization and disbanding.

- Market-economy agent coordination (auction/negotiation)
- Cross-domain transfer learning
- Self-evolving architecture
- Target: 10B KRW/year revenue

---

## Philosophy

> **"복잡함은 우리가 삼킨다. 유저는 딸깍만 한다."**
>
> *"We swallow the complexity. Users just click."*

Every architectural decision in DalkkakAI traces back to this principle. The AI cost router exists so the user never thinks about model selection. Git worktrees exist so the user never thinks about branches. Docker preview exists so the user never thinks about deployment. The entire system is designed so that a founder who has never opened a terminal can go from idea to live product with paying customers — in one click.

---

## API Contract

```
Success:    { "ok": true,  "data": { ... } }
Error:      { "ok": false, "error": "Human-readable message", "code": "SNAKE_CASE" }
Pagination: ?page=1&limit=20 → { "data": [], "total": N, "page": 1 }

All IDs:        UUID v4
All timestamps: ISO 8601 UTC
Auth:           Bearer token (JWT, 24h expiry)
Rate limits:    100 req/min (authenticated), 10 req/min (public)
```

---

## License

MIT

---

<p align="center">
  <em>Built solo with Claude Code. Designed for founders who build with one click.</em>
</p>
