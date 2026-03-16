# SESSIONS.md — Multi-Session Control System

> Visual tmux for AI agents. No terminal. No commands. Just click and watch.

## What This Replaces

```
OLD WAY (developer pain):
  Terminal 1: tmux new -s auth
  Terminal 2: tmux new -s api  
  Terminal 3: tmux new -s frontend
  Terminal 4: manually switching between sessions
  Terminal 5: manually merging git branches
  Terminal 6: manually deploying
  You: stressed, context-switching, losing track

DALKKAK WAY:
  Browser → see all sessions side by side
  Click "+" → new session with one sentence
  Watch AI work in real-time
  Click "딸깍 Merge" → done
  You: drinking coffee
```

## Core Concepts

### Session
A session is ONE isolated AI work unit. It has:
- Its own git worktree (branch)
- Its own AI agent (Claude API context)
- Its own file scope (defined boundaries)
- Its own conversation history
- Its own progress tracking
- Its own test results

### Session Lifecycle
```
Created → Queued → Running → Review → Done → Merging → Merged
                      ↓                          ↓
                    Error                     Conflict
                      ↓                          ↓
                   Retrying               Manual Review
```

### Session States

| State | Description | User Can Do |
|-------|-------------|-------------|
| `created` | Session defined but not started | Edit description, delete |
| `queued` | Waiting for available agent slot | Cancel, edit priority |
| `running` | AI agent actively working | Chat, pause, cancel, watch live |
| `paused` | User paused the agent | Resume, edit instructions, cancel |
| `review` | Agent finished, waiting for user review | Approve, request changes, reject |
| `done` | User approved the work | Merge, archive |
| `merging` | Being merged into main branch | Watch progress |
| `merged` | Successfully merged | View diff, archive |
| `error` | Agent hit an unrecoverable error | Retry, view error, delete |
| `conflict` | Merge conflict detected | Resolve manually, auto-resolve |

---

## Data Model

### Session
```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    -- Identity
    title           VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    
    -- Git isolation
    branch_name     VARCHAR(100) NOT NULL,
    worktree_path   VARCHAR(255),
    base_commit     VARCHAR(40),
    head_commit     VARCHAR(40),
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'created',
    progress        INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Agent config
    agent_type      VARCHAR(20) NOT NULL DEFAULT 'feature',
    model_tier      VARCHAR(10) NOT NULL DEFAULT 'sonnet',
    priority        INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    
    -- Results
    files_changed   JSONB DEFAULT '[]',
    lines_added     INTEGER DEFAULT 0,
    lines_removed   INTEGER DEFAULT 0,
    test_results    JSONB DEFAULT '{"passed": 0, "failed": 0, "total": 0}',
    
    -- Cost tracking
    total_cost      DECIMAL(10,4) DEFAULT 0,
    total_tokens_in  INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    model_calls     INTEGER DEFAULT 0,
    
    -- Timing
    queued_at       TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_sessions_startup ON sessions(startup_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

### Session Message (conversation per session)
```sql
CREATE TABLE session_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id),
    
    role            VARCHAR(10) NOT NULL, -- 'user', 'agent', 'system'
    content         TEXT NOT NULL,
    
    -- AI metadata (only for agent messages)
    model_used      VARCHAR(20),
    tokens_in       INTEGER,
    tokens_out      INTEGER,
    cost            DECIMAL(10,6),
    duration_ms     INTEGER,
    
    created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_messages_session ON session_messages(session_id);
```

### Session File Change (track what each session modified)
```sql
CREATE TABLE session_file_changes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id),
    
    file_path       VARCHAR(500) NOT NULL,
    change_type     VARCHAR(10) NOT NULL, -- 'added', 'modified', 'deleted'
    lines_added     INTEGER DEFAULT 0,
    lines_removed   INTEGER DEFAULT 0,
    
    created_at      TIMESTAMP DEFAULT now()
);
```

---

## API Endpoints

### Session CRUD
```
POST   /api/startups/{id}/sessions
  Body: { title, description, agent_type?, priority? }
  Returns: { session }
  Logic:
    1. Create session record (status: created)
    2. Create git branch from main
    3. Create git worktree
    4. Queue the session for agent pickup
    5. Return session with WebSocket channel ID

GET    /api/startups/{id}/sessions
  Query: ?status=running&sort=created_at
  Returns: [{ session }]

GET    /api/sessions/{id}
  Returns: { session, messages, file_changes }

PATCH  /api/sessions/{id}
  Body: { title?, description?, priority?, status? }
  Returns: { session }

DELETE /api/sessions/{id}
  Logic:
    1. Stop agent if running
    2. Clean up worktree
    3. Delete branch
    4. Soft-delete session record
```

### Session Control
```
POST   /api/sessions/{id}/start
  Logic: Move from queued → running. Start agent.

POST   /api/sessions/{id}/pause
  Logic: Save agent state. Stop API calls. Keep worktree.

POST   /api/sessions/{id}/resume
  Logic: Restore agent state. Continue from last point.

POST   /api/sessions/{id}/retry
  Logic: Reset progress to 0. Clear errors. Restart agent.

POST   /api/sessions/{id}/cancel
  Logic: Stop agent. Clean up. Mark as cancelled.
```

### Session Chat (talk to agent during work)
```
POST   /api/sessions/{id}/chat
  Body: { content }
  Returns: { message }
  Logic:
    1. Add user message to conversation
    2. Include in agent's next context window
    3. Agent adjusts work based on new instruction
    4. Stream response via WebSocket

GET    /api/sessions/{id}/messages
  Query: ?limit=50&before=timestamp
  Returns: [{ message }]
```

### Session Merge
```
POST   /api/sessions/{id}/merge
  Logic:
    1. Check session status is 'done'
    2. Run final tests on the branch
    3. Attempt git merge to main
    4. If conflict → status: conflict, return diff
    5. If clean → run integration tests
    6. If tests pass → mark merged, trigger deploy
    7. Stream merge progress via WebSocket

POST   /api/sessions/merge-all
  Body: { session_ids: [uuid] }
  Logic:
    1. Sort by dependency order (if any)
    2. Merge one by one
    3. Run integration tests after each merge
    4. If any fails → rollback all, report conflict
    5. Stream progress via WebSocket
```

### Session Monitoring (real-time)
```
WebSocket: /ws/sessions/{startup_id}
  
  Events sent to client:
    session.created     { session_id, title }
    session.started     { session_id }
    session.progress    { session_id, progress, current_task }
    session.file_change { session_id, file_path, change_type }
    session.message     { session_id, role, content }
    session.test_result { session_id, passed, failed, total }
    session.completed   { session_id, summary }
    session.error       { session_id, error_message }
    session.merged      { session_id }
    
  Events received from client:
    session.chat        { session_id, content }
    session.pause       { session_id }
    session.resume      { session_id }
    session.cancel      { session_id }
```

---

## Session Queue & Concurrency

### Problem
Each session = one Claude API conversation. Running 10 sessions simultaneously = 10 parallel API calls = expensive and potentially rate-limited.

### Solution: Intelligent Queue

```python
class SessionQueue:
    """
    Manages how many sessions run concurrently per user.
    
    Concurrency limits by plan:
      Free:    1 concurrent session
      Starter: 2 concurrent sessions
      Growth:  5 concurrent sessions
      Scale:   10 concurrent sessions
    """
    
    def get_max_concurrent(self, plan: str) -> int:
        limits = {
            "free": 1,
            "starter": 2,
            "growth": 5,
            "scale": 10,
        }
        return limits.get(plan, 1)
    
    def can_start_session(self, user_id: str) -> bool:
        running = count_running_sessions(user_id)
        max_allowed = get_max_concurrent(get_user_plan(user_id))
        return running < max_allowed
    
    def next_in_queue(self, user_id: str) -> Optional[Session]:
        """Get highest priority queued session."""
        return (
            Session.query
            .filter(user_id=user_id, status="queued")
            .order_by(Session.priority.desc(), Session.created_at.asc())
            .first()
        )
```

### Auto-Start Logic
```
When a session completes:
  1. Check queue for same user
  2. If queued sessions exist → start highest priority
  3. Update dashboard in real-time via WebSocket
```

---

## Agent Execution Engine

### How a session runs internally

```python
async def run_session(session_id: str):
    """Main agent execution loop for one session."""
    
    session = await get_session(session_id)
    startup = await get_startup(session.startup_id)
    
    # 1. Set up isolated environment
    worktree = await create_git_worktree(
        repo_path=startup.repo_path,
        branch=session.branch_name,
    )
    
    # 2. Load context
    context = {
        "spec": read_file(f"{worktree}/SPEC.md"),
        "rules": read_file(f"{worktree}/CLAUDE.md"),
        "description": session.description,
        "existing_files": list_files(worktree),
        "conversation": await get_messages(session_id),
    }
    
    # 3. Choose model based on task
    model = select_model(session.agent_type, session.description)
    
    # 4. Agent work loop
    while session.status == "running":
        
        # Generate next action
        response = await call_claude(
            model=model,
            system=build_system_prompt(context),
            messages=context["conversation"],
            max_tokens=get_token_limit(model),
        )
        
        # Track costs
        await log_ai_usage(session_id, model, response.usage)
        
        # Parse agent actions
        actions = parse_agent_response(response)
        
        for action in actions:
            if action.type == "write_file":
                write_file(f"{worktree}/{action.path}", action.content)
                await record_file_change(session_id, action.path, "modified")
                await broadcast(session_id, "file_change", action.path)
                
            elif action.type == "create_file":
                write_file(f"{worktree}/{action.path}", action.content)
                await record_file_change(session_id, action.path, "added")
                await broadcast(session_id, "file_change", action.path)
                
            elif action.type == "run_tests":
                results = await run_tests(worktree)
                await update_test_results(session_id, results)
                await broadcast(session_id, "test_result", results)
                
            elif action.type == "complete":
                await update_session(session_id, status="review")
                await broadcast(session_id, "completed", action.summary)
                return
        
        # Update progress
        progress = estimate_progress(actions, session.description)
        await update_session(session_id, progress=progress)
        await broadcast(session_id, "progress", progress)
        
        # Check for user messages (mid-session instructions)
        new_messages = await check_new_user_messages(session_id)
        if new_messages:
            context["conversation"].extend(new_messages)
    
    # 5. Commit changes
    await git_commit(worktree, f"feat: {session.title}")
    await git_push(session.branch_name)
```

---

## Git Worktree Management

### Creating isolated environments
```python
async def create_git_worktree(repo_path: str, branch: str) -> str:
    """
    Create an isolated working directory for a session.
    
    Each session gets:
    - Its own directory on disk
    - Its own git branch
    - Its own copy of all files
    - Complete isolation from other sessions
    """
    
    worktree_path = f"/workspace/{repo_path}/worktrees/{branch}"
    
    # Create branch from main
    await run_command(f"git -C {repo_path} branch {branch} main")
    
    # Create worktree (separate directory with that branch)
    await run_command(
        f"git -C {repo_path} worktree add {worktree_path} {branch}"
    )
    
    return worktree_path


async def cleanup_worktree(repo_path: str, branch: str):
    """Remove worktree and branch after merge or cancel."""
    
    worktree_path = f"/workspace/{repo_path}/worktrees/{branch}"
    
    await run_command(f"git -C {repo_path} worktree remove {worktree_path}")
    await run_command(f"git -C {repo_path} branch -D {branch}")
```

### Merge strategy
```python
async def merge_session(session_id: str) -> MergeResult:
    """
    Merge a completed session branch back to main.
    
    Strategy:
    1. Try automatic merge (works 90% of the time when 
       sessions have clear file boundaries)
    2. If conflict, attempt auto-resolution for simple cases
    3. If complex conflict, show diff to user for manual choice
    """
    
    session = await get_session(session_id)
    repo_path = get_repo_path(session.startup_id)
    
    # Attempt merge
    result = await run_command(
        f"git -C {repo_path} merge {session.branch_name} --no-ff"
    )
    
    if result.returncode == 0:
        # Clean merge
        
        # Run integration tests
        test_results = await run_tests(repo_path)
        
        if test_results.all_passed:
            await update_session(session_id, status="merged")
            return MergeResult(success=True)
        else:
            # Tests failed after merge — rollback
            await run_command(f"git -C {repo_path} reset --hard HEAD~1")
            return MergeResult(
                success=False,
                reason="integration_tests_failed",
                details=test_results,
            )
    else:
        # Conflict detected
        conflicts = parse_conflicts(result.stderr)
        
        # Try auto-resolve (import ordering, whitespace, etc.)
        auto_resolved = await try_auto_resolve(repo_path, conflicts)
        
        if auto_resolved:
            return MergeResult(success=True, auto_resolved=True)
        else:
            await update_session(session_id, status="conflict")
            return MergeResult(
                success=False,
                reason="conflict",
                conflicting_files=conflicts,
            )
```

---

## Frontend UI Specification

### Session List Panel (left side)

```
┌─ Sessions (4) ──────── [+ New] ─┐
│                                   │
│  ┌─ Auth Module ─────────── ✓ ─┐ │
│  │ feat/auth │ +342 lines      │ │
│  │ ████████████████████ 100%   │ │
│  │ Tests: 8/8 │ Cost: $0.12   │ │
│  └─────────────────────────────┘ │
│                                   │
│  ┌─ Project CRUD ────────── ◐ ─┐ │
│  │ feat/api │ +218 lines       │ │
│  │ ████████████░░░░░░░░  68%   │ │
│  │ Tests: 5/8 │ Cost: $0.08   │ │
│  └─────────────────────────────┘ │
│                                   │
│  ┌─ Agent Orchestrator ──── ◐ ─┐ │
│  │ feat/agents │ +156 lines    │ │
│  │ ██████░░░░░░░░░░░░░░  35%   │ │
│  │ Tests: 2/6 │ Cost: $0.05   │ │
│  └─────────────────────────────┘ │
│                                   │
│  ┌─ Deploy Pipeline ────── ○ ─┐ │
│  │ Queued (priority: 5)        │ │
│  └─────────────────────────────┘ │
│                                   │
│ ─── Bottom Bar ──────────────── │
│ [딸깍 Merge All] [Total: $0.25] │
└───────────────────────────────────┘
```

### Session Detail View (right side)

```
┌─ Project CRUD ─── feat/api ─── ◐ Running ──────────────┐
│                                                          │
│  ┌─ Info Bar ──────────────────────────────────────────┐ │
│  │ 68%  │  Tests 5/8  │  +218 lines  │  $0.08  │ 2m  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Tabs ──────────────────────────────────────────────┐ │
│  │ [💬 Chat]  [📁 Files]  [🧪 Tests]  [📝 Diff]      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  💬 Chat Tab:                                            │
│  ┌──────────────────────────────────────────────────────┐│
│  │ You: Build project CRUD — create, list, get,         ││
│  │      update, delete with status field                 ││
│  │                                                       ││
│  │ 🤖 Agent: Building project service layer...           ││
│  │   ✅ app/models/project.py — Project model            ││
│  │   ✅ app/projects/service.py — Business logic         ││
│  │   ⏳ app/projects/router.py — Writing endpoints...    ││
│  │                                                       ││
│  │ You: Also add pagination support                      ││
│  │                                                       ││
│  │ 🤖 Agent: Got it. Adding offset/limit pagination      ││
│  │   to the list endpoint...                             ││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │ [Tell the agent what to do...              ] [Send]  ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  📁 Files Tab:                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │ ● app/models/project.py        +45 lines    ADDED   ││
│  │ ● app/projects/service.py      +98 lines    ADDED   ││
│  │ ◐ app/projects/router.py       +75 lines    WRITING ││
│  │   app/projects/schemas.py      queued                ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  🧪 Tests Tab:                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │ ✅ test_create_project          passed (23ms)        ││
│  │ ✅ test_list_projects           passed (18ms)        ││
│  │ ✅ test_get_project             passed (12ms)        ││
│  │ ✅ test_update_project          passed (15ms)        ││
│  │ ✅ test_delete_project          passed (11ms)        ││
│  │ ❌ test_pagination              FAILED               ││
│  │    AssertionError: expected 10, got 20               ││
│  │ ⏳ test_auth_required           queued               ││
│  │ ⏳ test_not_found               queued               ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  📝 Diff Tab:                                            │
│  ┌──────────────────────────────────────────────────────┐│
│  │ app/models/project.py                                ││
│  │ + class Project(Base):                               ││
│  │ +     __tablename__ = "projects"                     ││
│  │ +     id = Column(UUID, primary_key=True)            ││
│  │ +     name = Column(String, nullable=False)          ││
│  │ +     ...                                            ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─ Actions ───────────────────────────────────────────┐ │
│  │ [⏸ Pause] [🔄 Retry] [✅ Approve] [❌ Cancel]      │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Split View (watch multiple sessions simultaneously)

```
┌────────────────────┬────────────────────┐
│  Session 1: Auth   │  Session 2: API    │
│  ✅ Done           │  ◐ 68%             │
│                    │                    │
│  🤖 All 4 files    │  🤖 Writing         │
│  generated.        │  router.py...      │
│  Tests: 8/8 ✅     │                    │
│                    │  ⏳ Adding          │
│  [Merge to main]   │  pagination...     │
│                    │                    │
├────────────────────┼────────────────────┤
│  Session 3: Agent  │  Session 4: Deploy │
│  ◐ 35%             │  ○ Queued          │
│                    │                    │
│  🤖 Implementing   │  Waiting for       │
│  code generation   │  agent slot...     │
│  node...           │                    │
│                    │  Priority: 5       │
│                    │  [Start Now]       │
└────────────────────┴────────────────────┘
```

Users can:
- Drag to resize panels
- Click a panel to expand it full-width
- Double-click to pop out into a floating window
- Keyboard shortcuts: Ctrl+1/2/3/4 to switch focus

---

## Session Templates (quick start)

Instead of describing from scratch, users can pick a template:

| Template | Pre-filled Description | Agent Type | Model |
|----------|----------------------|------------|-------|
| Add Feature | "Add [feature] to [module]" | feature | Sonnet |
| Fix Bug | "Fix: [error description]" | fix | Sonnet |
| Add Page | "Create a new page for [purpose]" | feature | Sonnet |
| API Endpoint | "Add [method] /api/[path] endpoint" | feature | Sonnet |
| Write Tests | "Write tests for [module]" | feature | Haiku |
| Update Design | "Redesign the [component]" | feature | Sonnet |
| Add Integration | "Integrate [service] (Stripe/email/etc.)" | feature | Sonnet |
| Performance Fix | "Optimize [slow feature]" | fix | Sonnet |
| Security Audit | "Review [module] for security issues" | review | Sonnet |

---

## Keyboard Shortcuts (power users)

| Shortcut | Action |
|----------|--------|
| `N` | New session |
| `1-9` | Focus session 1-9 |
| `Enter` | Send chat message |
| `Esc` | Close current panel |
| `M` | Merge all done sessions |
| `Space` | Pause/resume focused session |
| `D` | View diff of focused session |
| `T` | View tests of focused session |

---

## Rate Limiting & Safety

```
Per-user limits:
  Max sessions total:           50
  Max concurrent sessions:      Plan-based (1-10)
  Max messages per session:     100
  Max file changes per session: 50
  Max session duration:         30 minutes (auto-pause)
  Max AI cost per session:      $5.00 (auto-pause)
  
Safety:
  If agent loops (3+ identical outputs): auto-pause + notify user
  If tests fail 3 times in a row: pause + suggest human review
  If cost exceeds $2 in one session: warn user, continue
  If cost exceeds $5: auto-pause, require user to continue
```
