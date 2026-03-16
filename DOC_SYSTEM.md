# DOC_SYSTEM.md — Documentation Architecture

> No file over 300 lines. Every file self-contained. AI reads a chain, not a monolith.

## The Problem

As a project grows, documentation grows. A 50-file project might need 20 docs. 
If each doc references 5 others, the AI agent drowns in cross-references 
and loses focus. We need a system that scales.

## Core Principles

### 1. Every file is self-contained
Each MD file must make sense on its own. An agent should be able to read 
ONE file and take action without needing to read 5 others first.

Every file ends with a **conclusion section** — a 5-10 line summary of 
"what to do with this information." No open-ended files that require 
reading another doc to understand what to build.

### 2. Chain, don't dump
Instead of one 800-line SPEC.md, break into a chain:
```
SPEC.md (100 lines) → overview + pointers to detail files
  ├── docs/architecture/OVERVIEW.md (150 lines)
  ├── docs/architecture/PHASE1.md (200 lines) → self-contained
  ├── docs/architecture/PHASE2_GO.md (200 lines) → self-contained
  ├── docs/data/MODELS.md (200 lines) → all tables
  ├── docs/data/API.md (250 lines) → all endpoints
  └── docs/data/SCHEMAS.md (150 lines) → Pydantic models
```

An agent building the auth system reads:
  CLAUDE.md → SPEC.md (overview only) → docs/data/MODELS.md (User table)
  → docs/features/AUTH.md (auth-specific logic)

Total: ~600 lines across 4 small files, each focused.
NOT: one 600-line SPEC.md where auth is buried on line 340.

### 3. Size limits are hard rules

| File type | Max lines | When to split |
|-----------|-----------|---------------|
| CLAUDE.md | 300 | Split rules into CLAUDE_RULES.md |
| Overview files | 150 | They should only point to detail files |
| Feature docs | 250 | Split into sub-features |
| Data docs | 250 | Split by domain (user, startup, billing) |
| Learning logs | 300 | Archive oldest entries |
| Any file | 300 | ALWAYS split, no exceptions |

### 4. Every file has a standard structure

```markdown
# [FILE NAME] — [One-line description]

> [One-sentence purpose. What question does this file answer?]

## [Content sections — the actual specification]

...

## Conclusion

[5-10 lines: What should an agent DO after reading this file?]
[What to build, what rules to follow, what to read next if needed]
```

### 5. Navigation via index files

Each directory has an INDEX.md that lists all files with one-line descriptions.
An agent reads INDEX.md first, then picks only the relevant files.

```
docs/
├── INDEX.md              ← "What's in this directory?"
├── architecture/
│   ├── INDEX.md          ← "What architecture docs exist?"
│   ├── OVERVIEW.md
│   ├── PHASE1.md
│   └── PHASE2_GO.md
├── features/
│   ├── INDEX.md
│   ├── SESSIONS.md
│   ├── DEPLOY.md
│   ├── MONITORING.md
│   └── ...
├── data/
│   ├── INDEX.md
│   ├── MODELS.md
│   ├── API.md
│   └── SCHEMAS.md
└── operations/
    ├── INDEX.md
    ├── COST.md
    ├── AGENTS.md
    └── SECURITY.md
```

---

## How to Split a File

When any file exceeds 300 lines, follow this process:

### Step 1: Identify natural boundaries
Every doc has sections. Each section that can stand alone becomes its own file.

Example: SPEC.md at 700 lines contains:
```
- Architecture overview (150 lines)
- Phase 1 diagram (100 lines)
- Phase 2 diagram (120 lines)  
- Data models (200 lines)
- API endpoints (130 lines)
```

### Step 2: Extract into focused files
```
SPEC.md (100 lines) — overview + pointers only
docs/architecture/PHASE1.md (150 lines) — Python monolith
docs/architecture/PHASE2_GO.md (150 lines) — Go migration
docs/data/MODELS.md (200 lines) — all SQL tables
docs/data/API.md (150 lines) — all endpoints
```

### Step 3: Add conclusions to each file
Each extracted file gets a Conclusion section:
```markdown
## Conclusion

Build the FastAPI monolith with these 7 tables.
Use async SQLAlchemy 2.0 with asyncpg driver.
Every table has id (UUID), created_at, updated_at.
Run migrations with Alembic — never modify schema directly.
Next: read docs/data/API.md for the endpoint contracts.
```

### Step 4: Update the overview file
The original file becomes a routing document:
```markdown
# SPEC.md — DalkkakAI Master Specification

> Start here. This file points you to everything else.

## Architecture
- Overview: docs/architecture/OVERVIEW.md
- Phase 1 (Python): docs/architecture/PHASE1.md  
- Phase 2 (Go migration): docs/architecture/PHASE2_GO.md

## Data
- Database models: docs/data/MODELS.md
- API endpoints: docs/data/API.md
- Pydantic schemas: docs/data/SCHEMAS.md

## Features
- Session system: docs/features/SESSIONS.md
- Deployment: docs/features/DEPLOY.md
- [see docs/features/INDEX.md for full list]

## Operations
- AI cost strategy: docs/operations/COST.md
- Agent definitions: docs/operations/AGENTS.md
```

---

## Reading Chain Pattern

When an agent receives a task, it follows a chain — not a tree.

### Bad: Read everything
```
Agent reads: SPEC.md (700 lines) + SESSIONS.md (400 lines) 
           + DEPLOY.md (200 lines) + COST.md (200 lines)
Total: 1,500 lines → agent loses focus, misses critical rules
```

### Good: Follow a chain
```
Task: "Build the session merge API endpoint"

Chain:
  1. CLAUDE.md (200 lines) — rules and conventions
  2. SPEC.md (100 lines) — overview, find pointer to data docs
  3. docs/data/MODELS.md (50 lines) — read ONLY session table
  4. docs/features/SESSIONS.md (80 lines) — read ONLY merge section
  
Total: ~430 lines of RELEVANT content
Each file has a conclusion telling the agent what to do next
```

### How agents navigate the chain
```python
# The agent reads SPEC.md and finds:
"Session system: docs/features/SESSIONS.md"

# It reads SESSIONS.md and finds the merge section
# At the bottom, the conclusion says:
"To build the merge endpoint:
 1. Read the Session table in docs/data/MODELS.md
 2. Follow the git merge strategy in this file's Merge section
 3. Follow cost rules in docs/operations/COST.md for any AI calls
 4. Write code in backend/sessions/router.py"

# Agent now has a clear 4-step action plan
# Total docs read: 4 files, ~400 lines of relevant content
```

---

## File Naming Conventions

```
UPPERCASE.md          → Top-level important files (CLAUDE.md, SPEC.md)
lowercase.md          → Supporting docs in subdirectories
INDEX.md              → Directory listing (always UPPERCASE)
*_ARCHIVE.md          → Archive files (LEARNING_ARCHIVE.md)
```

---

## When the Project Gets Huge (100+ files, 50+ docs)

At scale, add a MANIFEST.md at the repo root:

```markdown
# MANIFEST.md — Complete project map

## Documentation (32 files)
docs/architecture/    — 4 files — system design
docs/features/        — 12 files — feature specifications  
docs/data/            — 5 files — database and API
docs/operations/      — 4 files — cost, agents, security
docs/integrations/    — 7 files — Stripe, GitHub, Railway, etc.

## Code (78 files)
backend/auth/         — 3 files — JWT authentication
backend/startups/     — 3 files — startup CRUD
backend/sessions/     — 4 files — session management
backend/agents/       — 8 files — AI agent engine
...

## Last updated: 2026-03-16
## Total: 32 docs, 78 code files, 12 test files
```

An agent reads MANIFEST.md to understand the project scope before diving 
into any specific area. Like `ls -la` for the entire project.

---

## Conclusion

Never let any file exceed 300 lines. Split early, split often.
Every file is self-contained with its own conclusion section.
Agents follow reading chains — small focused files in sequence.
INDEX.md in every directory maps what's available.
When the project grows huge, MANIFEST.md maps everything.

This system scales from 10 files to 1,000 files without breaking AI agent effectiveness.
