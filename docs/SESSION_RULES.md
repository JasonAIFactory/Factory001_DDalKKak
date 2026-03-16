# SESSION_RULES.md — Module-Based Parallel Sessions

> Each session owns a module. Each module owns a directory. Directories don't overlap. Merges stay clean.

## Core Philosophy

DalkkakAI sessions work like a factory floor with production lines.
Each production line (session) builds one module (directory).
No two lines touch the same parts. When all lines finish,
the parts snap together because the interfaces were defined upfront.

## Rule 1: Split by Module, Not by Feature

```
WRONG — split by feature (causes conflicts):
  Session 1: "Add login endpoint"     → touches auth/router.py
  Session 2: "Add register endpoint"  → touches auth/router.py  ← CONFLICT!
  Session 3: "Add password reset"     → touches auth/router.py  ← CONFLICT!

RIGHT — split by module (zero conflicts):
  Session 1: "Auth module"      → OWNS entire backend/auth/ directory
  Session 2: "Project module"   → OWNS entire backend/projects/ directory
  Session 3: "Agent module"     → OWNS entire backend/agents/ directory
  Session 4: "Dashboard UI"     → OWNS entire frontend/app/dashboard/
```

## Rule 2: Each Session Owns a Directory

A session's ownership = one or more directories that NO other session touches.

```
Session 1 — Backend Auth
  OWNS:    backend/auth/*, backend/models/user.py
  CREATES: router.py, service.py, deps.py, jwt.py
  PREVIEW: feat-auth.dalkkak.ai

Session 2 — Backend Projects  
  OWNS:    backend/projects/*, backend/models/project.py, backend/models/startup.py
  CREATES: router.py, service.py, schemas.py
  PREVIEW: feat-projects.dalkkak.ai

Session 3 — Backend Agents
  OWNS:    backend/agents/*
  CREATES: orchestrator.py, ai_router.py, build_agent.py
  PREVIEW: feat-agents.dalkkak.ai

Session 4 — Frontend Dashboard
  OWNS:    frontend/app/dashboard/*, frontend/components/*
  CREATES: page.tsx, MetricCard.tsx, SessionPanel.tsx, CommandBar.tsx
  PREVIEW: feat-dashboard.dalkkak.ai
```

## Rule 3: Shared Files Are Pre-Defined

Some files MUST be touched by multiple sessions. These are defined
BEFORE sessions start, so all sessions know what to expect.

```
Shared files (managed by orchestrator, not by sessions):

  backend/main.py          ← Router imports (one line per module)
  backend/database.py      ← DB connection (created once, never modified)
  backend/config.py        ← Environment config (created once)
  backend/models/__init__.py  ← Model exports
  requirements.txt         ← Dependencies
  
How shared files work:
  1. Orchestrator creates these files BEFORE any session starts
  2. Each session can ADD lines (imports, dependencies) but never MODIFY existing lines
  3. Git auto-merges parallel additions cleanly
  4. If a session needs to CHANGE a shared file, it flags it for manual review
```

## Rule 4: Interfaces Before Implementation

Before sessions start, the orchestrator defines the contracts between modules.

```
Example: Auth module and Project module both need User model.

SPEC.md defines the interface:
  User = { id: UUID, email: str, name: str, created_at: datetime }
  get_current_user() returns User (defined in backend/auth/deps.py)

Session 1 (Auth) implements:
  backend/auth/deps.py → get_current_user() function

Session 2 (Projects) uses:
  from backend.auth.deps import get_current_user
  
They never touch each other's files.
They connect through the pre-defined interface.
```

## Rule 5: Session Count Guidelines

```
Full startup build:          3-4 sessions
  Backend core + Backend features + Frontend + Infra

Adding a major feature:      2-3 sessions  
  Backend changes + Frontend changes + Tests

Quick fix or small feature:  1 session
  Don't parallelize small tasks — overhead > benefit

Maximum concurrent:          5 sessions
  More than 5 = coordination overhead kills the speed gain
  3 focused sessions > 8 scattered sessions
```

## Rule 6: Preview URL Per Session

Every session gets its own staging deploy while the branch is active.

```
Session created → branch created → agent works → 
agent finishes → auto-deploy branch to staging → 
preview URL shown in session box:

  ┌─ Session 2: Projects ─── ✅ Done ──┐
  │  OWNS: backend/projects/            │
  │  Files: 4 created, 218 lines       │
  │  Tests: 8/8 ✅                      │
  │                                     │
  │  🔗 feat-projects.dalkkak.ai       │ ← Click to test
  │                                     │
  │  [Approve] [Request Changes] [Diff] │
  └─────────────────────────────────────┘

User clicks link → tests the module in isolation →
approves or sends feedback → agent adjusts →
when all sessions approved → 딸깍 merge all
```

## Rule 7: Merge Order Matters

```
When merging 4 sessions to main:

  1. Merge backend core first (auth, models, config)
     → These are dependencies for everything else
  
  2. Merge backend features second (projects, agents)
     → These import from auth/models
  
  3. Merge frontend last
     → Frontend calls backend APIs that now exist
  
  4. Run integration tests after ALL merges
     → Catches any interface mismatches

If any merge conflicts:
  → Simple (import ordering, whitespace) → auto-resolve
  → Complex (logic conflict) → show diff to user, let them choose
  → Test failure after merge → rollback that merge, keep others
```

## Conclusion

Split by module directory. Define shared interfaces upfront.
Each session gets a preview URL. Merge in dependency order.
3-5 sessions is the sweet spot. Never let two sessions own the same file.
This is how 100-person teams work — same pattern, AI agents instead of humans.
