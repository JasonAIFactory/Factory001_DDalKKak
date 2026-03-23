# DalkkakAI Architecture — Detailed Guide

> Written so anyone can understand exactly how every piece works.
> Every section includes: WHAT it does, WHY it exists, HOW it works, and real CODE examples.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                           │
│  Next.js Frontend (localhost:3001)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Landing   │ │ Dashboard│ │ Session  │ │ Terminal │      │
│  │ Page      │ │          │ │ Detail   │ │ (xterm)  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────┬────────────────────────┬──────────────┘
                     │ HTTP (REST API)        │ WebSocket
                     ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER CONTAINER: api                     │
│  FastAPI Backend (port 8000)                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Auth     │ │ Sessions │ │ Billing  │ │ Terminal │      │
│  │ Module   │ │ Module   │ │ Module   │ │ PTY      │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Executor │ │ Preview  │ │ WebSocket│                    │
│  │ (Claude) │ │ (Docker) │ │ Hub      │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└────────┬──────────┬──────────┬──────────┬──────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
    │ Claude │ │ Docker │ │ Postgre│ │ Redis      │
    │ API    │ │ Socket │ │ SQL    │ │            │
    └────────┘ └────────┘ └────────┘ └────────────┘
```

---

## 1. Authentication (backend/auth/)

### WHAT
Handles user signup, login, and JWT token verification.

### WHY
Every API request needs to know WHO is making it. JWT tokens let us verify identity without hitting the database every time.

### HOW

```
User sends email + password
  → backend hashes password with bcrypt
  → stores in PostgreSQL (users table)
  → returns JWT token (valid 24 hours)

Every subsequent request:
  → User sends "Authorization: Bearer <token>" header
  → backend decodes JWT, extracts user_id
  → if valid → request proceeds
  → if expired/invalid → 401 Unauthorized
```

### CODE

**Signup flow (backend/auth/service.py):**
```python
async def register(db, email, password, name):
    # 1. Check if email already exists
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    # 2. Hash password (never store plaintext!)
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    # 3. Create user record
    user = User(email=email, hashed_password=hashed.decode(), name=name)
    db.add(user)
    await db.commit()

    # 4. Generate JWT token
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user": user}
```

**JWT verification (backend/auth/deps.py):**
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user
```

**API endpoint (backend/auth/router.py):**
```
POST /api/auth/register  → { email, password, name } → { token, user }
POST /api/auth/login     → { email, password }        → { token, user }
GET  /api/auth/me        → (requires token)           → { user }
```

---

## 2. Startups (backend/startups/)

### WHAT
A "startup" is a project container. Each startup = one git repository = one app being built.

### WHY
Users can have multiple startups. Each startup is completely isolated — different codebase, different sessions, different deployments.

### HOW

```
User creates startup "Coffee Subscription"
  → DB record created (id: UUID, name, description)
  → Git repo initialized at /workspace/{startup_id}/
  → Empty "main" branch with init commit
  → This directory is where ALL code for this startup lives
```

### CODE

**Startup creation (backend/startups/service.py):**
```python
async def create_startup(db, name, description, user_id):
    startup = Startup(name=name, description=description, owner_id=user_id)
    db.add(startup)
    await db.commit()

    # Initialize git repository for this startup
    repo_path = f"/workspace/{startup.id}"
    subprocess.run(["git", "init", "-b", "main", repo_path])
    subprocess.run(["git", "commit", "--allow-empty", "-m", "init"], cwd=repo_path)

    return startup
```

**Directory structure on disk:**
```
/workspace/
  5e555b1f-007e-.../           ← Startup "Coffee Subscription"
    .git/                      ← Git repository
    (files created by AI sessions go here)
  a1b2c3d4-e5f6-.../           ← Startup "Todo App"
    .git/
    ...
```

---

## 3. Sessions (backend/sessions/)

### WHAT
A session is ONE unit of work. "Add login page" = 1 session. "Fix payment bug" = 1 session. Each session runs in its own git branch, isolated from other sessions.

### WHY
Multiple features can be developed in parallel without conflicts. Each session has its own branch and directory. When done, it merges into main.

### HOW

```
User creates session "Add Login Page"
  → DB record: { id, title, description, status: "created", agent_type: "feature" }
  → Git worktree created:
      /workspace/{startup_id}/worktrees/session-login-page-abc123/
      (this is a separate directory with its own branch)
  → If Auto AI: queued → executor picks it up → Claude writes code
  → If Terminal: status = "running" → user works manually via web terminal
```

### CODE

**Session creation (backend/sessions/service.py):**
```python
async def create_session(db, startup, title, description, agent_type):
    session_id = uuid.uuid4()
    branch = f"session-{slugify(title)}-{str(session_id)[:6]}"

    session = Session(
        id=session_id,
        startup_id=startup.id,
        title=title,
        description=description,
        branch_name=branch,
        agent_type=agent_type,  # "feature", "fix", "build", or "terminal"
        status="created",
    )
    db.add(session)

    # Create git worktree (isolated directory + branch)
    result = await create_worktree(repo_path, branch)
    session.worktree_path = result.path

    # Terminal sessions start immediately (no queue)
    if agent_type == "terminal":
        session.status = "running"

    await db.commit()
    return session
```

**Git worktree explained:**
```
Normal git (1 branch at a time):
  /repo/          ← can only see main branch files

Git worktree (multiple branches simultaneously):
  /repo/                              ← main branch
  /repo/worktrees/session-login/      ← login branch (separate directory!)
  /repo/worktrees/session-payment/    ← payment branch (separate directory!)

Each worktree = independent copy of the repo on a different branch.
Changes in one worktree don't affect others.
```

**Session lifecycle:**
```
created → queued → running → review → approved → completed → merged
                      ↓
                    error (can retry)
```

---

## 4. AI Executor (backend/agents/executor.py)

### WHAT
The AI executor is the brain. It runs Claude in a loop — Claude reads files, writes code, runs tests, and repeats until the task is done.

### WHY
This is what makes DalkkakAI an AI platform, not just a code editor. The user says "build login" and the AI does everything.

### HOW

```
Session is queued → Queue worker picks it up → Executor starts

Loop (max 30 iterations):
  1. Send session description + conversation history to Claude API
  2. Claude responds with tool calls:
     - write_file("src/login.py", "...code...")
     - run_command("pytest tests/")
     - read_file("src/config.py")
  3. Executor runs each tool call in the worktree
  4. Results sent back to Claude
  5. Claude decides: more work needed? → loop again
                     all done? → call session_complete
  6. Safety limits: $5 max cost, 30 min max time

After completion:
  → Git commit all changes
  → Session status → "review"
  → WebSocket broadcasts update → UI refreshes
```

### CODE

**Executor main loop (backend/agents/executor.py):**
```python
class AgentExecutor:
    async def run(self):
        self.conversation = [{"role": "user", "content": self.description}]

        for iteration in range(MAX_ITERATIONS):  # max 30
            # Safety: check cost and time limits
            if float(self.total_cost) >= 5.0:
                return ExecutionResult(success=False, error="Cost limit reached")

            # Call Claude API with tools
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                system=system_prompt,
                messages=self.conversation,
                tools=TOOL_DEFINITIONS,  # write_file, read_file, run_command, etc.
            )

            # Process Claude's response
            for block in response.content:
                if block.type == "tool_use":
                    # Execute the tool (write file, run command, etc.)
                    result = await self.tool_executor.execute(block.name, block.input)

                    # If Claude called session_complete, we're done
                    if block.name == "session_complete":
                        return ExecutionResult(success=True, summary=block.input["summary"])

            # Add response + tool results to conversation for next iteration
            self.conversation.append({"role": "assistant", "content": response.content})
            self.conversation.append({"role": "user", "content": tool_results})
```

**Tools available to Claude (backend/agents/tools.py):**
```python
TOOL_DEFINITIONS = [
    {
        "name": "write_file",
        "description": "Write content to a file",
        "input_schema": {"path": "string", "content": "string"}
    },
    {
        "name": "read_file",
        "description": "Read a file's contents",
        "input_schema": {"path": "string"}
    },
    {
        "name": "run_command",
        "description": "Run a shell command (tests, npm install, etc.)",
        "input_schema": {"command": "string"}
    },
    {
        "name": "list_files",
        "description": "List files in a directory",
        "input_schema": {"path": "string"}
    },
    {
        "name": "session_complete",
        "description": "Signal that work is done",
        "input_schema": {"summary": "string"}
    },
]
```

**Real example — what happens when user creates a session "Create login page":**
```
Iteration 1:
  Claude: list_files(".")           → "(empty directory)"
  Claude: write_file("package.json", "...")
  Claude: write_file("server.js", "...")

Iteration 2:
  Claude: write_file("public/login.html", "...")
  Claude: write_file("public/style.css", "...")

Iteration 3:
  Claude: run_command("npm install") → "added 50 packages"
  Claude: run_command("npm test")    → "2 tests passed"

Iteration 4:
  Claude: session_complete("Created login page with HTML/CSS/JS + Express server")
  → Done! Total cost: ~$0.15
```

---

## 5. Session Queue (backend/sessions/queue.py)

### WHAT
The queue worker runs in the background, picking up sessions that are "queued" and dispatching them to the executor.

### WHY
We can't run unlimited sessions at once — it costs money and CPU. The queue enforces concurrency limits based on the user's plan.

### HOW

```
Every 10 seconds, the queue worker:
  1. Finds all sessions with status = "queued"
  2. Checks how many sessions the user already has running
  3. If under the limit → dispatch (start the executor)
  4. If over the limit → wait

Concurrency limits:
  Free:    1 session at a time
  Starter: 2
  Growth:  5
  Scale:   10
```

### CODE

```python
async def run_queue_worker():
    while True:
        async with AsyncSessionLocal() as db:
            # Find queued sessions, ordered by priority
            queued = await db.execute(
                select(Session)
                .where(Session.status == "queued")
                .order_by(Session.priority.desc(), Session.created_at.asc())
            )

            for session in queued.scalars():
                # Check concurrency limit
                running_count = await count_running_sessions(db, session.user_id)
                plan_limit = get_plan_limit(session.user.plan)

                if running_count < plan_limit:
                    # Dispatch! Start the executor in background
                    asyncio.create_task(_dispatch_session(session, startup))

        await asyncio.sleep(10)  # Poll every 10 seconds
```

---

## 6. Web Terminal (backend/terminal/ + frontend Terminal.tsx)

### WHAT
A real terminal in the browser. User can type commands, run Claude Code, install packages — exactly like iTerm2 or Windows Terminal.

### WHY
Developers can use their own Claude Code subscription ($0 cost). Non-developers use Auto AI mode instead.

### HOW

```
Browser (xterm.js) ←→ WebSocket ←→ FastAPI ←→ PTY ←→ tmux ←→ bash

1. User opens Terminal tab in a session
2. Frontend creates WebSocket to /ws/terminal/{session_id}
3. Backend creates tmux session (if not exists) in the worktree directory
4. Backend attaches to tmux via PTY (pseudo-terminal)
5. Every keystroke: browser → WebSocket → PTY → tmux → bash
6. Every output: bash → tmux → PTY → WebSocket → browser

tmux provides persistence:
  - Page refresh → WebSocket disconnects → tmux stays alive
  - Reconnect → re-attach to same tmux session → Claude Code still running
```

### CODE

**Backend (backend/terminal/router.py):**
```python
@router.websocket("/ws/terminal/{session_id}")
async def websocket_terminal(websocket, session_id):
    await websocket.accept()

    session_name = f"dalkkak-{session_id[:8]}"

    # Find the worktree directory for this session
    cwd = "/workspace"  # default
    session_obj = await db.get(Session, session_id)
    if session_obj and session_obj.worktree_path:
        cwd = session_obj.worktree_path

    # Create tmux session if it doesn't exist
    if not tmux_session_exists(session_name):
        create_tmux_session(session_name, cwd=cwd)

    # Attach to tmux via PTY
    terminal = TerminalSession(session_name)
    await terminal.attach(websocket)

    # Forward keystrokes: WebSocket → PTY
    while True:
        msg = await websocket.receive()
        await terminal.write(msg["bytes"])
```

**Frontend (frontend/app/components/Terminal.tsx):**
```typescript
// Create xterm.js terminal
const term = new XTerm({
    cursorBlink: true,
    fontSize: 14,
    scrollback: 10000,  // 10,000 lines of scrollback
    theme: { background: "#1a1b26", foreground: "#c0caf5" },
});

// Connect to backend WebSocket
const ws = new WebSocket(`ws://localhost:8000/ws/terminal/${sessionId}`);

// Send keystrokes to backend
term.onData((data) => ws.send(new TextEncoder().encode(data)));

// Display output from backend
ws.onmessage = (event) => term.write(new Uint8Array(event.data));
```

---

## 7. Preview/Test System (backend/sessions/preview.py)

### WHAT
When user clicks "Test", the system launches the app in a Docker container and gives a URL to access it.

### WHY
Users need to SEE their app running, not just read code. One click → app is live → click URL → see it in browser.

### HOW

```
User clicks "Test" button
  → POST /api/sessions/{id}/preview
  → Backend detects app type (Node.js? Python? Next.js?)
  → Finds a free port (e.g., 48331)
  → Runs: docker run --detach --publish 48331:3000 --volume {worktree}:/app node:20-slim "npm install && npm start"
  → Saves URL (http://localhost:48331) to database
  → UI shows "Open App" link
  → User clicks → sees their app!

Hot reload:
  → Node.js apps run with "node --watch" (auto-restart on file change)
  → FastAPI apps run with "--reload" flag
  → User edits code in terminal → app automatically reflects changes
```

### CODE

```python
async def launch_preview(worktree_path, startup_id, session_id):
    # 1. Detect what kind of app
    app_type = await _detect_startup_type(worktree_path)
    # checks for: package.json → nodejs, main.py → fastapi, next.config → nextjs

    # 2. Find a free port
    port = _find_free_port()  # socket.bind(("", 0)) → OS picks unused port

    # 3. Build docker command
    if app_type == "nodejs":
        cmd = "npm install && node server.js"
        image = "node:20-slim"
        container_port = 3000
    elif app_type == "fastapi":
        cmd = "pip install -r requirements.txt && uvicorn main:app --reload"
        image = "python:3.11-slim"
        container_port = 8000

    # 4. Convert container path to host path (Docker volume mount)
    host_path = convert_to_host_path(worktree_path)

    # 5. Run the container
    await run(["docker", "run", "--detach",
        "--publish", f"{port}:{container_port}",
        "--volume", f"{host_path}:/app",
        image, "sh", "-c", cmd
    ])

    # 6. Return the URL
    return PreviewResult(url=f"http://localhost:{port}")
```

---

## 8. Billing (backend/billing/)

### WHAT
Stripe integration for subscription payments. Users choose a plan, pay monthly, get access to more features.

### WHY
Revenue! The product needs to make money. Stripe handles all the payment complexity.

### HOW

```
User clicks "Upgrade to Growth" on pricing page
  → POST /api/billing/checkout { plan: "growth" }
  → Backend creates Stripe Checkout Session
  → User redirected to Stripe's payment page
  → User enters credit card
  → Stripe processes payment
  → Stripe sends webhook to POST /api/billing/webhook
  → Backend updates user.plan = "growth"
  → User now has 5 concurrent sessions instead of 1

Plans:
  Free:    $0/mo   → 1 session,  no AI tokens
  Starter: $29/mo  → 2 sessions, $5 AI included
  Growth:  $99/mo  → 5 sessions, $20 AI included
  Scale:   $299/mo → 10 sessions, $50 AI included
```

---

## 9. Frontend Architecture (frontend/)

### WHAT
Next.js 14 App Router with Tailwind CSS. Dark theme. Server-side rendering where possible, client components for interactive parts.

### WHY
Next.js gives us fast page loads, good SEO (landing page), and a modern React framework. Tailwind = fast styling without CSS files.

### FILE STRUCTURE

```
frontend/
  app/
    (marketing)/
      layout.tsx              ← Landing page layout (no sidebar)
      page.tsx                ← Landing page (hero, pricing, FAQ)

    (auth)/
      login/page.tsx          ← Login form
      register/page.tsx       ← Registration form

    (dashboard)/
      layout.tsx              ← Dashboard layout (with sidebar)
      dashboard/page.tsx      ← Startups list

      startups/
        page.tsx              ← All startups
        [id]/
          page.tsx            ← Session grid (orchestrator, ~170 lines)
          shared.ts           ← Interface contract (types, constants)
          components/
            SessionCard.tsx     ← Individual session card
            SessionDetail.tsx   ← Full session detail with tabs
            FilesViewer.tsx     ← Code viewer (file tree + content)
            CreateSessionModal.tsx ← New session form
            StatusBadge.tsx     ← Status indicators + buttons

  components/
    Terminal.tsx              ← xterm.js web terminal

  lib/
    api.ts                    ← API client (all HTTP calls)
```

### COMPONENT COMMUNICATION

```
page.tsx (orchestrator)
  ├── loads startups + sessions from API
  ├── manages state: which session is selected, filter, etc.
  ├── passes data DOWN to components as props
  │
  ├── <SessionCard session={s} onAction={reload} onOpen={openDetail} />
  │     └── clicks "Test" → calls API → triggers onAction → page reloads data
  │
  ├── <SessionDetail session={s} onBack={closeDetail} onAction={reload} />
  │     ├── <Terminal sessionId={s.id} />          ← WebSocket to backend PTY
  │     ├── <FilesViewer session={s} />             ← loads file tree from API
  │     └── Chat input → POST /api/sessions/{id}/chat → executor re-runs
  │
  └── <CreateSessionModal onCreated={reload} />
        └── form submit → POST /api/startups/{id}/sessions → reload
```

---

## 10. Database (PostgreSQL + Alembic)

### TABLES

```sql
users:
  id          UUID PRIMARY KEY
  email       VARCHAR UNIQUE
  name        VARCHAR
  hashed_password VARCHAR
  plan        VARCHAR DEFAULT 'free'    -- free/starter/growth/scale
  stripe_customer_id VARCHAR
  anthropic_api_key VARCHAR            -- BYOK (user's own key)
  created_at  TIMESTAMP
  updated_at  TIMESTAMP

startups:
  id          UUID PRIMARY KEY
  owner_id    UUID REFERENCES users(id)
  name        VARCHAR
  description TEXT
  created_at  TIMESTAMP
  deleted_at  TIMESTAMP                -- soft delete

sessions:
  id          UUID PRIMARY KEY
  startup_id  UUID REFERENCES startups(id)
  title       VARCHAR
  description TEXT
  agent_type  VARCHAR                  -- feature/fix/build/terminal
  status      VARCHAR                  -- created/queued/running/review/completed/error
  branch_name VARCHAR
  worktree_path VARCHAR
  model_tier  VARCHAR DEFAULT 'sonnet'
  progress    INTEGER DEFAULT 0
  total_cost  DECIMAL
  model_calls INTEGER DEFAULT 0
  preview_url VARCHAR
  summary     TEXT
  error_message TEXT
  created_at  TIMESTAMP

session_messages:
  id          UUID PRIMARY KEY
  session_id  UUID REFERENCES sessions(id)
  role        VARCHAR                  -- user/assistant/system
  content     TEXT
  created_at  TIMESTAMP
```

### MIGRATIONS

```
Alembic manages schema changes:
  alembic revision --autogenerate -m "add billing fields"
  alembic upgrade head

On API startup (main.py lifespan):
  → alembic upgrade head runs automatically
  → database schema is always up to date
```

---

## 11. Docker Setup

### docker-compose.yml

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    volumes:
      - .:/app                           # Live code reload
      - ./workspace:/workspace            # Startup repos (persists)
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
      - claude_auth:/root/.claude         # Claude Code auth (persists)
    environment:
      DATABASE_URL: postgresql+asyncpg://dalkkak:dalkkak@db:5432/dalkkak
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      HOST_PROJECT_ROOT: c:/Sources/Factory001_DDalKKak  # For volume mounts

  db:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
```

### Why Docker-in-Docker?

```
The API container needs to launch PREVIEW containers.
To do this, it needs access to the Docker daemon.
We mount /var/run/docker.sock into the API container.

API container → docker run → creates preview container on the HOST
Preview container → mounts worktree → runs the user's app
```

---

## 12. WebSocket Real-time Updates

### WHAT
When a session changes (progress, status, new file), the UI updates instantly without page refresh.

### HOW

```
Frontend connects: ws://localhost:8000/ws/sessions/{startup_id}
  → Backend registers connection in hub

When executor writes a file:
  → broadcast_message(startup_id, session_id, "Wrote src/login.py")
  → Hub sends to all connected clients for this startup
  → Frontend receives → calls load() → UI updates

Events broadcast:
  - progress: { session_id, progress: 45, message: "Writing tests..." }
  - message:  { session_id, role: "assistant", content: "Created login.py" }
  - completed: { session_id, summary: "Login page complete" }
  - error:    { session_id, error: "npm test failed" }
```
