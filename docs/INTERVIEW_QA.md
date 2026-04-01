# DalkkakAI — Interview Q&A for Toronto IT Companies

> Prepared answers for technical interviews, grounded in the actual DalkkakAI codebase.
> Every answer references real files, real architecture decisions, and real trade-offs.

---

## 1. Architecture & System Design

### Q1: Walk me through the system architecture.

DalkkakAI is a platform where non-technical founders describe their startup idea and the system builds, deploys, monitors, and markets it — all from one dashboard. The architecture is a monolith-first design: a Next.js 14 frontend on Vercel communicates via REST and WebSocket with a Python FastAPI backend on Railway. The backend contains seven distinct modules — auth, startups, sessions, agents, deploy, billing, and terminal — each in its own directory with router, service, and schema files. The data layer uses PostgreSQL via Supabase for persistence, Redis via Upstash for caching and pub/sub, Qdrant Cloud for vector search in the support bot, and Cloudflare R2 for storing generated code artifacts.

The key insight is that the monolith handles 5K+ req/sec async, which covers us to 10,000 users. We have a documented Phase 2 migration plan in `docs/SPEC.md` where specific services move to Go only when measured bottlenecks hit defined thresholds — for example, the WebSocket hub moves to Go goroutines only when concurrent connections exceed 5K. Python stays forever for all AI work because LangGraph and the Claude SDK are Python-native ecosystems.

**Key files:** `backend/main.py` (app entry, router registration, lifespan), `docs/SPEC.md` (full architecture diagrams), `docs/ARCHITECTURE.md` (detailed per-module guide).

---

### Q2: Why FastAPI + Next.js? Why not Django/Rails?

FastAPI was chosen because every operation in this system is I/O-bound — calling the Claude API, querying PostgreSQL, reading from Redis, launching Docker containers. FastAPI is async-native with first-class `asyncio` support, so we never block the event loop waiting for an AI response. Django's ORM is synchronous by default, and while Django Async exists, the ecosystem (middleware, third-party packages) isn't fully async yet. Rails was never considered because the AI ecosystem — Claude SDK, LangGraph, LangChain, Qdrant client — is overwhelmingly Python.

Next.js 14 with App Router gives us server components by default for the landing page (SEO matters for marketing), while interactive dashboard components use `"use client"` only where needed. The combination of Tailwind CSS and shadcn/ui means we ship UI fast without writing CSS files. We use Vercel's free tier for frontend deployment, which gives us edge caching and automatic preview deploys on every PR.

**Key files:** `backend/config.py` (Pydantic Settings for type-safe config), `frontend/app/(marketing)/page.tsx` (server-rendered landing page).

---

### Q3: How do you handle concurrent sessions without conflicts?

This is one of the core differentiators. Each session gets its own git worktree — a separate directory on disk with its own branch, completely isolated from other sessions. In `backend/sessions/git.py`, the `create_worktree()` function creates a branch from main and then runs `git worktree add` to give that branch its own directory at `/workspace/{startup_id}/worktrees/{branch}`. Two sessions can write to completely different directories simultaneously with zero file conflicts.

The conflict prevention strategy is module-based splitting, documented in `docs/SESSION_RULES.md`: Session 1 owns `backend/auth/*`, Session 2 owns `backend/projects/*`, and they never touch the same files. Shared files like `main.py` and `requirements.txt` follow an append-only rule — sessions add new imports but never modify existing lines, so git auto-merges parallel additions cleanly. At merge time, `merge_session_branch()` in `backend/sessions/git.py` uses `--no-ff` to preserve branch history, and if conflicts occur, it aborts the merge and reports conflicting files for manual resolution.

**Key files:** `backend/sessions/git.py` (lines 101-139 for worktree creation, lines 197-236 for merge), `docs/SESSION_RULES.md` (7 rules for conflict-free parallel work).

---

### Q4: Explain your git worktree isolation strategy.

A git worktree is a lesser-known git feature that lets you check out multiple branches simultaneously in separate directories. Normal git gives you one working directory for one branch. With worktrees, we get `/workspace/{startup}/` on main plus `/workspace/{startup}/worktrees/session-login-abc123/` on a feature branch — both are live directories, both can have files written to them at the same time.

In `backend/sessions/git.py`, `create_worktree()` first calls `_ensure_repo()` which auto-initializes the git repo if it does not exist yet — this handles startups created before we added git-init. Then it creates a branch from main and runs `git worktree add`. The `cleanup_worktree()` function handles teardown after merge or cancellation: it removes the worktree, prunes stale references, and deletes the branch. This is critical because orphaned worktrees consume disk space and can cause lock file issues.

The worktree path is stored in the `sessions` table (`worktree_path VARCHAR`), so every part of the system — the executor, the terminal, the preview launcher — knows exactly where to find that session's files.

**Key files:** `backend/sessions/git.py` (complete worktree lifecycle), `backend/models/session.py` (worktree_path column).

---

### Q5: How does the AI executor work? Explain the ReAct loop.

The executor in `backend/agents/executor.py` implements a tool-use loop, which is essentially a ReAct (Reason + Act) pattern. Claude receives a system prompt describing the task, a conversation history, and a set of tool definitions. It reasons about what to do next, then calls a tool — `write_file`, `read_file`, `run_command`, `list_files`, `search_files`, or `session_complete`. The executor runs the tool, feeds the result back to Claude as context, and Claude decides the next step. This loop continues for up to 30 iterations.

The six tools are defined in `backend/agents/tools.py`. The `ToolExecutor` class handles each call within the session's worktree directory. It includes security measures: path traversal prevention (resolving paths and checking they stay inside the worktree), blocked commands (`git push`, `rm -rf`, `curl`, `sudo`), and output capping (stdout limited to 4000 chars, file content to 8000 chars). Every tool call is broadcast via WebSocket through `backend/websocket/hub.py`, so the frontend updates in real-time — the user sees files being written, tests running, and progress updating live.

Safety limits enforce a $5 cost cap, 30-minute time limit, and 30-iteration maximum per session. If any limit is hit, the executor returns a failure result and the session moves to error state.

**Key files:** `backend/agents/executor.py` (lines 186-376 for main loop), `backend/agents/tools.py` (tool definitions and ToolExecutor class).

---

### Q6: Why Docker-in-Docker for previews?

When a session finishes, the user needs to see their app running, not just read code. The preview system in `backend/sessions/preview.py` launches a Docker container for the session's worktree, mounts it as a volume, and maps a free port. The API container itself runs in Docker, so it needs access to the Docker daemon to create sibling containers — that is why we mount `/var/run/docker.sock` in `docker-compose.yml`.

Technically this is not Docker-in-Docker (DinD) but Docker-out-of-Docker (DooD). The API container creates preview containers on the host's Docker daemon. Each preview gets an isolated PostgreSQL schema (not a separate database) via `_create_preview_db_schema()`, a unique container name (`dalkkak-preview-{session_id[:12]}`), and a dynamically assigned free port. The `_detect_app()` function uses a 7-priority detection chain: `dalkkak.json` > `Procfile` > `Dockerfile` > `package.json` > Python framework scan > `index.html` > unknown fallback. This was a hard-won lesson after multiple preview failures — AI generates code in unpredictable structures, so hardcoded file detection always fails.

**Key files:** `backend/sessions/preview.py` (complete preview system, 673 lines), `docker-compose.yml` (line 64 for socket mount).

---

### Q7: How do you handle cost optimization for AI API calls?

Cost optimization is a first-class concern, not an afterthought. Every request goes through the AI Router in `backend/agents/ai_router.py`, which implements a two-step classification pipeline. Step 1 is free: regex pattern matching catches obvious commands like "deploy" or "show me my revenue" and routes them to zero-cost handlers (DB queries, scripts). Step 2 costs ~$0.001: Haiku classifies ambiguous requests into one of 22 task categories, each mapped to the cheapest capable model — Haiku for classification and short answers, Sonnet for code generation and content, Opus only for full builds and major architecture decisions.

Beyond routing, we enforce per-session cost limits ($5 auto-pause, $2 warning) in the executor, set `max_tokens` appropriately per model tier (Haiku: 500, Sonnet: 4000, Opus: 8000), and cache AI responses in Redis with tiered TTLs (1 hour for classification, 24 hours for content). Every AI call is logged with model, tokens in/out, cost in USD, and duration, which powers both user-facing "AI credits used" meters and internal cost dashboards. The `_add_cost()` method in the executor uses actual per-million-token pricing to track costs accurately.

**Key files:** `backend/agents/ai_router.py` (full routing pipeline), `docs/COST.md` (cost hierarchy and caching strategy), `backend/agents/executor.py` (lines 380-393 for cost tracking).

---

### Q8: What is your database schema design philosophy?

Every table follows strict conventions documented in `CLAUDE.md`: UUID primary keys (never auto-increment integers — they leak information and cause issues in distributed systems), `created_at` and `updated_at` timestamps on every table, and soft deletes via a `deleted_at` column — we never run `DELETE FROM`. Every foreign key has explicit `ON DELETE` behavior, and every column used in `WHERE` clauses gets an index.

The schema is managed exclusively through Alembic migrations — never direct schema changes. Migrations run automatically on API startup in `backend/main.py` via `_run_migrations()`, which calls `alembic upgrade head` programmatically. The data model is designed around the domain: `users` own `startups`, startups have `sessions`, sessions have `session_messages` and `session_file_changes`. Each session tracks its own cost (`total_cost DECIMAL(10,4)`), token usage, and test results as JSONB. Pydantic v2 schemas in each module's `schemas.py` handle validation — we trust nothing from outside.

**Key files:** `backend/models/` (SQLAlchemy models), `docs/SESSIONS.md` (lines 65-148 for session schema), `docs/SPEC.md` (lines 317-436 for all data models).

---

### Q9: How would you scale this to 10,000 users?

The Phase 1 monolith handles this comfortably. FastAPI async serves 5K+ req/sec from a single process, and our infrastructure cost at 10K users is estimated at ~$6,845/month against $490,000/month revenue (98.6% margin). The scaling plan is metrics-driven: we have documented triggers in `docs/SPEC.md` for when each component needs to be extracted.

The API gateway moves to Go Fiber when p95 latency exceeds 200ms. The WebSocket hub moves to Go goroutines when concurrent connections exceed 5K. The session manager moves to Go when concurrent worktrees exceed 100. The database scales vertically first (Supabase handles this), then adds read replicas for analytics queries. Redis moves from Upstash to Redis Cluster for 100K+ WebSocket connections. The Go and Python services communicate via Redis message queue initially, upgrading to gRPC when we need streaming and type safety. Python stays forever for all AI work — LangGraph, Claude SDK, Qdrant client, pandas — the AI ecosystem is Python.

**Key files:** `docs/SPEC.md` (lines 93-313 for Phase 2 architecture and cost projections).

---

### Q10: What trade-offs did you make and why?

The biggest trade-off is monolith over microservices in Phase 1. We sacrifice horizontal scaling for development speed — one deploy, one log stream, one debuggable process. Given that we are a pre-revenue startup, shipping fast matters more than handling theoretical load.

Second, we chose polling (10-second intervals in `backend/sessions/queue.py`) over event-driven queue processing. A Redis-based event queue would be more efficient, but polling is simpler to debug and the 10-second latency is invisible to users. We also chose in-memory WebSocket state (`backend/websocket/hub.py` uses a simple `defaultdict(list)`) over Redis pub/sub, which means we cannot run multiple API replicas yet — but we do not need to until Phase 2.

Third, we use Docker-out-of-Docker for previews, which means the API container has access to the host's Docker daemon — a security risk in production. The trade-off is simplicity: DinD would require privileged containers and adds significant complexity. For production, we would isolate preview containers in a separate network with restricted capabilities.

**Key files:** `backend/sessions/queue.py` (polling architecture), `backend/websocket/hub.py` (in-memory hub with Phase 2 migration note at line 33).

---

## 2. AI & Agent Systems

### Q11: Explain the difference between single-agent and multi-agent.

A single-agent system has one AI model handling everything — one context window, one conversation, one set of capabilities. DalkkakAI uses a multi-agent architecture with seven specialized agent types defined in `docs/AGENTS.md`: Router, Build, Feature, Fix, Marketing, Support, and Advisor. Each agent has a specific job, a specific model assignment, and strict file ownership boundaries.

The critical difference is that agents do not communicate directly with each other. They share state through the database, not through message passing. If the Feature Agent needs user data that the Advisor Agent typically provides, it queries the database directly rather than calling the Advisor Agent. This prevents cascading failures and keeps costs predictable. The Router Agent (Haiku, <$0.002) classifies every incoming request and routes to the appropriate specialist agent, acting as a cost-conscious gatekeeper.

**Key files:** `docs/AGENTS.md` (all 7 agent types with boundaries), `backend/agents/ai_router.py` (Router Agent implementation).

---

### Q12: What are the 8 layers of agent sophistication?

This is documented in `logs/troubleshooting/2026-03-23_agent_sophistication_layers.md` and represents our roadmap for making AI agents progressively smarter. Layer 1 is multi-tool convention files — auto-generating `CLAUDE.md`, `.cursorrules`, `.codex/instructions`, and `.github/copilot-instructions.md` so any AI tool follows our conventions. Layer 2 is context injection — auto-injecting project structure, existing API interfaces, and DB schema at session start to prevent conflicts.

Layer 3 is tool restriction per session type — feature sessions get write access, fix sessions get limited write, review sessions are read-only. Layer 4 is a memory system using Redis for short-term and Qdrant for long-term pattern storage. Layer 5 is a feedback loop where approve/reject signals reinforce or suppress patterns. Layer 6 is PM Agent orchestration where a meta-agent decomposes "build a shopping mall" into 4 parallel sub-agents. Layer 7 is quality gates — automated linting, security scanning, and test coverage checks. Layer 8 is ontology integration — a domain knowledge graph that gives agents understanding of relationships between modules.

Layers 1-3 are implemented now. Layers 4-7 are Phase 2. Layer 8 is Phase 3.

---

### Q13: How does CLAUDE.md control agent behavior?

CLAUDE.md is a convention file that Claude Code reads automatically when it runs in a directory. On startup creation, DalkkakAI auto-generates a `CLAUDE.md` in `/workspace/{startup_id}/` with rules like: always create `dalkkak.json` (start command + port), bind to `0.0.0.0` (Docker networking requirement), implement a `/health` endpoint, use `.env` for environment variables, and include `requirements.txt` or `package.json`. This is documented in `logs/troubleshooting/2026-03-23_product_differentiation.md`.

The key insight is that the same Claude model produces dramatically better code when given structured rules. Without CLAUDE.md, Claude might generate code that works locally but fails in Docker. With it, the generated code is always deployable — the Test button works on first click. We extend this further with plan-based CLAUDE.md tiers: Free gets basic rules, Starter adds TDD and error handling, Growth adds ReAct patterns and security checks (OWASP), and Scale adds performance optimization and auto-scaling configuration. This is our primary product differentiator — rules-as-a-service for AI code generation.

**Key files:** `CLAUDE.md` (our own project's rules file), `logs/troubleshooting/2026-03-23_product_differentiation.md` (differentiation analysis).

---

### Q14: How do you prevent AI hallucination in code generation?

We use several concrete mechanisms. First, the executor's tool-use loop forces Claude to interact with the real filesystem — it calls `list_files` to see what exists, `read_file` to understand existing code, and `run_command` to execute tests. Every tool result feeds back into context, grounding the next response in reality rather than hallucination. In `backend/agents/executor.py`, the system prompt explicitly says "Read existing files before modifying them" and "Run tests after making changes — fix failures before proceeding."

Second, tool results are capped (`_format_tool_result` truncates at 8000 chars) and test output is streamed back, so Claude sees actual test failures and can correct its mistakes. Third, safety limits prevent runaway hallucination loops — if Claude produces 3+ identical outputs, the session auto-pauses. Fourth, the ToolExecutor in `backend/agents/tools.py` blocks dangerous commands (`git push`, `rm -rf`, `curl`, `sudo`) and prevents path traversal attacks. The session_complete tool requires a summary, forcing Claude to articulate what it actually did rather than just stopping.

**Key files:** `backend/agents/executor.py` (lines 86-102 for system prompt rules), `backend/agents/tools.py` (lines 169-174 for blocked commands, lines 181-191 for path traversal prevention).

---

### Q15: What is your approach to AI cost management?

We treat AI cost as a product feature, not a backend concern. The cost hierarchy in `docs/COST.md` is: zero-cost first (DB query, cache, template, regex), then Haiku ($0.25/1M tokens), then Sonnet ($3/1M tokens), then Opus ($15/1M tokens) only for full builds. The AI Router in `backend/agents/ai_router.py` enforces this with a two-step pipeline: regex catches zero-cost commands for free, then Haiku classifies ambiguous requests for ~$0.001.

Per-user monthly budgets are plan-based: Free gets $1, Starter $5, Growth $15, Scale $50. When a user hits 80% of their budget, we automatically downgrade non-critical tasks to Haiku. At 100%, AI generation pauses but zero-cost operations keep working. Per-session, there is a hard $5 cap enforced in `backend/agents/executor.py` at line 211. We log every AI call with model, token counts, cost, and duration, enabling us to optimize routing rules over time — if Haiku handles 95% of a task category correctly, we stop using Sonnet for it.

**Key files:** `backend/agents/ai_router.py`, `docs/COST.md`, `backend/config.py` (lines 68-78 for budget and concurrency settings).

---

### Q16: How would you implement ontology for domain-specific agents?

Ontology is Layer 8 in our agent sophistication roadmap — it means giving agents a structured knowledge graph of domain relationships. For example, in an e-commerce domain, the ontology would encode that "Product has many Reviews," "Order references User and Product," and "Payment must happen before Shipping." This goes beyond CLAUDE.md rules into semantic understanding.

The practical implementation would use Qdrant (already in our stack for RAG) to store domain-specific embeddings: API interface contracts, database relationship graphs, and common patterns for each vertical (SaaS, e-commerce, marketplace). When a session starts, we would query Qdrant with the task description to retrieve relevant domain knowledge and inject it into the agent's context window. The key challenge is building quality training data — we would start by encoding our own SPEC.md and SESSION_RULES.md as structured knowledge, then expand per-vertical as we onboard users in specific industries.

**Key files:** `docs/SUPPORT.md` (Qdrant RAG implementation for support bot — same vector DB would power ontology), `logs/troubleshooting/2026-03-23_agent_sophistication_layers.md` (Layer 8 specification).

---

### Q17: Explain tool-use / function-calling in LLMs.

Tool use is how we give Claude "hands." Instead of just generating text, Claude can call predefined functions — write a file, run a test, read code. The mechanism works through the Anthropic Messages API: we send `tools=TOOL_DEFINITIONS` alongside the conversation, and Claude responds with `tool_use` content blocks containing the function name and input parameters. Our six tools are defined in `backend/agents/tools.py` with JSON Schema input definitions.

The flow is: Claude sees the task description and tool schemas, reasons about what to do, and emits a `tool_use` block like `{"name": "write_file", "input": {"path": "server.js", "content": "..."}}`. The executor in `backend/agents/executor.py` intercepts this, calls `ToolExecutor.execute()`, gets the result, and sends it back as a `tool_result` message. Claude sees the result and decides the next action. This is fundamentally different from code generation alone — it is an agentic loop where the model interacts with the real environment, observes outcomes, and adapts.

The `session_complete` tool is special — it signals that all work is done. When Claude calls it, the executor breaks out of the loop, commits the work via `_commit_work()`, and transitions the session to review state.

**Key files:** `backend/agents/tools.py` (lines 26-156 for all tool definitions), `backend/agents/executor.py` (lines 274-298 for tool call processing).

---

### Q18: How do you evaluate AI-generated code quality?

We have multiple layers of evaluation. First, the agent itself runs tests after making changes — the system prompt instructs Claude to "run tests after each significant change" and "fix failures before continuing." After the executor completes, the queue worker in `backend/sessions/queue.py` auto-runs the test suite via `backend/sessions/test_runner.py` and stores results as JSONB in the session record (passed, failed, errors, skipped counts).

Second, the preview system in `backend/sessions/preview.py` launches the generated app in a real Docker container. If it crashes on startup, the health check fails and the user sees the error. This catches issues that unit tests miss — missing dependencies, wrong port bindings, import errors. Third, the CLAUDE.md rules enforce coding standards: max 300 lines per file, type hints on every function, docstrings, proper error handling, and English-only code artifacts. Fourth, the merge process in `backend/sessions/git.py` runs integration tests after merging — if tests fail post-merge, it rolls back automatically. We are planning Layer 7 (quality gates with ESLint, Ruff, Snyk) for Phase 2.

**Key files:** `backend/sessions/queue.py` (lines 149-174 for auto-test after execution), `backend/sessions/test_runner.py`, `backend/sessions/preview.py`.

---

## 3. DevOps & Infrastructure

### Q19: Explain your Docker setup.

The `docker-compose.yml` defines four services: `db` (Postgres 16 Alpine), `redis` (Redis 7 Alpine), `api` (our FastAPI backend), and `test` (pytest runner, only starts with `--profile test`). The API service builds from our Dockerfile, mounts the project root for live code reload, mounts `/workspace` for persistent startup repos, mounts the Docker socket for creating preview containers, and mounts a named volume for Claude Code authentication persistence.

Health checks are defined on all services — Postgres uses `pg_isready`, Redis uses `redis-cli ping`, and the API uses `curl http://localhost:8000/health`. The API depends on both `db` and `redis` with `condition: service_healthy`, so it only starts after dependencies are confirmed healthy. The startup command chains `alembic upgrade head` with `uvicorn --reload`, ensuring migrations run before the server accepts traffic. Environment variables like `HOST_PROJECT_ROOT` are needed for Docker volume mounts — when the API container creates a preview container, it needs to map worktree paths from container paths to host paths.

**Key files:** `docker-compose.yml` (106 lines, complete dev stack), `Dockerfile`.

---

### Q20: How does the preview system work end-to-end?

When a user clicks "Test" or when the queue worker finishes a session, `launch_preview()` in `backend/sessions/preview.py` executes a seven-step pipeline. Step 1: check Docker availability. Step 2: auto-detect the app type using a 7-priority chain (`dalkkak.json` > `Procfile` > `Dockerfile` > `package.json` > Python scan > `index.html` > unknown). Step 3: create an isolated PostgreSQL schema for this preview. Step 4: find a free TCP port using `socket.bind(("", 0))`. Step 5: build the `docker run` command with the worktree mounted as a volume. Step 6: start the container. Step 7: poll for health until the app responds or timeout (15 seconds).

The app detection deserves special attention. It was a source of repeated bugs documented in `logs/troubleshooting/2026-03-23_preview_detection.md`. AI generates code in unpredictable structures — Claude might name the entry point `app.py`, `main.py`, or `server.py`. The `_detect_python_framework()` function scans file contents for `FastAPI(`, `Flask(`, or `django` imports rather than relying on filenames. Port detection similarly scans source files for patterns like `PORT=`, `.listen(`, and `--port`. This smart detection is why the Test button works reliably despite the diversity of AI-generated code.

**Key files:** `backend/sessions/preview.py` (complete implementation), `logs/troubleshooting/2026-03-23_preview_detection.md`.

---

### Q21: How do you handle environment variables and secrets?

All configuration is centralized in `backend/config.py` using Pydantic Settings v2. The `Settings` class inherits from `BaseSettings` and loads values from a `.env` file. Every field maps 1:1 to an environment variable — `DATABASE_URL`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, etc. Pydantic validates types at startup, so a missing required field like `DATABASE_URL` causes an immediate, clear error rather than a runtime crash.

Secrets are never committed — `.env` is in `.gitignore`. In Docker, environment variables are set in `docker-compose.yml` with fallback defaults for dev (`ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-placeholder}`). In production on Railway, secrets are set via the Railway dashboard and injected as environment variables. The CORS origins setting is stored as a comma-separated string and exposed as a list via a property — this avoids JSON parsing issues with Pydantic Settings. API keys for users' own Anthropic accounts (BYOK — bring your own key) are stored in the `users` table and passed to the executor, never logged or exposed in API responses.

**Key files:** `backend/config.py` (92 lines, complete settings), `docker-compose.yml` (lines 44-53 for env vars), `CLAUDE.md` (security rules).

---

### Q22: What is your CI/CD strategy?

Currently we use a trunk-based development model where `main` is always deployable. Branch naming follows `feat/name`, `fix/name`, `chore/name` conventions. Tests run via `docker-compose --profile test up --abort-on-container-exit`, which starts the full stack (Postgres, Redis, API) and then runs pytest. The test container depends on the API being healthy before starting.

For production deployment, Railway auto-deploys from the `main` branch on GitHub push. The deploy pipeline is: push to GitHub, Railway detects the change, builds the Docker image, runs health checks (`GET /health`), and if healthy, routes traffic to the new version. If the health check fails, Railway keeps the old version running. For the frontend, Vercel auto-deploys from `main` with preview deploys on every PR. The gap in our current setup is automated testing in CI before merge — we plan to add GitHub Actions that run the Docker test profile on every PR. Database migrations run automatically on startup via `_run_migrations()` in `backend/main.py`, so deploys handle schema changes seamlessly.

**Key files:** `backend/main.py` (lines 165-182 for auto-migration), `docker-compose.yml` (test profile), `docs/DEPLOY.md` (deployment flow).

---

### Q23: How would you monitor this in production?

The monitoring architecture is documented in `docs/MONITORING.md`. There are four components: a Health Checker that pings `/health` every 60 seconds, an Error Tracker that categorizes 5xx responses by type, a Metrics Collector for request rate, response time, and error rate, and an Alert Engine with severity thresholds (error rate >5% for 5 minutes = WARN, >15% for 2 minutes = CRITICAL).

The differentiator is the Auto-Healer. It maintains a dictionary of known fixes (`KNOWN_FIXES` in `docs/MONITORING.md`) — for example, "connection pool exhausted" maps to increasing `DB_POOL_SIZE`, which costs $0 and does not need AI. Unknown errors get analyzed by Haiku for $0.005. For external tooling, we use Sentry for error tracking (5K errors/month free tier), PostHog for analytics (1M events/month free), and Resend for alert emails. Every AI call is already logged with model, tokens, cost, and duration in the session record, which doubles as our AI-specific monitoring.

**Key files:** `docs/MONITORING.md` (full monitoring spec with data models and API endpoints), `backend/main.py` (health endpoint at line 117).

---

### Q24: How do you handle database migrations?

Alembic manages all schema changes. We never modify the database schema directly. To add a field, you update the SQLAlchemy model, then run `alembic revision --autogenerate -m "add billing fields"` which diffs the models against the current schema and generates a migration script. These scripts are committed to version control.

On every API startup — whether local development, Docker, or production — `_run_migrations()` in `backend/main.py` calls `alembic upgrade head` programmatically. This means deploys are self-migrating: push code with a new migration, Railway builds the container, the API starts, migrations run, and the schema is updated before the server accepts traffic. If a migration fails, the startup aborts with a clear error rather than running against a stale schema. The key rule is that migrations must be backward-compatible — we never drop columns, only add them or make them nullable. Soft deletes (`deleted_at` column) mean we never run `DELETE FROM`, which prevents data loss and allows recovery.

**Key files:** `backend/main.py` (lines 165-182), `backend/database.py`, `alembic/` directory.

---

## 4. Frontend & UX

### Q25: Why Next.js App Router over Pages Router?

App Router gives us React Server Components by default, which is critical for the landing page — it renders on the server with zero JavaScript bundle for static content, giving us better SEO and faster initial load. The `(marketing)` route group in `frontend/app/(marketing)/page.tsx` is a server-rendered landing page with hero, pricing, and FAQ sections. Only interactive components like the dashboard, terminal, and session cards use `"use client"`.

App Router also gives us nested layouts. The `(marketing)/layout.tsx` has no sidebar (clean landing page), while `(dashboard)/layout.tsx` includes the sidebar navigation. Route groups with parentheses like `(auth)` and `(dashboard)` let us organize routes without affecting URL paths. The `useParams` hook from `next/navigation` gives us type-safe route parameters. The startup detail page at `frontend/app/(dashboard)/startups/[id]/page.tsx` uses dynamic routes to load the session grid for each startup.

**Key files:** `frontend/app/(marketing)/page.tsx`, `frontend/app/(dashboard)/layout.tsx`, `frontend/app/(dashboard)/startups/[id]/page.tsx`.

---

### Q26: How did you implement i18n?

We built a lightweight i18n system from scratch in `frontend/lib/i18n/index.ts` rather than using a heavy library like `next-intl` or `react-i18next`. It uses React Context: a `LanguageProvider` wraps the app, and the `useT()` hook returns a translation function `t()`, the current language code, and a `setLang()` setter. Translations are stored as TypeScript objects with a `TranslationKey` type that gives compile-time safety — if you reference a key that does not exist, TypeScript catches it.

The default language is Korean (the primary market is Korean solo founders) with English as a secondary language. Language preference persists to `localStorage` with SSR-safe hydration — we read `localStorage` in a `useEffect` after mount to avoid hydration mismatches. The landing page uses `t("landing.heroHeadline1")` for all visible text. A language toggle in the header switches between `ko` and `en` files. This is simple, type-safe, has zero runtime dependencies, and covers our two-language requirement without the 50KB bundle cost of i18next.

**Key files:** `frontend/lib/i18n/index.ts` (113 lines, complete i18n system), `frontend/app/(marketing)/page.tsx` (using `useT()` hook).

---

### Q27: How does the web terminal work (xterm.js)?

The terminal is a full PTY (pseudo-terminal) in the browser, not a command-line simulator. On the frontend, `frontend/app/components/Terminal.tsx` dynamically imports xterm.js with the FitAddon (auto-resize) and WebLinksAddon (clickable URLs). It connects via WebSocket to `/ws/terminal/{session_id}` and sends every keystroke as binary data. On the backend, `backend/terminal/router.py` creates a tmux session in the session's worktree directory, then attaches to it via a PTY using Python's `pty.openpty()`.

tmux is the persistence layer. When the user refreshes the page, the WebSocket disconnects, but the tmux session stays alive — Claude Code keeps running. On reconnect, the terminal re-attaches to the same tmux session. The frontend implements auto-reconnect with up to 5 retries at 3-second intervals, plus a ping/pong heartbeat every 25 seconds to prevent idle disconnects. Copy/paste works via `Ctrl+C` (copies selection, sends SIGINT otherwise) and `Ctrl+V`. Resize events are forwarded from the browser's `ResizeObserver` through the WebSocket to `tmux resize-window`. The terminal uses a Tokyo Night color theme with JetBrains Mono font and 10,000 lines of scrollback.

**Key files:** `frontend/app/components/Terminal.tsx` (404 lines), `backend/terminal/router.py` (270 lines).

---

### Q28: How did you split a 900-line component into modules?

The startup detail page originally grew to over 900 lines with session cards, session detail views, file viewers, modals, and status badges all in one file. We refactored following the 300-line-per-file rule from `CLAUDE.md`. The page itself at `frontend/app/(dashboard)/startups/[id]/page.tsx` was reduced to ~170 lines — it acts as an orchestrator that loads data, manages state, and delegates all rendering to child components.

The split created dedicated components: `SessionCard.tsx` (individual session card with progress bar, cost, test counts), `SessionDetail.tsx` (full detail view with chat, files, and test tabs), `FilesViewer.tsx` (file tree + code content viewer), `CreateSessionModal.tsx` (new session form), and `StatusBadge.tsx` (status indicators with action buttons). A shared types file defines the `Session` and `Startup` interfaces as a contract between components. Communication follows a strict parent-to-child props pattern: the page passes data down and receives action callbacks (`onAction`, `onOpen`, `onBack`) that trigger data reloads.

**Key files:** `frontend/app/(dashboard)/startups/[id]/page.tsx` (orchestrator), `frontend/app/components/sessions/` (all split components), `docs/ARCHITECTURE.md` (lines 573-635 for component communication diagram).

---

## 5. Problem Solving & Debugging

### Q29: Tell me about a hard bug you solved.

The preview system repeatedly failed because the app detection was hardcoded to look for `main.py` for Python apps. But Claude sometimes generated `app.py`, `server.py`, or `run.py`. This is documented in `logs/troubleshooting/2026-03-23_preview_detection.md`. The first fix was expanding the filename list, but that was whack-a-mole — every new AI-generated structure broke it again.

The root cause was treating AI-generated code like human-written code with predictable conventions. The fix was a complete rewrite of `_detect_app()` in `backend/sessions/preview.py` with a 7-priority detection chain. Instead of checking filenames, we now scan file contents — `_detect_python_framework()` reads the first 8KB of each Python file looking for `FastAPI(`, `Flask(`, or `django` imports. Port detection similarly scans source files for regex patterns like `PORT=`, `.listen(`, and `--port`. The `dalkkak.json` convention file was added as the highest-priority override — if it exists, we use its explicit config and skip all heuristics. This solved the problem permanently because it handles any code structure the AI generates.

**Key files:** `backend/sessions/preview.py` (lines 258-302 for Python framework scanning, lines 310-480 for full detection chain), `logs/troubleshooting/2026-03-23_preview_detection.md`.

---

### Q30: What was your biggest architectural mistake?

Early on, we claimed Go was not in our stack after skimming SPEC.md rather than reading it thoroughly. This led to incorrect architecture recommendations and wasted effort. The lesson became a rule in `CLAUDE.md`: "DON'T claim something isn't in the stack without reading SPEC.md fully (Go mistake)." This specific incident is why we have a Mandatory Reading Protocol — every session must read all 11 docs in `docs/` before writing any code.

A second significant mistake was the "verify before done" problem. Multiple times, code changes were declared "fixed" without actual testing. The API would return 200 OK in theory but crash in Docker because of a missing environment variable or an import path that worked locally but not in the container. This led to the RULE #0 in CLAUDE.md: every code change must be verified with actual evidence — curl the endpoint and paste the response, run docker-compose and show docker ps, click the button and show the URL works. "Fixed without showing test output" is now explicitly listed as forbidden.

**Key files:** `CLAUDE.md` (Rule #0 for verification, Common Mistakes section for the Go incident).

---

### Q31: How do you approach debugging in a distributed system?

In Phase 1 it is a monolith, which makes debugging straightforward — one log stream, one process, everything in one place. The global exception handler in `backend/main.py` catches all unhandled exceptions, logs the full traceback internally, and returns a clean `{"ok": false, "error": "..."}` to the client. We never expose Python tracebacks to users.

For the parts that are distributed — the API container creating preview containers via Docker, WebSocket connections between frontend and backend, and external API calls to Claude, Stripe, and Railway — we follow a pattern of structured logging at every boundary. The executor logs every tool call (`logger.info("Tool call: %s %s", tool_name, list(tool_input.keys()))`). The WebSocket hub logs connection counts. The preview system logs detection results and container status. Every session records its cost, token usage, and model calls in the database, so we can reconstruct exactly what happened. For production, Sentry captures errors with full context, and PostHog tracks user-facing analytics events.

**Key files:** `backend/main.py` (lines 98-113 for exception handlers), `backend/agents/executor.py` (logging throughout), `backend/websocket/hub.py` (connection tracking).

---

### Q32: What would you do differently if starting over?

First, I would implement the preview detection system correctly from day one — scanning file contents rather than matching filenames. The weeks spent debugging hardcoded detection were preventable if we had anticipated that AI generates code in unpredictable structures.

Second, I would use an event-driven architecture for the session queue from the start. The current polling approach (10-second intervals in `backend/sessions/queue.py`) works fine but wastes cycles. A Redis Streams or pub/sub approach would give instant session dispatch and scale better. Third, I would establish the Mandatory Reading Protocol earlier — the rule that every session must read all docs before coding. Many bugs came from incomplete context (the Go stack incident, wrong data model assumptions, missing API contract details). Fourth, I would build the i18n system before writing any UI text rather than retrofitting it. The translation key approach works well, but extracting hardcoded strings into translation files after the fact is tedious error-prone work.

---

### Q33: How do you prioritize features vs bug fixes?

The priority hierarchy is: (1) broken production functionality — if the Test button does not work or sessions crash, that blocks everything. (2) Verification gaps — if we cannot prove something works, it is effectively a bug. This comes from CLAUDE.md Rule #0: "test evidence without completion is a lie." (3) User-visible features that unblock revenue — the Build, Test, Deploy pipeline matters more than the Marketing module because users cannot pay until they see their app working. (4) Developer experience — tooling, documentation, and architecture improvements that make future work faster.

Concretely, we track this through the session system itself. A "fix" session type exists alongside "feature" and "build." Fix sessions use Sonnet by default with automatic escalation to Opus if the first fix fails, as defined in `docs/AGENTS.md`. The session queue respects priority levels (1-10), so urgent fixes can jump ahead of feature work. The broader principle is that we ship fast (Phase 1 is a 3-day prototype scope defined in `docs/SPEC.md`) and fix fast, rather than trying to build everything perfectly upfront.

**Key files:** `docs/SPEC.md` (lines 736-758 for 3-day prototype scope), `docs/AGENTS.md` (Fix Agent definition with escalation rules).
