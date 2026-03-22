# DalkkakAI Roadmap — ₩10B Revenue Target

> Last updated: 2026-03-22

---

## Mission

A solo founder describes their idea in plain language.
DalkkakAI builds it, deploys it, monitors it, markets it, handles support, and tracks revenue.
All from one dashboard. Zero terminal. Zero developer knowledge required.

**Core UX:** 딸깍 (one click). Complexity lives in our backend, never in the user's hands.

---

## Final Goal

**₩10 billion revenue. Level 11 Agent Society + Ontology.**

---

## Agent Level Hierarchy

```
Level 1  — Single Agent (LLM + Tools + Loop)
Level 2  — ReAct / CoT (Thought → Action → Observation)
Level 3  — Multi-Agent (Hierarchical / Swarm)
Level 4  — Meta-Agent (Agent creates/manages other Agents)
Level 5  — Self-Improving Agent (auto-fix prompts/tools)
Level 6  — Simulation / World Model (predict before execute)
Level 7  — Autonomous Goal Agent (goal → sub-goals → execute → evaluate)  ← Phase 1
Level 8  — Self-Evolving Agent (modify own code/architecture)
Level 9  — Multi-Domain Transfer (manufacturing → finance pattern transfer)
Level 10 — Collaborative Human-AI (equals, mutual correction)              ← Phase 3
Level 11 — Agent Society (hundreds of agents, autonomous org/disband)      ← Phase 4
```

### Ontology (orthogonal to Agent Levels)

```
Agent  = "what to do"  (action)
Ontology = "how to understand the world" (knowledge structure)

Document input → LLM entity/relation extraction → Neo4j Knowledge Graph
→ Agent queries graph → deep domain reasoning

Without ontology: "CNC-001 alarm occurred"
With ontology:    "Bearing wear likely. Product A delivery in 3 days. Immediate inspection recommended."
```

---

## Phase 1 — Ship Fast (Now ~ Month 3) — Level 7

**Goal:** Launch MVP, first paying customers

**Revenue target:** 50 Starter users × ₩100,000 = ₩5M/month

### What the user sees:
```
1. Sign up → Create startup → Describe idea
2. AI sessions run in parallel (tmux-style grid)
3. Each session: independent git worktree + branch
4. Code generated → auto-test → preview URL
5. Approve → Merge → Deploy (one click)
6. Dashboard shows all sessions, status, cost
```

### Features needed:
| Feature | Status |
|---------|--------|
| Auth (signup/login/JWT) | ✅ Done |
| Startup CRUD | ✅ Done |
| Session management (Auto AI + Terminal) | ✅ Done |
| AI Executor (Claude tool-use loop) | ✅ Done |
| Web terminal (xterm.js + tmux) | ⚠️ UX issues |
| Git worktree isolation per session | ✅ Done |
| Files tab (code viewer) | ✅ Done |
| Test button → Docker preview | ⚠️ Unstable |
| Chat → AI re-execution | ✅ Done |
| Preview hot-reload | ✅ Done |
| Terminal UX polish (scroll, height) | 🔲 Pending |
| Test button stabilization | 🔲 Pending |
| Merge (session → main branch) | 🔲 Pending |
| Deploy integration (Railway/Vercel) | 🔲 Pending |
| Stripe billing | 🔲 Pending |
| Landing page | 🔲 Pending |
| Beta launch | 🔲 Pending |

---

## Phase 2 — Differentiate (Month 3~6) — Level 8-9

**Goal:** Stand out from competitors, grow revenue

**Revenue target:** ₩30M/month

### Features:
- Self-improving Agent (failure → auto-analyze → fix → retry)
- Domain templates (manufacturing, medical, finance, e-commerce)
- GitHub auto-connect (private repo + push)
- Analytics dashboard (revenue, users, funnel)
- Marketing Agent (landing page, SEO, email sequences)
- Support Agent (RAG knowledge base, ticket auto-resolution)

---

## Phase 3 — Ontology + Human-AI (Month 6~12) — Level 10

**Goal:** Enterprise-grade, deep domain intelligence

**Revenue target:** ₩100M/month

### Features:
- Knowledge Graph auto-construction (Neo4j)
- Ontology-powered Agent reasoning
- Human-AI collaborative workflow (AI asks human when uncertain)
- Agentic RAG pipeline (Qdrant + ontology-guided retrieval)
- Text2SQL Agent (complex schema → natural language query)
- LLM-as-a-Judge evaluation system
- Hallucination detection module

---

## Phase 4 — Agent Society (Month 12+) — Level 11

**Goal:** ₩10B/year revenue

**Revenue target:** ₩830M/month

### Features:
- Hundreds of agents, autonomous organization/disbanding
- Market-economy agent coordination (auction/negotiation)
- Hire team (2-3 people, funded by Phase 1-3 revenue)
- Cross-domain transfer learning
- Self-evolving architecture

---

## Why Solo is Possible

```
1. DalkkakAI builds DalkkakAI (dogfooding)
2. Claude Code = 10 developers' output
3. Level 11 needs a team, but funded by Phase 1-3 revenue
4. Start solo → prove product-market fit → hire with revenue
```

## Monthly Cost (Phase 1)

| Item | Cost |
|------|------|
| Claude Code (Max plan) | $100/month |
| Auto AI sessions (API tokens) | ~$10-20 |
| Docker/server (local dev) | $0 |
| **Total** | **~$120/month** |
