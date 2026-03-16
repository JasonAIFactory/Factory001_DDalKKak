# LEARNING.md — Engineering Growth Log

> Newest entries first. Archive when exceeding 300 lines.
> Move oldest entries to LEARNING_ARCHIVE.md when archiving.

## Entry formats

```
#### [Concept] — YYYY-MM-DD
What: one sentence
Why: relevance to real work
Use: "interview-ready sentence"

#### Bug: [issue] — YYYY-MM-DD
Symptom: what happened
Cause: root cause
Fix: solution
Prevent: how to avoid next time

#### Decision: [what] — YYYY-MM-DD
Chose: option picked
Over: alternatives rejected
Because: reasoning
Revisit: trigger condition

#### Tool: [name] — YYYY-MM-DD
What: one sentence
Use when: scenario
Key: most important command or concept
```

---
<!-- NEW ENTRIES BELOW THIS LINE -->

#### gRPC for Go ↔ Python communication — 2026-03-16
What: Binary RPC framework for typed, streaming communication between services in different languages
Why: When DalkkakAI splits into Go + Python services, gRPC provides fast, type-safe messaging with proto definitions shared between both
Use: "We use gRPC for inter-service communication between our Go gateway and Python agent engine, with shared proto definitions as the contract"

#### Git worktrees — 2026-03-16
What: Multiple working directories from same repo, each on its own branch, existing simultaneously on disk
Why: Enables parallel AI agent sessions — each agent gets isolated files, zero conflicts until merge
Use: "We use git worktrees to isolate parallel workstreams and avoid merge conflicts during concurrent development"

#### Monolith-first architecture — 2026-03-16
What: Ship one process handling everything, extract services only when you can measure the bottleneck
Why: Solo founders waste months on premature microservices. Monolith → measure → extract the hot path
Use: "We started monolithic for velocity, then extracted the hot path into Go microservices as we scaled"

#### Strangler fig pattern — 2026-03-16
What: Gradually replace monolith pieces with microservices, one by one, without rewriting everything
Why: DalkkakAI's Phase 1→2 migration follows this — replace API gateway with Go first, then WebSocket, then session manager
Use: "We're using the strangler fig pattern to incrementally migrate high-throughput services from Python to Go"

#### AI cost router pattern — 2026-03-16
What: Classify every request before selecting an AI model — zero-cost first, then Haiku, Sonnet, Opus
Why: 60% of actions need zero AI. Routing saves 80% on AI costs
Use: "We implemented tiered model routing that reduced AI costs by 80% through intelligent request classification"

#### Spec-driven development — 2026-03-16
What: Define data models, API contracts, and boundaries in markdown BEFORE code
Why: Both AI agents and human teams need a shared contract to produce compatible code
Use: "We use spec-driven development where SPEC.md serves as the single source of truth"

#### Multi-tenant isolation — 2026-03-16
What: One platform serving many users with isolated data, resources, and deployments
Why: DalkkakAI manages all infrastructure — isolation prevents data leaks between tenants
Use: "The platform uses multi-tenant isolation with namespace separation and row-level security"

#### Decision: Python + TypeScript now, Go later — 2026-03-16
Chose: Python monolith + Next.js frontend
Over: Go microservices from day one, Rust, Kotlin
Because: Shipping speed > premature optimization. FastAPI handles 5K+ req/sec. Go comes at 10K+ users.
Revisit: p95 latency > 200ms or concurrent users > 10K

#### Decision: Web app not desktop — 2026-03-16
Chose: Web app (Next.js + Vercel)
Over: Desktop (Electron/Tauri), CLI tool
Because: Cross-platform, mobile-ready, no install, every $100M+ competitor is web-first
Revisit: Never. Add Tauri wrapper only if users demand it.

#### Decision: Startup OS not dev tool — 2026-03-16
Chose: "Startup operating system" at $49-99/user
Over: "Developer tool" at $20-29/user
Because: No competitor in startup OS space. Replaces $500+ of tools. Higher margin.
Revisit: If market says "we only want the coding part"

#### Tool: LangGraph — 2026-03-16
What: Python framework for stateful multi-agent AI workflows as directed graphs
Use when: Multiple AI agents need to coordinate on shared state with branching logic
Key: `from langgraph.graph import StateGraph`

#### Tool: Fiber (Go) — 2026-03-16
What: Express-inspired Go web framework, fastest Go HTTP router
Use when: Phase 2 API gateway needs 40K+ req/sec throughput
Key: `app := fiber.New()` — feels like Express.js but with Go performance
