<p align="center">
  <h1 align="center">DalkkakAI — The Startup Operating System</h1>
  <p align="center">
    <strong>Describe your startup idea. One click. Get a running app with monitoring, billing, and marketing — no terminal required.</strong>
  </p>
  <p align="center">Built by a solo developer using AI-assisted development.</p>
</p>

<p align="center">
  <a href="https://ddalkkak.daeseon.ai">Live Demo</a> &nbsp;|&nbsp;
  <a href="https://ddalkkak.daeseon.ai">Video Demo</a>
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

![Dashboard Screenshot](docs/screenshots/dashboard.png)

---

## What is this?

**DalkkakAI** turns a plain-language startup description into a fully deployed web application — complete with monitoring, marketing, billing, and customer support. The target user is a non-technical solo founder who has never opened a terminal. The name comes from the Korean word **"dalkkak"** — the sound of a single click.

---

## Key Features

- **AI Agent Executor** — Claude runs in a ReAct loop with tool-use (read, write, execute), autonomously building full applications in up to 30 iterations
- **Parallel Sessions** — Multiple AI sessions run simultaneously via git worktree isolation; a real-time dashboard shows progress, file changes, and costs via WebSocket
- **Tiered Cost Router** — Every request is routed through a cost hierarchy: zero-cost ops first, then Haiku ($0.005), Sonnet ($0.10), Opus ($0.80) — targeting 86%+ gross margin
- **Docker Preview System** — One-click app testing with auto-detected stack, dynamic port allocation, and hot-reload via Docker-in-Docker
- **In-Browser Terminal** — Full xterm.js + tmux + PTY terminal with session persistence across page refreshes
- **7 Specialized Agents** — Router, Build, Feature, Fix, Marketing, Support, and Advisor — each with scoped file ownership and model assignments
- **Stripe Billing** — Four-tier subscription (Free / Starter / Growth / Scale) controlling concurrency limits and AI budgets
- **i18n** — Full Korean/English internationalization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (Next.js 14)                   │
│   Landing Page  |  Dashboard  |  Sessions  |  Terminal      │
└────────────────────┬────────────────────┬───────────────────┘
                     │ REST               │ WebSocket
                     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                FASTAPI BACKEND (async, Python 3.11)         │
│                                                             │
│  Auth (JWT)  Startups  Sessions  AI Cost Router             │
│  Billing     Deploy    Terminal  WebSocket Hub               │
│                                                             │
│              ┌─────────────────────┐                        │
│              │   Agent Executor    │                        │
│              │   (ReAct loop,      │                        │
│              │    tool-use, 30 it) │                        │
│              └──────────┬──────────┘                        │
└──────┬──────┬───────┬───┼───────┬───────────────────────────┘
       │      │       │   │       │
       ▼      ▼       ▼   ▼       ▼
   Postgres  Redis  Docker Claude  GitHub
```

**Request flow:** User describes idea --> Router Agent (Haiku, <500ms) classifies intent --> Session queued with plan-based concurrency --> Git worktree created --> Agent Executor writes code in a ReAct loop --> Auto-test in Docker --> Preview URL generated --> User clicks to see running app.

> For full architecture details, see [`docs/SPEC.md`](docs/SPEC.md) and the 11 docs in [`docs/`](docs/).

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui | Dashboard, session grid, landing page |
| Backend | Python 3.11 + FastAPI (async) + Pydantic v2 | REST API, WebSocket hub, session management |
| AI Engine | Claude API (Haiku/Sonnet/Opus) + LangGraph | ReAct agent executor, cost routing |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 async | Users, startups, sessions, analytics |
| Cache/Queue | Redis 7 | Session queue, pub/sub, rate limiting |
| Migrations | Alembic | Schema versioning, auto-run on startup |
| Terminal | xterm.js + tmux + PTY | In-browser terminal with persistence |
| Preview | Docker-in-Docker (socket mount) | Dynamic container launch for testing |
| Payments | Stripe (Checkout + Webhooks) | Subscription billing |
| Storage | Cloudflare R2 | Generated code and build artifacts |
| Vectors | Qdrant Cloud | RAG knowledge base for support bot |
| Git | Git worktrees + GitHub API | Per-session branch isolation |
| Deployment | Railway + Docker Compose | Production deploy + local dev |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/dalkkak-ai.git && cd dalkkak-ai

# 2. Start the full stack (API + PostgreSQL + Redis)
docker-compose up

# 3. Verify
curl http://localhost:8000/health   # { "status": "ok" }
open http://localhost:8000/docs     # Swagger UI
```

Set `ANTHROPIC_API_KEY` in `.env` to enable AI features. See [`docs/`](docs/) for full configuration.

---

## What I Learned

Building this project solo — with AI as a pair-programming partner — taught me more than any team project could:

- **AI Agent Architecture** — Designed a ReAct loop with tool-use, managing context windows, token budgets, and loop detection (3 identical outputs = auto-pause)
- **Production Cost Optimization** — Built a 4-tier AI routing system that processes requests at $0 when possible, escalating only when cheaper models fail
- **Parallel Development with Git Worktrees** — Architected module-based session isolation so multiple AI agents can write code simultaneously without merge conflicts
- **Real-Time Systems** — Implemented WebSocket streaming for live session progress, plus PTY-backed terminal forwarding through the browser
- **Docker-in-Docker** — Built a preview system where the API container creates and manages preview containers on the host via socket mount
- **Full-Stack Deployment** — Managed the full pipeline: Next.js on Vercel, FastAPI on Railway, PostgreSQL, Redis, with Alembic migrations auto-running on startup
- **AI-Assisted Development** — This entire project was built using Claude Code as a development partner, proving that a solo developer can ship enterprise-grade systems

---

## Project Structure

```
dalkkak-ai/
├── backend/
│   ├── main.py              # FastAPI entry + lifespan
│   ├── auth/                # JWT signup/login/refresh
│   ├── startups/            # Startup CRUD
│   ├── sessions/            # Session lifecycle, queue, preview
│   ├── agents/              # AI executor, cost router, 7 agent types
│   ├── billing/             # Stripe integration
│   ├── terminal/            # PTY + tmux WebSocket bridge
│   └── models/              # SQLAlchemy ORM models
├── frontend/
│   ├── app/                 # Next.js 14 App Router
│   ├── components/          # Terminal, SessionCard, FilesViewer
│   └── lib/                 # API client, WebSocket helpers
├── docs/                    # 15 architecture & spec docs
├── tests/                   # pytest + asyncio test suite
├── CLAUDE.md                # AI agent governance rules
└── docker-compose.yml       # Full stack orchestration
```

---

## Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Phase 1** (current) | Month 0-3 | MVP: auth, sessions, AI executor, preview, billing, launch |
| **Phase 2** | Month 3-6 | Self-improving agents, domain templates, marketing/support automation |
| **Phase 3** | Month 6-12 | Knowledge graphs, ontology-powered reasoning, human-AI collaboration |
| **Phase 4** | Month 12+ | Agent society: autonomous coordination, cross-domain transfer learning |

See [`docs/SPEC.md`](docs/SPEC.md) for detailed roadmap with checklist.

---

## License

MIT

---

<p align="center">
  <em>Built solo with Claude Code. Designed for founders who build with one click.</em>
</p>
