# DalkkakAI — Project Specification

> The startup operating system. Describe your business. Click once. Run everything.

## Vision

DalkkakAI is a web platform where solo founders describe their startup idea and DalkkakAI handles everything — build, deploy, monitor, market, bill, support — from one dashboard. No terminal. No configuration. No developer knowledge required.

## Target User

Solo founders, vibe coders, small business owners who have an idea but don't want to manage 10+ SaaS tools. They type natural language, DalkkakAI does the rest.

## Core Principle: 딸깍 (One Click, Everything Done)

Every action on the platform should feel like one click. The complexity lives in our backend, never in the user's experience.

---

## Architecture Overview

### Phase 1: Ship Fast (Month 0-6) — Python + TypeScript

```
┌───────────────────────────────────────────────────────┐
│                    FRONTEND                            │
│          Next.js 14 + Tailwind + shadcn/ui            │
│                  Deployed on Vercel                    │
│                                                       │
│  Dashboard │ Build │ Analytics │ Marketing │ Support   │
│  Command Bar (universal natural language input)        │
└──────────────────────┬────────────────────────────────┘
                       │ REST + WebSocket
                       │
┌──────────────────────▼────────────────────────────────┐
│              FASTAPI MONOLITH (Python)                 │
│              Deployed on Railway                       │
│                                                       │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐ │
│  │  Auth   │ │  Startup │ │Session │ │  Command   │ │
│  │  JWT    │ │  CRUD    │ │Manager │ │  Router    │ │
│  └─────────┘ └──────────┘ └────────┘ └─────┬──────┘ │
│                                             │        │
│         ┌───────────────┬───────────────┐   │        │
│         ▼               ▼               ▼   │        │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐│        │
│  │  Zero-Cost │ │  AI Router │ │  Agent   ││        │
│  │  Handler   │ │  (Haiku    │ │  Engine  ││        │
│  │            │ │  classif.) │ │          ││        │
│  │  DB query  │ │  Picks:    │ │ LangGraph││        │
│  │  Script    │ │  Haiku     │ │ Claude   ││        │
│  │  Template  │ │  Sonnet    │ │ API      ││        │
│  │  Cache hit │ │  Opus      │ │          ││        │
│  └──────┬─────┘ └─────┬──────┘ └────┬─────┘│        │
│         │             │              │       │        │
│  ┌──────▼─────────────▼──────────────▼──────▼──────┐ │
│  │              SHARED SERVICES                     │ │
│  │  WebSocket Hub │ Background Jobs │ File Manager  │ │
│  └──────────────────────┬───────────────────────────┘ │
└─────────────────────────┼─────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────┐
│                    DATA LAYER                          │
│                                                       │
│  ┌────────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │
│  │ PostgreSQL │ │ Redis  │ │Qdrant  │ │Cloudflare │ │
│  │ (Supabase) │ │(Upstash│ │ Cloud  │ │ R2 (S3)   │ │
│  │            │ │        │ │        │ │           │ │
│  │ Users      │ │ Cache  │ │ RAG    │ │ Generated │ │
│  │ Startups   │ │ Queue  │ │ Vectors│ │ code      │ │
│  │ Sessions   │ │ PubSub │ │ Per-   │ │ Build     │ │
│  │ Payments   │ │ Rate   │ │ startup│ │ artifacts │ │
│  │ Analytics  │ │ limit  │ │ index  │ │ Uploads   │ │
│  └────────────┘ └────────┘ └────────┘ └───────────┘ │
└───────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────┐
│                 EXTERNAL SERVICES                      │
│                                                       │
│  GitHub API → Repo management, auto-commit, worktrees │
│  Railway API → User project deployment & hosting      │
│  Stripe → Platform billing + user startup billing     │
│  Resend → Transactional & marketing emails            │
│  PostHog → Analytics tracking                         │
│  Sentry → Error monitoring                            │
│  Cloudflare → DNS, wildcard *.dalkkak.ai              │
└───────────────────────────────────────────────────────┘
```

**Why monolith first**: One FastAPI process, one deploy, one log stream. You can debug everything in one place. FastAPI async handles 5K+ req/sec — enough for 10K users. Split only when you can measure the bottleneck.

---

### Phase 2: Scale (Month 6-12) — Python + Go + TypeScript

When metrics show specific bottlenecks, extract those services into Go. Python stays for all AI work forever.

```
┌───────────────────────────────────────────────────────┐
│                    FRONTEND                            │
│          Next.js 14 + Tailwind + shadcn/ui            │
│                  Deployed on Vercel                    │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│         API GATEWAY (Go — Fiber)                      │
│         Deployed on Fly.io / GKE                      │
│                                                       │
│  Auth middleware │ Rate limiter │ Request router       │
│  40K+ req/sec │ JWT validation │ Load balancing       │
└──────┬────────────────┬───────────────────┬───────────┘
       │                │                   │
       │         ┌──────▼───────┐           │
       │         │  WebSocket   │           │
       │         │  Hub (Go)    │           │
       │         │              │           │
       │         │  100K+ conn  │           │
       │         │  Real-time   │           │
       │         │  session     │           │
       │         │  updates     │           │
       │         └──────┬───────┘           │
       │                │                   │
┌──────▼────────────────▼───────────────────▼───────────┐
│              SERVICE MESH (Kubernetes)                 │
│                                                       │
│  ┌─────────────────┐  ┌─────────────────────────────┐│
│  │  Go Services    │  │  Python Services             ││
│  │                 │  │                              ││
│  │  ┌───────────┐  │  │  ┌────────────────────────┐  ││
│  │  │ Session   │  │  │  │  Agent Engine           │  ││
│  │  │ Manager   │  │  │  │  (LangGraph)            │  ││
│  │  │           │  │  │  │                         │  ││
│  │  │ Worktree  │  │  │  │  Build Agent            │  ││
│  │  │ lifecycle │  │  │  │  Feature Agent           │  ││
│  │  │ Git ops   │  │  │  │  Fix Agent              │  ││
│  │  │ Merge     │  │  │  │  Marketing Agent         │  ││
│  │  └───────────┘  │  │  │  Support Agent           │  ││
│  │                 │  │  │  Advisor Agent            │  ││
│  │  ┌───────────┐  │  │  └────────────────────────┘  ││
│  │  │ Deploy    │  │  │                              ││
│  │  │ Service   │  │  │  ┌────────────────────────┐  ││
│  │  │           │  │  │  │  AI Router              │  ││
│  │  │ Railway   │  │  │  │  (cost optimization)    │  ││
│  │  │ API calls │  │  │  │                         │  ││
│  │  │ Health    │  │  │  │  Haiku classifier       │  ││
│  │  │ checks    │  │  │  │  Model selector         │  ││
│  │  │ Rollback  │  │  │  │  Cache manager          │  ││
│  │  └───────────┘  │  │  └────────────────────────┘  ││
│  │                 │  │                              ││
│  │  ┌───────────┐  │  │  ┌────────────────────────┐  ││
│  │  │ Monitor   │  │  │  │  Content Generator      │  ││
│  │  │ Service   │  │  │  │  (marketing, SEO, email)│  ││
│  │  │           │  │  │  └────────────────────────┘  ││
│  │  │ Health    │  │  │                              ││
│  │  │ probes    │  │  │  ┌────────────────────────┐  ││
│  │  │ Alerting  │  │  │  │  Support Bot            │  ││
│  │  │ Metrics   │  │  │  │  (RAG + Haiku)          │  ││
│  │  └───────────┘  │  │  └────────────────────────┘  ││
│  └─────────────────┘  └─────────────────────────────┘│
│                                                       │
│  Communication: gRPC between Go ↔ Python services     │
│  Service discovery: Kubernetes DNS                    │
│  Config: Environment variables per service            │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│                    DATA LAYER                          │
│  (Same as Phase 1 — scale vertically first)           │
│                                                       │
│  PostgreSQL │ Redis │ Qdrant │ Cloudflare R2           │
│  (Supabase) │(Upstash)│Cloud │ (S3)                   │
│                                                       │
│  Future: If DB becomes bottleneck:                    │
│  → Read replicas for analytics queries                │
│  → Separate DB for analytics events (ClickHouse)      │
│  → Redis Cluster for 100K+ WebSocket connections      │
└───────────────────────────────────────────────────────┘
```

### What moves to Go and WHY

| Service | Phase 1 (Python) | Phase 2 (Go) | Trigger to migrate |
|---------|-----------------|---------------|-------------------|
| API Gateway | FastAPI handles all requests | Go Fiber | p95 latency > 200ms |
| WebSocket Hub | FastAPI WebSocket | Go goroutines | > 5K concurrent connections |
| Session Manager | Python subprocess for git | Go native exec | > 100 concurrent worktrees |
| Deploy Service | Python httpx calls | Go HTTP client | Deploy queue > 30s wait |
| Monitor Service | Python health checks | Go ticker routines | > 500 startups to monitor |
| Auth | FastAPI JWT middleware | Go middleware | Moved with API gateway |

### What stays Python FOREVER

| Service | Why it stays Python |
|---------|-------------------|
| Agent Engine (LangGraph) | LangGraph is Python-only. No Go equivalent. |
| AI Router | Claude SDK is Python-first. AI ecosystem is Python. |
| Content Generator | All LLM libraries are Python-native. |
| Support Bot (RAG) | Qdrant client + LangChain = Python. |
| Advisor Agent | Data analysis libraries (pandas) = Python. |

### How Go and Python talk to each other

```
Phase 1 (monolith): Everything in one process. No communication needed.

Phase 2 (microservices):
  
  Option A: gRPC (recommended)
    Go service ←── gRPC (binary, fast, typed) ──→ Python service
    
    Proto definition shared between both:
    ┌─────────────────────────────────┐
    │ proto/session.proto              │
    │                                  │
    │ service SessionAgent {           │
    │   rpc RunSession(SessionReq)     │
    │     returns (stream Progress);   │
    │ }                                │
    └─────────────────────────────────┘
    
    Go calls Python: "Run this agent session"
    Python streams back: progress updates, file changes, completion
    
  Option B: Redis message queue (simpler)
    Go service ──publish──→ Redis ──subscribe──→ Python service
    
    Go publishes: { task: "run_session", session_id: "uuid", ... }
    Python consumes: runs agent, publishes results back
    Go receives: progress updates via Redis pub/sub
    
  Recommendation: Start with Redis queue (simpler), migrate to 
  gRPC when you need streaming and type safety.
```

---

## Tech Stack

### Languages: Python + TypeScript → Python + Go + TypeScript

```
Phase 1 (Month 0-6):   Python + TypeScript
Phase 2 (Month 6-12):  Python + Go + TypeScript
Phase 3 (Year 2+):     Python + Go + TypeScript (consider Rust for container runtime)
```

### Stack Details

| Layer | Phase 1 | Phase 2 | Free Tier |
|-------|---------|---------|-----------|
| Frontend | Next.js 14 + Tailwind | Same | Vercel free |
| API Gateway | FastAPI | **Go (Fiber)** | Railway → Fly.io |
| WebSocket | FastAPI WebSocket | **Go (gorilla/websocket)** | — |
| Session Mgmt | Python subprocess | **Go (os/exec)** | — |
| Deploy Service | Python httpx | **Go (net/http)** | — |
| Monitor Service | Python asyncio | **Go (goroutines)** | — |
| Agent Engine | LangGraph (Python) | LangGraph (Python) | — |
| AI Router | Python | Python | — |
| Content Gen | Python | Python | — |
| Support Bot | Python + Qdrant | Python + Qdrant | — |
| Database | PostgreSQL (Supabase) | Same | 500MB free |
| Cache & Queue | Redis (Upstash) | Same → Redis Cluster | 10K cmd/day |
| File Storage | Cloudflare R2 | Same | 10GB free |
| Vector DB | Qdrant Cloud | Same | 1GB free |
| Git | GitHub API | Same | Unlimited |
| User Deploys | Railway API | Same | $5/mo credit |
| Payments | Stripe | Same | 2.9% + $0.30 |
| Email | Resend | Same | 3K emails/mo |
| Analytics | PostHog | Same | 1M events/mo |
| Errors | Sentry | Same | 5K errors/mo |
| DNS | Cloudflare | Same | Free |
| Orchestration | Railway (single) | **Kubernetes (GKE)** | GKE Autopilot |
| Service Comm | In-process | **Redis queue → gRPC** | — |

### Monthly infrastructure cost

```
Phase 1 (prototype, < 100 users):
  Vercel (FE):        $0
  Railway (BE):       $5
  Supabase:           $0
  Upstash Redis:      $0
  Cloudflare R2:      $0
  Claude API:         ~$30
  Domain:             ~$1
  ──────────────────────
  Total:              ~$36/month

Phase 1 (1,000 users):
  Vercel (FE):        $20
  Railway (BE):       $20
  Supabase:           $25
  Upstash Redis:      $10
  Cloudflare R2:      $5
  Claude API:         ~$500
  Stripe fees:        ~$150
  ──────────────────────
  Total:              ~$730/month
  Revenue at $49/user: $49,000/month
  Margin:             98.5%

Phase 2 (10,000 users):
  GKE Kubernetes:     $200
  Fly.io (gateway):   $50
  Supabase Pro:       $25
  Redis Cluster:      $50
  Cloudflare R2:      $20
  Claude API:         ~$5,000
  Stripe fees:        ~$1,500
  ──────────────────────
  Total:              ~$6,845/month
  Revenue at $49/user: $490,000/month
  Margin:             98.6%
```

---

## Data Models

### User
```
users
├── id              UUID (PK)
├── email           VARCHAR (unique)
├── name            VARCHAR
├── plan            ENUM (free, starter, growth, scale)
├── stripe_customer_id  VARCHAR
├── onboarding_complete BOOLEAN
├── created_at      TIMESTAMP
└── updated_at      TIMESTAMP
```

### Startup (one user can have multiple startups)
```
startups
├── id              UUID (PK)
├── user_id         UUID (FK → users)
├── name            VARCHAR
├── description     TEXT
├── domain          VARCHAR (e.g., "reviewpro.dalkkak.ai")
├── custom_domain   VARCHAR (nullable)
├── status          ENUM (building, live, paused, error)
├── stack           JSONB (detected/chosen tech stack)
├── git_repo_url    VARCHAR
├── deploy_url      VARCHAR
├── deploy_status   ENUM (deploying, live, failed, stopped)
├── settings        JSONB (stripe keys, analytics ids, etc.)
├── created_at      TIMESTAMP
└── updated_at      TIMESTAMP
```

### Session (parallel AI work sessions per startup)
```
sessions
├── id              UUID (PK)
├── startup_id      UUID (FK → startups)
├── title           VARCHAR
├── description     TEXT
├── branch          VARCHAR (git branch name)
├── status          ENUM (queued, running, done, error, merged)
├── agent_type      VARCHAR (build, feature, fix, marketing, support)
├── progress        INTEGER (0-100)
├── files_changed   JSONB (list of file paths)
├── lines_added     INTEGER
├── test_results    JSONB ({passed, failed, total})
├── cost            DECIMAL (AI API cost for this session)
├── model_used      VARCHAR (haiku, sonnet, opus)
├── started_at      TIMESTAMP
├── completed_at    TIMESTAMP
└── created_at      TIMESTAMP
```

### Conversation (chat history per session)
```
conversations
├── id              UUID (PK)
├── session_id      UUID (FK → sessions, nullable)
├── startup_id      UUID (FK → startups)
├── role            ENUM (user, agent, system)
├── content         TEXT
├── metadata        JSONB (model used, tokens, cost)
├── created_at      TIMESTAMP
```

### Deployment
```
deployments
├── id              UUID (PK)
├── startup_id      UUID (FK → startups)
├── version         INTEGER (auto-increment per startup)
├── git_commit      VARCHAR
├── status          ENUM (building, deploying, live, failed, rolled_back)
├── deploy_url      VARCHAR
├── build_logs      TEXT
├── health_status   ENUM (healthy, degraded, down)
├── created_at      TIMESTAMP
```

### Analytics Event
```
analytics_events
├── id              UUID (PK)
├── startup_id      UUID (FK → startups)
├── event_type      VARCHAR (page_view, signup, purchase, churn, etc.)
├── properties      JSONB
├── created_at      TIMESTAMP
```

### Support Ticket
```
support_tickets
├── id              UUID (PK)
├── startup_id      UUID (FK → startups)
├── customer_email  VARCHAR
├── subject         VARCHAR
├── status          ENUM (open, ai_handling, ai_resolved, needs_owner, closed)
├── priority        ENUM (low, medium, high, urgent)
├── messages        JSONB (array of {role, content, timestamp})
├── resolution      TEXT
├── created_at      TIMESTAMP
└── resolved_at     TIMESTAMP
```

### Marketing Campaign
```
marketing_campaigns
├── id              UUID (PK)
├── startup_id      UUID (FK → startups)
├── type            ENUM (google_ads, seo_blog, email, social)
├── name            VARCHAR
├── status          ENUM (draft, running, paused, completed)
├── config          JSONB (ad copy, targeting, budget, etc.)
├── metrics         JSONB (impressions, clicks, conversions, spend)
├── ai_managed      BOOLEAN
├── created_at      TIMESTAMP
└── updated_at      TIMESTAMP
```

---

## API Endpoints

### Auth (no AI needed — $0)
```
POST   /auth/register          → {token, user}
POST   /auth/login             → {token, user}
POST   /auth/refresh           → {token}
GET    /auth/me                → {user}
```

### Startups (no AI needed — $0)
```
POST   /startups/              → {startup}          # Create new startup
GET    /startups/              → [{startup}]         # List user's startups
GET    /startups/{id}          → {startup}           # Get startup details
PATCH  /startups/{id}          → {startup}           # Update settings
DELETE /startups/{id}          → {ok}
```

### Build / Sessions (AI needed — cost varies)
```
POST   /startups/{id}/build    → {session}           # 딸깍 — build entire startup
POST   /startups/{id}/sessions → {session}           # Create feature session
GET    /startups/{id}/sessions → [{session}]          # List all sessions
GET    /sessions/{id}          → {session, messages}  # Session detail + chat
POST   /sessions/{id}/chat     → {message}            # Send message to agent
POST   /sessions/{id}/merge    → {deployment}         # Merge session to main
DELETE /sessions/{id}          → {ok}                 # Cancel session
```

### Deployments (no AI — $0)
```
POST   /startups/{id}/deploy   → {deployment}        # Deploy to production
GET    /startups/{id}/deploys  → [{deployment}]       # Deploy history
POST   /deploys/{id}/rollback  → {deployment}         # Rollback
GET    /deploys/{id}/logs      → {logs}               # Build/runtime logs
```

### Analytics (no AI for reads, AI for insights — cheap)
```
GET    /startups/{id}/metrics         → {metrics}     # Dashboard metrics ($0)
GET    /startups/{id}/metrics/revenue → {revenue_data} # Revenue chart ($0)
GET    /startups/{id}/metrics/users   → {user_data}    # User chart ($0)
GET    /startups/{id}/metrics/funnel  → {funnel_data}  # Funnel ($0)
POST   /startups/{id}/insights       → {insights}     # AI analysis (Haiku)
```

### Marketing (AI for generation — Haiku/Sonnet)
```
GET    /startups/{id}/campaigns       → [{campaign}]
POST   /startups/{id}/campaigns       → {campaign}    # AI creates campaign
PATCH  /campaigns/{id}                → {campaign}
POST   /campaigns/{id}/generate-copy  → {ad_copy}     # Haiku — cheap
POST   /startups/{id}/blog/generate   → {blog_post}   # Sonnet — medium
POST   /startups/{id}/email/send      → {result}      # Template — $0
```

### Support (AI for auto-resolution — Haiku)
```
GET    /startups/{id}/tickets         → [{ticket}]
GET    /tickets/{id}                  → {ticket}
POST   /tickets/{id}/reply           → {message}      # AI or manual
PATCH  /tickets/{id}                 → {ticket}        # Update status
```

### Chat / Command Bar (AI router decides cost)
```
POST   /startups/{id}/command         → {result}
  # This is the universal command bar endpoint.
  # The AI Router decides:
  #   - Is this a question? → Haiku ($0.01)
  #   - Is this a feature request? → Create session (Sonnet)
  #   - Is this a data query? → Direct DB query ($0)
  #   - Is this a deploy command? → Run script ($0)
```

---

## AI Cost Router — The Smart Brain

This is DalkkakAI's secret weapon. Every user request goes through the cost router BEFORE hitting any AI model.

```python
# ai_router.py — decides how to handle every request

class TaskCategory:
    ZERO_COST = "zero_cost"        # No AI needed
    HAIKU = "haiku"                # Cheap AI ($0.25/1M tokens)
    SONNET = "sonnet"              # Medium AI ($3/1M tokens)
    OPUS = "opus"                  # Expensive AI ($15/1M tokens)

ROUTING_RULES = {
    # ── Zero cost (direct execution) ─────────────────
    "deploy":           ZERO_COST,   # Shell script
    "rollback":         ZERO_COST,   # Shell script
    "restart":          ZERO_COST,   # API call
    "get_metrics":      ZERO_COST,   # DB query
    "get_logs":         ZERO_COST,   # File read
    "change_setting":   ZERO_COST,   # DB update
    "send_email":       ZERO_COST,   # Template + API
    "check_status":     ZERO_COST,   # Health check
    
    # ── Haiku (cheap, fast) ──────────────────────────
    "answer_question":  HAIKU,       # "What's my MRR?"
    "classify_ticket":  HAIKU,       # Route support ticket
    "generate_copy":    HAIKU,       # Ad copy, email subject
    "summarize_data":   HAIKU,       # Weekly report
    "auto_reply":       HAIKU,       # Support auto-response
    "seo_meta":         HAIKU,       # Meta tags, descriptions
    
    # ── Sonnet (balanced) ────────────────────────────
    "generate_code":    SONNET,      # Feature implementation
    "fix_bug":          SONNET,      # Error diagnosis + fix
    "generate_blog":    SONNET,      # Long-form content
    "create_campaign":  SONNET,      # Marketing campaign
    "analyze_business": SONNET,      # AI advisor insights
    "build_landing":    SONNET,      # Landing page generation
    
    # ── Opus (expensive, only for complex tasks) ─────
    "build_startup":    OPUS,        # Full initial build
    "architect":        OPUS,        # System design decisions
    "major_refactor":   OPUS,        # Large codebase changes
    "complex_debug":    OPUS,        # Multi-file debugging
}

def route_request(user_input: str, context: dict) -> TaskCategory:
    """
    Step 1: Try to match to zero-cost action (regex/keyword)
    Step 2: If ambiguous, use Haiku to classify (costs ~$0.001)
    Step 3: Execute with the appropriate model
    """
    
    # Step 1: Zero-cost pattern matching
    if is_deploy_command(user_input):
        return ZERO_COST
    if is_data_query(user_input):
        return ZERO_COST
    if is_setting_change(user_input):
        return ZERO_COST
    
    # Step 2: Use Haiku to classify (ultra-cheap)
    category = classify_with_haiku(user_input, context)
    
    return ROUTING_RULES.get(category, SONNET)  # Default to Sonnet
```

### Cost Estimation Per User Action

| User Action | AI Model | Estimated Cost |
|-------------|----------|---------------|
| "How's my business doing?" | Haiku | $0.005 |
| "Deploy latest changes" | None | $0 |
| "Show me today's revenue" | None (DB query) | $0 |
| "Add a pricing page" | Sonnet | $0.08 |
| "Write a blog post about..." | Sonnet | $0.12 |
| "Create Google Ads campaign" | Sonnet | $0.10 |
| "Build a restaurant review SaaS" | Opus | $0.80 |
| "Why is signup rate dropping?" | Haiku | $0.01 |
| Auto-resolve support ticket | Haiku | $0.005 |
| Weekly business report | Haiku | $0.02 |

### Monthly Cost Per Active User (estimated)
```
Average user sends ~200 commands/month:
  - 120 zero-cost (deploy, metrics, settings)    = $0
  - 50 Haiku (questions, support, summaries)      = $0.25
  - 25 Sonnet (features, content, campaigns)      = $2.50
  - 5 Opus (big builds, architecture)             = $4.00
  ─────────────────────────────────────────────────
  Total AI cost per user/month:                   ≈ $6.75
  
  If charging $49/month → gross margin ~86%
  If charging $99/month → gross margin ~93%
```

---

## File Structure

```
dalkkak-ai/
├── SPEC.md                    # This file (you are here)
├── CLAUDE.md                  # AI agent rules and conventions
├── AGENTS.md                  # Agent definitions and boundaries
├── COST.md                    # Cost tracking and optimization rules
│
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/
│   │   │   ├── page.tsx       # Main dashboard
│   │   │   ├── build/
│   │   │   ├── analytics/
│   │   │   ├── marketing/
│   │   │   ├── support/
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   └── auth/
│   ├── components/
│   │   ├── MetricCard.tsx
│   │   ├── CommandBar.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── InsightCard.tsx
│   │   └── ...
│   └── lib/
│       ├── api.ts             # API client
│       └── websocket.ts       # Real-time updates
│
├── backend/                   # FastAPI app
│   ├── main.py                # App entry point
│   ├── config.py              # Environment config
│   ├── database.py            # DB connection
│   │
│   ├── auth/
│   │   ├── router.py          # Auth endpoints
│   │   ├── service.py         # Auth logic
│   │   └── deps.py            # JWT dependencies
│   │
│   ├── startups/
│   │   ├── router.py          # Startup CRUD
│   │   ├── service.py         # Business logic
│   │   └── schemas.py         # Pydantic models
│   │
│   ├── sessions/
│   │   ├── router.py          # Session management
│   │   ├── service.py         # Session lifecycle
│   │   └── schemas.py
│   │
│   ├── agents/
│   │   ├── router.py          # AI agent endpoints
│   │   ├── ai_router.py       # ★ Smart cost router
│   │   ├── orchestrator.py    # LangGraph orchestrator
│   │   ├── build_agent.py     # Full startup builder
│   │   ├── feature_agent.py   # Feature implementation
│   │   ├── marketing_agent.py # Content generation
│   │   ├── support_agent.py   # Ticket resolution
│   │   └── advisor_agent.py   # Business insights
│   │
│   ├── deploy/
│   │   ├── router.py
│   │   ├── service.py         # Railway/GitHub API
│   │   └── health.py          # Health checking
│   │
│   ├── analytics/
│   │   ├── router.py
│   │   └── service.py         # Metrics aggregation
│   │
│   ├── marketing/
│   │   ├── router.py
│   │   └── service.py
│   │
│   ├── support/
│   │   ├── router.py
│   │   └── service.py
│   │
│   ├── billing/
│   │   ├── router.py
│   │   └── stripe_service.py  # Stripe integration
│   │
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py
│   │   ├── startup.py
│   │   ├── session.py
│   │   ├── deployment.py
│   │   ├── analytics.py
│   │   ├── support.py
│   │   └── marketing.py
│   │
│   └── websocket/
│       └── hub.py             # Real-time updates
│
└── infra/
    ├── Dockerfile
    ├── docker-compose.yml
    └── railway.toml
```

---

## Agent Boundaries (CRITICAL)

Each agent type owns specific files. Agents MUST NOT modify files outside their ownership.

| Agent | Owns | Never Touches |
|-------|------|---------------|
| Build Agent | All files during initial build | — |
| Feature Agent | backend/{module}/, frontend/components/ | auth/, billing/, deploy/ |
| Marketing Agent | marketing content, SEO, email templates | backend code, database |
| Support Agent | support/service.py, knowledge base | any backend logic |
| Advisor Agent | Read-only analysis | nothing (read-only) |
| Deploy Agent | infra/, deploy/ | business logic |

---

## 3-Day Prototype Scope

### Day 1: Backend Core
- [ ] FastAPI project setup with config
- [ ] Database models (User, Startup, Session, Conversation)
- [ ] Auth endpoints (register, login, JWT)
- [ ] Startup CRUD endpoints
- [ ] AI Router (classify user input, route to right model)
- [ ] Basic build agent (description → generated files)

### Day 2: Frontend + Integration
- [ ] Next.js project setup
- [ ] Dashboard home page (metrics, activity feed, AI insights)
- [ ] Build page (input → animated build steps)
- [ ] Command bar (universal natural language input)
- [ ] Connect frontend ↔ backend API
- [ ] WebSocket for real-time session updates

### Day 3: Deploy + Demo
- [ ] GitHub integration (auto-create repo)
- [ ] Railway deployment (auto-deploy generated project)
- [ ] Basic monitoring (uptime, error detection)
- [ ] End-to-end test: describe → build → deploy → live URL
- [ ] Record demo video
- [ ] Deploy DalkkakAI itself to production

### NOT in prototype (Phase 2+)
- Marketing automation
- Support chatbot
- Billing/Stripe
- Analytics dashboard (real data)
- Ad campaign management
- Mobile PWA
- Team features
