# AGENTS.md — Agent Definitions

> Each agent has ONE job. Clear boundaries prevent chaos.

## Agent Types

### 1. Router Agent (the gatekeeper)
- **Model**: Haiku (cheapest)
- **Job**: Classify every user request and route to the right handler
- **Input**: Raw user text from command bar
- **Output**: `{category, handler, model_needed, estimated_cost}`
- **Rule**: This runs on EVERY request. Must be fast (<500ms) and cheap (<$0.002)

### 2. Build Agent (the architect)
- **Model**: Opus (for initial build), Sonnet (for feature additions)
- **Job**: Take a startup description and generate complete project
- **Input**: Natural language description + SPEC.md templates
- **Output**: Complete file structure ready for deployment
- **Owns**: All files during initial build
- **Steps**:
  1. Parse requirements into structured spec
  2. Choose tech stack (from pre-approved templates)
  3. Generate file structure
  4. Generate each file with proper interfaces
  5. Generate basic tests
  6. Generate Dockerfile + deploy config
  7. Generate landing page
  8. Generate Stripe billing config

### 3. Feature Agent (the builder)
- **Model**: Sonnet
- **Job**: Add features to existing startup
- **Input**: Feature description + current codebase context
- **Output**: New/modified files on a feature branch
- **Owns**: Only files related to the feature (check SPEC.md boundaries)
- **Rules**:
  - Always work on a feature branch, never main
  - Read existing code before writing new code
  - Maintain existing patterns and conventions
  - Run tests after changes
  - Max 10 files per session (split larger features)

### 4. Fix Agent (the debugger)
- **Model**: Sonnet (try first), Opus (if Sonnet fails)
- **Job**: Diagnose and fix errors
- **Input**: Error logs + relevant source files
- **Output**: Fixed code + explanation
- **Rules**:
  - Start with Sonnet — escalate to Opus only if first fix fails
  - Always explain what was wrong and why the fix works
  - Never apply fix without running tests first
  - If fix affects multiple modules, flag for human review

### 5. Marketing Agent (the marketer)
- **Model**: Haiku (short copy), Sonnet (long content)
- **Job**: Generate marketing content
- **Input**: Startup description + target audience + content type
- **Output**: Blog posts, ad copy, email templates, social posts, SEO meta
- **Owns**: Marketing content files only, never code
- **Rules**:
  - Use Haiku for: headlines, email subjects, meta descriptions, social posts
  - Use Sonnet for: blog posts, landing page copy, ad campaigns
  - Never use Opus for marketing content
  - Always match the startup's tone and audience

### 6. Support Agent (the helper)
- **Model**: Haiku
- **Job**: Auto-resolve customer support tickets
- **Input**: Customer message + startup's knowledge base (RAG)
- **Output**: Reply to customer OR escalation to founder
- **Rules**:
  - Check knowledge base first (RAG lookup — no AI cost if answer found)
  - Use Haiku for response generation
  - Escalate to founder if: angry customer, refund request, bug report, or confidence < 80%
  - Never promise features or timelines on behalf of the founder
  - Always be polite and professional

### 7. Advisor Agent (the analyst)
- **Model**: Haiku (quick insights), Sonnet (deep analysis)
- **Job**: Analyze business metrics and provide actionable recommendations
- **Input**: Metrics data from database (NOT raw AI — pre-aggregated)
- **Output**: Insights with specific recommendations
- **Rules**:
  - Read-only. Never modify code, data, or settings.
  - Use Haiku for quick metric comparisons
  - Use Sonnet for weekly business reports
  - Always include specific numbers and actionable next steps
  - Never give generic advice — reference the startup's actual data

## Agent Communication

Agents do NOT talk to each other directly. Communication flows through:

```
User → Router Agent → Specific Agent → Result → User
                    ↕
              Shared Database
           (all agents read/write)
```

If Feature Agent needs data that Advisor Agent typically provides:
- DON'T: call Advisor Agent from Feature Agent
- DO: query the database directly

## Context Management (save tokens, save money)

### What to include in agent context:
- SPEC.md (always — it's the contract)
- CLAUDE.md (always — coding rules)
- Only the files the agent needs to modify
- Only the conversation history for THIS session

### What to NEVER include:
- Entire codebase (too expensive)
- Other sessions' conversations
- Raw log files (summarize first)
- Marketing content when doing code work (irrelevant)

### Context budget per model:
| Model | Max context to send | Why |
|-------|-------------------|-----|
| Haiku | 2,000 tokens | Keep it fast and cheap |
| Sonnet | 8,000 tokens | Enough for 3-4 files + spec |
| Opus | 20,000 tokens | Full feature context |

## Error Recovery

If an agent fails:
1. Log the error with full context
2. If Haiku failed → retry once with Haiku
3. If Sonnet failed → escalate to Opus (one retry)
4. If Opus failed → notify user: "I couldn't complete this. Here's what went wrong."
5. Never retry more than twice (cap costs)
6. Never silently fail — always inform the user
