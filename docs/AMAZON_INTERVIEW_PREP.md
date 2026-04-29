# Amazon SDE II — Side Project Talking Points

> Target role: Amazon SDE II, AFT Flow Controls, Toronto.
> Tone: honest, no overstatement. Speak only to what's actually running, plus
> what's designed and why. If I haven't built it, I say "designed, not built."

---

## 1. One-line intro

> DalkkakAI is a one-click startup builder — a non-technical founder describes
> an idea in plain language, and the system generates a working web app,
> deploys it in a Docker preview, and returns a URL. I built it solo using
> Claude Code as a pair-programming partner.

(If I want to lead with the technical hook instead of the product:)

> It's a multi-agent system that runs Claude in a tool-use loop inside isolated
> git worktrees, with a cost-tiered router that picks the cheapest model that
> can handle each request.

---

## 2. 30–60 second answer

> Sure — my main side project is DalkkakAI. The idea is that a non-technical
> founder describes their startup in plain language, and the system generates
> a working web app, runs it in a Docker preview, and gives them a URL. No
> terminal involved.
>
> I built it solo, using Claude Code as a pair-programming partner. The piece
> I learned the most from is the agent execution engine. It runs Claude in a
> tool-use loop inside a git worktree, so multiple AI sessions can work on the
> same project at the same time without file conflicts. To control cost, every
> request goes through a router that tries a regex match first for free, falls
> back to Haiku at about half a cent, and only escalates to Sonnet or Opus
> when the cheaper models can't handle it.
>
> It's a Phase 1 monolith — FastAPI and Next.js — and I've written down the
> measured triggers for when each component should move to Go. So I can talk
> about both what's actually running today and the trade-offs behind the parts
> that aren't built yet.

**Speaking notes:** ~55 seconds. Don't rush. Pause after "no terminal involved"
and after "without file conflicts." Land softly on the last sentence — it
tells them I know the difference between "shipped" and "designed."

---

## 3. Follow-ups (likely five or six)

### Q1. "How does the executor avoid runaway cost or infinite loops?"

> Three hard limits in `backend/agents/executor.py`. A 30-iteration cap on the
> tool-use loop, a $5 per-session cost cap (I track tokens after every Claude
> call against the published per-million pricing), and a 30-minute wall-clock
> cap. If any of those trips, I exit the loop, mark the session as failed, and
> WebSocket the error to the UI. There's also a softer guard — if Claude
> emits three identical responses in a row, I auto-pause, because that's
> almost always a stuck loop rather than real work.

### Q2. "Why a monolith? Why not microservices?"

> Two reasons. First, I'm one person pre-revenue — a monolith is one deploy,
> one log stream, one debuggable process, and FastAPI async handles around
> 5K requests per second from a single instance, which gets me to about 10K
> users. Second, I wrote down the migration triggers in `docs/SPEC.md`: the
> WebSocket hub moves to Go when concurrent connections exceed 5K, the
> session manager moves to Go when concurrent worktrees exceed 100, and so
> on. So it's metrics-driven, not aspirational. Python stays for everything
> AI — the SDKs are Python-native.

### Q3. "How do you stop two parallel sessions from corrupting each other?"

> Two layers. The first is git worktrees — each session gets a separate
> directory on disk with its own branch, so two sessions can write files at
> the same time without touching the same working tree. The second is what I
> call module ownership: in `docs/SESSION_RULES.md` I require that each
> session owns a directory tree exclusively. Auth session owns
> `backend/auth/*`, projects session owns `backend/projects/*`. Shared files
> like `main.py` are append-only — sessions add new imports but never modify
> existing lines, so git auto-merges parallel additions cleanly. If a real
> conflict happens at merge time, the merge aborts and the user resolves it.

### Q4. "How did you decide when GenAI was the right tool and when it wasn't?"

> The cost router was that decision, made structural. Around a third of user
> requests are commands like "deploy" or "show my revenue" — those have
> deterministic answers, so I route them to a function call or a SQL query
> for free. For ambiguous requests I spend about a tenth of a cent on Haiku
> to classify into one of 22 categories, each mapped to the cheapest model
> that can do the job. The rule I ended up with is: if the task has a
> deterministic answer, use a deterministic tool; GenAI is for ambiguous,
> language-heavy, or generative work.

### Q5. "Tell me about the hardest bug."

> The preview detector. First version was a small function that hardcoded
> entry-point names — `main.py` for Python, `index.js` for Node. It kept
> breaking, because Claude generates user code with unpredictable structure —
> it might use `app.py`, `server.py`, or `run.py`. I spent a week adding
> filenames to the list, which was whack-a-mole.
>
> The real fix was changing my assumption. I'd been treating AI-generated
> code like human-written code with predictable conventions. I rewrote the
> detector as a seven-priority chain that scans file *contents* for framework
> signatures — looking for `FastAPI(`, `Flask(`, or a `django` import —
> rather than guessing from filenames. I also added an explicit override
> file, `dalkkak.json`, so when heuristics fail I can give the agent a hard
> rule. That permanently fixed the class of bugs.

### Q6. "If you were doing this at Amazon scale, what would change?"

> A few things I'd be honest about. The session queue today is a 10-second
> polling loop — fine for a single instance, but I'd move it to Redis
> Streams or SQS for instant dispatch and horizontal scale. The WebSocket
> hub keeps connection state in process memory, which means I can't run
> multiple API replicas yet — I'd move that to Redis pub/sub. And the
> preview system mounts the host Docker socket, which is fine for a solo
> dev but a real security concern in production — I'd put preview
> containers on an isolated network with restricted capabilities, or move
> to gVisor or Firecracker. None of that is built yet; I just know where
> the seams are.

---

## 4. The GenAI-specific question (recruiter flagged this)

The recruiter quoted two questions verbatim. Both are answered by the same
project, so I have one clean story for each.

### "Tell me about a time you used GenAI to solve a problem at work. Walk me through your approach."

> I'll use a concrete one — the preview detection problem on DalkkakAI.
>
> The setup: my system uses Claude to generate user-facing code — a real
> production app, not a prototype. After Claude finishes, the platform has to
> launch the generated app in a Docker container so the founder can click a
> URL and see it running. The first version of my detector hardcoded entry
> points: `main.py` for Python, `index.js` for Node. It kept breaking
> because Claude doesn't generate code with predictable filenames.
>
> My approach was four steps. **One**, I treated the symptom for a week —
> kept adding filenames to the list — and watched it keep breaking. **Two**,
> I stepped back and identified the wrong premise: I was assuming
> AI-generated code looks like human-written code with conventions. **Three**,
> I rewrote the detector around a different assumption — scan file
> *contents* for framework signatures like `FastAPI(`, `Flask(`, and
> `django` imports, in a priority chain. **Four**, I added an explicit
> override file, `dalkkak.json`, so when I want deterministic behavior I can
> tell the agent the answer directly instead of relying on heuristics.
>
> The lesson I took out of it: with GenAI you can't just iterate on the
> failure mode, you have to question the assumption that produced the
> failure. And whenever a heuristic isn't enough, give the model an explicit
> contract instead of hoping it picks the right pattern.

### "Describe a situation where you had to decide whether GenAI was the right tool for a task."

> The cost router on DalkkakAI is that decision built into the system.
>
> Every user request lands at a router agent. Before any model gets called,
> I run a regex pass against deterministic commands — "deploy," "show
> revenue," "list sessions." Those have exact answers, so I route them to
> SQL queries or function calls for zero cost. About a third of traffic
> never touches a model.
>
> Only ambiguous requests pay Haiku — about a tenth of a cent — to be
> classified into one of 22 task categories. Each category is mapped to the
> cheapest model that can do the job: Haiku for classification and short
> replies, Sonnet for code generation and long-form content, Opus only for
> full startup builds where the quality difference actually matters.
>
> The rule I extracted: GenAI is the wrong tool when the answer is
> deterministic, when the input is structured, or when latency matters more
> than nuance. It's the right tool for ambiguous language input,
> open-ended generation, and code synthesis where the search space is too
> large for templates. I tried to make that decision once, in code, instead
> of paying for it on every request.

**Why this answer works for Amazon:** it shows responsible AI use (cost
hierarchy, not "default to the biggest model"), measurement (cost logged per
call), and the judgment to *not* use GenAI when something cheaper works.

---

## 5. Honest delivery notes

These are the things I have to actually say out loud in the room, not soften:

- **"I built it solo, using Claude Code as a pair-programming partner."**
  Don't dance around this. Amazon explicitly cares about responsible GenAI
  use — saying it directly is the right move, not a weakness.
- **"That part is designed, not built."** Use this whenever I describe Phase
  2 or Phase 3 work. Honest scope is more credible than vague claims.
- **"I learned this from a bug — here's the bug."** When asked about hard
  problems, lead with the failure, not the solution. The story is the
  reason.
- **No "we." It's "I."** Solo project. Calling it "we" sounds inflated.
- **No "production scale."** It's a solo project with a working preview
  system, not a system serving real traffic. Say "it runs end-to-end on my
  machine and on Railway" — not "in production."

---

## 6. If they ask "what's actually running vs what's a plan"

> Running today: the FastAPI backend, Next.js dashboard, the agent executor,
> the cost router, git worktree session isolation, the Docker preview
> system, the in-browser terminal with tmux persistence, JWT auth, and
> Stripe billing scaffolding. End-to-end, a user can sign up, describe an
> idea, watch a session run, and click a preview URL.
>
> Designed but not built: the seven-agent specialization (only Build and
> Feature exist today, the others are stubs), the RAG support bot, the
> domain ontology layer, and the Phase 2 Go services. Those have specs in
> `docs/` but no code yet.
