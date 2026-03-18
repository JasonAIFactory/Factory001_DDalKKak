# UI_GUIDE.md — DalkkakAI Interface Specification

> Every screen, every component, every interaction — defined before code.

## Design System

### Tech
- Next.js 14 App Router
- Tailwind CSS + shadcn/ui components
- Dark theme by default (user can toggle light)
- Font: Inter (body), JetBrains Mono (code/metrics)
- Icons: Lucide React

### Color Tokens
```
--bg-primary:     #09090b    (main background)
--bg-secondary:   #0f0f13    (cards, panels)
--bg-tertiary:    #1c1c22    (hover states, borders)
--text-primary:   #fafafa    (headings, important text)
--text-secondary: #a1a1aa    (body text)
--text-muted:     #52525b    (labels, timestamps)
--accent-purple:  #8b5cf6    (primary actions, branding)
--accent-cyan:    #06b6d4    (links, preview URLs)
--status-green:   #10b981    (live, passing, approved)
--status-yellow:  #f59e0b    (running, warning, in progress)
--status-red:     #ef4444    (error, failed, critical)
--status-gray:    #6b7280    (queued, stopped, inactive)
```

### Spacing Scale
```
4px   — tight (between icon and label)
8px   — compact (between related items)
12px  — default (between components)
16px  — comfortable (between sections)
24px  — spacious (between major blocks)
```

### Component Sizes
```
Button (sm):   padding 6px 12px, font 11px, radius 6px
Button (md):   padding 8px 16px, font 12px, radius 8px
Button (lg):   padding 12px 24px, font 14px, radius 10px
Card:          padding 16px, radius 12px, border 1px --bg-tertiary
Badge:         padding 2px 8px, font 10px, radius 10px
Input:         padding 10px 14px, font 13px, radius 8px
Tab:           padding 10px 16px, font 12px, underline 2px
```

---

## Page Map

```
/                          → Landing page (public)
/auth/login                → Login
/auth/signup               → Signup
/dashboard                 → Home (MRR, users, uptime, AI advisor)
/dashboard/sessions        → Session grid (LEVEL 1 — factory floor)
/dashboard/sessions/:id    → Session detail (LEVEL 2 — inspection)
/dashboard/analytics       → Analytics & funnel
/dashboard/marketing       → Campaigns & content
/dashboard/support         → Ticket queue & chatbot
/dashboard/billing         → Stripe & revenue
/dashboard/settings        → Account & startup config
```

---

## Screen Specifications

### SCREEN 1: Session Grid (/dashboard/sessions)
Priority: HIGHEST — this is the core product screen.

#### Layout
```
┌─ Top Bar (fixed) ──────────────────────────────────┐
│ Logo · Build #12 · Preview Environment              │
│ [Review Next] [+ Create Session] [딸깍 Merge&Deploy]│
├─────────────────────────────────────────────────────┤
│ Status Pipeline (horizontal)                         │
│ ● 3 Running ——— ● 2 Ready ——— ● 4 Approved ——— ● 0 │
├─────────────────────────────────────────────────────┤
│ Filter Tabs                                          │
│ [All] [Running (3)] [Ready (2)] [Approved (4)]       │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│  Session Card 1      │  Session Card 2              │
│                      │                              │
│                      │                              │
├──────────────────────┼──────────────────────────────┤
│                      │                              │
│  Session Card 3      │  Session Card 4              │
│                      │                              │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│ Event Log (collapsible)                              │
│ + Auth Module: all tests passing                     │
│ > Billing: working on Stripe integration             │
│ - Project API: dependency needed                     │
└─────────────────────────────────────────────────────┘
```

#### Session Card Component (in grid)
```
Props:
  session: {
    id: string
    title: string              — "Auth Module"
    module: string             — "backend/auth/*"
    branch: string             — "feat/auth"
    status: enum               — queued|running|ready|error|approved|merged
    progress: number           — 0-100
    agent: string              — "Backend Agent"
    model: string              — "Sonnet"
    testsPass: number          
    testsFail: number          
    testsTotal: number         
    linesAdded: number         
    filesChanged: number       
    cost: number               — in dollars
    duration: string           — "4m 23s"
    previewUrl: string|null    — "feat-auth.dalkkak.ai"
    latestAction: string       — "Writing JWT middleware..."
  }

Visual structure:
  ┌─ [title] ─────────────── [status badge] ─┐
  │                                           │
  │  OWNED BY: [module]                       │
  │                                           │
  │  ████████████░░░░ [progress]%             │
  │                                           │
  │  [testsPass]/[testsTotal] tests           │
  │  +[linesAdded] lines · [filesChanged] files│
  │  $[cost] · [duration]                     │
  │                                           │
  │  [latestAction] (truncated, 1 line)       │
  │                                           │
  │  🔗 [previewUrl]          (if ready/done) │
  │                                           │
  │  [Action 1] [Action 2]   (max 2 buttons)  │
  └───────────────────────────────────────────┘

Button rules by status:
  queued:    [Start ▶]     [Open →]
  running:   [Pause ⏸]     [Open →]
  ready:     [Approve ✓]   [Open →]
  error:     [Retry ↻]     [Open →]
  approved:  [Merge ⊕]     [Open →]
  merged:    [View →]      (single button)

Click anywhere on card (except buttons) → navigates to detail page.
```

#### Status Pipeline Component
```
Props:
  counts: { running: 3, ready: 2, approved: 4, blocked: 0 }
  mergeReady: boolean
  mergeMessage: string  — "Ready to merge after 1 more approval"

Visual:
  ● 3 Running ━━━ ● 2 Ready ━━━ ● 4 Approved ━━━ ● 0 Blocked
  
  Colors: running=yellow, ready=cyan, approved=green, blocked=red
  Lines between nodes: solid when items exist, dashed when 0
  Right side shows merge readiness message
```

#### Event Log Component
```
Props:
  events: [{ timestamp, sessionTitle, message, type }]
  
Type colors:
  info:    default text
  success: green (test passed, deploy complete)
  warning: yellow (dependency needed, slow response)
  error:   red (test failed, deploy failed)

Visual: 
  Collapsible panel at bottom, 4-5 lines visible.
  Each line: + [sessionTitle]: [message]
  New events animate in from top.
  Click event → navigates to that session.
```

---

### SCREEN 2: Session Detail (/dashboard/sessions/:id)
Priority: HIGH — where the user does actual inspection work.

#### Layout
```
┌─ Header ───────────────────────────────────────────┐
│ ← Back · [title] · [branch] · [status] · [actions] │
├─────────────────────────────────────────────────────┤
│ Metrics Bar                                          │
│ [72%] [6/1/8 tests] [+287 lines] [4 files] [$0.09] │
│ [2m 34s] ··············· 🔗 feat-auth.dalkkak.ai    │
├─────────────────────────────────────────────────────┤
│ Tabs: [Chat] [Files] [Tests] [Diff] [Logs] [Errors] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Tab Content Area                                    │
│  (scrollable, fills remaining height)                │
│                                                      │
│                                                      │
│                                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Chat Input Bar (always visible when on Chat tab)     │
│ [Tell the agent what to do...              ] [Send]  │
└─────────────────────────────────────────────────────┘
```

#### Header Actions (buttons change by status)
```
running: [Pause ⏸] [Cancel ✕]
paused:  [Resume ▶] [Cancel ✕]
ready:   [Approve ✓] [Request Changes] 
error:   [Retry ↻] [Delete]
approved:[Merge ⊕] [Revoke]
```

#### Metrics Bar Component
```
Props:
  progress: number
  testsPass: number
  testsFail: number
  testsTotal: number
  linesAdded: number
  filesChanged: number
  cost: number
  duration: string
  previewUrl: string|null

Visual: horizontal row of metric items.
  Each item: large value on top, small label below.
  Preview URL right-aligned with "Open" button.
  
  Color rules:
    progress < 50: yellow
    progress >= 50: accent-purple
    progress = 100: green
    testsFail > 0: show fail count in red
    cost > $1.00: show in yellow (warning)
```

#### Tab: Agent Chat
```
Messages list (scrollable, newest at bottom):
  User message:    right-aligned, purple background
  Agent message:   left-aligned, --bg-secondary, show agent name
  System message:  left-aligned, green border, shows auto-fix results

Input bar fixed at bottom:
  Text input (full width) + Send button
  Placeholder changes by state:
    running: "Tell the agent what to do..."
    ready:   "Request specific changes..."
    error:   "Describe what you expected..."
```

#### Tab: Files
```
List of file changes:
  Each row: [change_type badge] [file_path] [+lines / -lines]
  
  Badge colors:
    added:    green
    modified: yellow  
    deleted:  red
    writing:  yellow pulsing animation

  Click file → shows file content in a code viewer
  Code viewer: syntax highlighted, read-only, line numbers
```

#### Tab: Tests
```
List of test results:
  Each row: [status icon] [test_name] [duration or error]
  
  Icons:
    ✅ passed (green)
    ❌ failed (red) — show error message below
    ⏳ queued (gray)
    🔄 running (yellow, spinning)

  Failed tests show:
    Error message (1-2 lines)
    Note: "Agent is auto-fixing..." or "Auto-fixed ✓"
```

#### Tab: Diff
```
Git diff viewer:
  File tabs across top (one tab per changed file)
  Side-by-side view: old (left) vs new (right)
  Line numbers on both sides
  Green highlight: added lines
  Red highlight: removed lines
  
  Use shadcn/ui or react-diff-viewer library
```

#### Tab: Logs
```
Terminal-style output:
  Monospace font (JetBrains Mono)
  Each line: [timestamp] [level] [message]
  
  Level colors:
    info:  --text-muted
    warn:  --status-yellow
    error: --status-red
    
  Auto-scroll to bottom (latest logs)
  Filter buttons: [All] [Errors] [Warnings]
```

#### Tab: Errors
```
Error cards (newest first):
  Each card:
    ┌─ [error title] ─────── [resolution badge] ─┐
    │  [error description]                         │
    │  [what agent tried]                          │
    │  [result: fixed / needs input]               │
    └──────────────────────────────────────────────┘
    
  Resolution badges:
    Auto-fixed:   green
    Fixing...:    yellow
    Needs input:  red — show [Apply fix] [More context] [Skip] buttons
    
  Debug mode section (when auto-fix fails twice):
    Diagnosis report with ranked hypotheses
    User picks action
```

---

### SCREEN 3: Create Session Modal
```
Trigger: [+ Create Session] button on dashboard

┌─ New Session ─────────────────────────── ✕ ─┐
│                                              │
│  What should this session build?             │
│  ┌────────────────────────────────────────┐  │
│  │ Add user authentication with JWT...    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Module ownership (directory scope):         │
│  ┌────────────────────────────────────────┐  │
│  │ backend/auth/                          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Agent type:  [Backend ▼]                    │
│  Priority:    [●●●●○ 4]                     │
│                                              │
│  Templates:                                  │
│  [Auth] [CRUD API] [Page] [Tests] [Fix bug]  │
│                                              │
│  [Cancel]                    [Create Session] │
└──────────────────────────────────────────────┘

Template buttons auto-fill description + module:
  Auth → "JWT auth with register, login, refresh" / backend/auth/
  CRUD API → "CRUD endpoints for [?]" / backend/[?]/
  Page → "Create [?] page" / frontend/app/[?]/
  Tests → "Write tests for [?]" / tests/[?]/
  Fix bug → "Fix: [?]" / (auto-detect from error)
```

---

## Interaction Patterns

### Navigation
```
Dashboard grid → click card → Session detail → click ← Back → Dashboard grid
All navigation via Next.js App Router (no page reloads)
URL always reflects current state (/dashboard/sessions/abc-123)
```

### Real-time Updates
```
WebSocket connection streams:
  - Session progress changes
  - New test results
  - Agent messages
  - Error detections
  - Event log entries
  
Dashboard cards update WITHOUT page refresh.
Detail view updates WITHOUT losing scroll position.
```

### Keyboard Shortcuts (power users)
```
N         → Open create session modal
1-9       → Focus session 1-9 (on dashboard)
Enter     → Open focused session detail
Escape    → Back to dashboard / close modal
M         → Merge all (when ready)
Space     → Pause/resume focused session
/         → Focus command bar
```

### Responsive Behavior
```
Desktop (>1200px):  2x2 session grid
Tablet (768-1200):  2x1 session grid (stack vertically)
Mobile (<768px):    1x1 session list (vertical cards)
Session detail:     same on all sizes (tabs stack on mobile)
```

---

## Conclusion

Build Screen 1 (session grid) first — it is the core product.
Then Screen 2 (session detail) — where real work happens.
Then Screen 3 (create modal) — how new sessions start.
Everything else (dashboard home, analytics, marketing, etc.) comes later.
Each screen follows the component specs above exactly.
