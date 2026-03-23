# Product Differentiation — Core Elements
## 2026-03-23

---

### Differentiation #1 — DalkkakAI-Native CLAUDE.md (Biggest Moat)

**How it works:**
On startup creation, `/workspace/{id}/CLAUDE.md` is auto-generated.
When Claude Code runs in that directory, it automatically reads CLAUDE.md.
→ Our rules are applied to Claude Code's behavior without any user effort.

**Rules included:**
1. Must generate `dalkkak.json` (start command + port)
2. Servers must bind to 0.0.0.0 (required for Docker networking)
3. Must include `/health` endpoint (for health checks)
4. Environment variables via .env files
5. Must include requirements.txt / package.json

**Why this is a differentiator:**
- Other services (Devin, Cursor, Codex): Just give you raw Claude/GPT
- DalkkakAI: Provides Claude Code **with built-in conventions**
- Output is always in a "Test-button-ready" format
- Users don't need to know the rules — deploy-ready code is generated automatically

**Extensibility:**
- Per-plan CLAUDE.md (Free=basic, Scale=security+monitoring+performance)
- Per-domain CLAUDE.md (Manufacturing=sensor rules, Finance=security, Healthcare=HIPAA)
- User-custom CLAUDE.md (power users add their own rules)

---

### Differentiation #2 — Dual Mode (Terminal + Auto AI)

**Terminal mode:**
- Runs on user's own Claude Code/Codex subscription = $0 API cost
- Familiar environment for developers
- CLAUDE.md automatically applied → conventions enforced

**Auto AI mode:**
- Runs on platform API tokens, fully automated
- Accessible to non-developers
- Additional instructions via Chat

**Same UI, same Test button, same result.** Only the mode differs.

---

### Differentiation #3 — Parallel Sessions (tmux-style)

- Other AI coding tools: 1 session only
- DalkkakAI: 5–10 sessions running simultaneously
- Each session has an independent git worktree → zero conflicts
- SESSION_RULES.md for automatic coordination

---

### Differentiation #4 — Beyond Coding — Full Operations

```
Other services: Idea → Code (done)
DalkkakAI:      Idea → Code → Test → Deploy → Marketing → Billing → Support → Analytics
```

Phase 1: Coding + Testing + Deployment.
Phase 2–3: Marketing + Billing + Support + Analytics.

---

### Differentiation #5 — Smart App Detection

Any language, any framework — one Test button click to run.
dalkkak.json > Procfile > Dockerfile > auto-detect.
Zero hardcoding. Embraces the diversity of AI-generated code.

---

### Differentiation #6 — CLAUDE.md-Based Agent Sophistication System

**Key insight:**
Same Claude Code, but a single CLAUDE.md transforms junior-level → senior-level output.
Devin/Cursor don't have this — they just give you a raw LLM.
DalkkakAI provides **convention-embedded** AI.

**What CLAUDE.md can control:**
```
Basic: dalkkak.json, 0.0.0.0, /health, .env
Advanced:
  - ReAct pattern (Thought → Action → Observation loop)
  - TDD (write tests first)
  - Auto-retry on error (up to 3 times)
  - Auto-split files over 300 lines
  - OWASP Top 10 security checks
  - Performance optimization patterns
  - Architecture decision comments
  - Auto-generate CI/CD configuration
  - Auto-generate monitoring setup
```

**Per-plan differentiation:**
```
Free:
  Basic rules (dalkkak.json, /health, 0.0.0.0)

Starter ($29/mo):
  + TDD (test-first development)
  + Mandatory error handling
  + Auto-generate README

Growth ($99/mo):
  + ReAct reasoning pattern
  + Security checks (OWASP)
  + Auto-generate CI/CD config
  + Code review checklist

Scale ($299/mo):
  + Performance optimization patterns
  + Auto-generate monitoring setup
  + Microservice separation guide
  + Auto-scaling configuration
```

**Domain-specific CLAUDE.md templates:**
```
Manufacturing: Sensor integration rules, real-time data processing, alarm systems
Finance: Security rules (PCI DSS), transaction management, audit logs
Healthcare: HIPAA rules, PHI data encryption, access control
E-commerce: Payment integration, inventory management, shipping tracking
```

**Critical design decision: Defaults, not enforced**
```
Problem: Developers dislike forced rules
Solution: CLAUDE.md is a "default", not a "mandate"

Non-developers: Use defaults as-is → good code without knowing rules
Developers:     Settings → toggle rules ON/OFF
                Add custom rules
                Edit CLAUDE.md directly
                Can even delete it entirely

Result:
  Non-developers = protected (default rules guarantee quality)
  Developers = free (customize however they want)
  Both satisfied
```

---

### Summary: DalkkakAI Value Formula

```
Value = (Native CLAUDE.md) × (Dual Mode) × (Parallel Sessions) × (Full Ops) × (Agent Sophistication)
      = A combination no one else offers
      = "Idea → Revenue" one-stop platform
      = The only service that tiers AI coding quality via CLAUDE.md per plan
```

---
