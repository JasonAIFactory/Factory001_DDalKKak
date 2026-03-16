# How Claude Code Works — Deep Dive
*Written for Jason. Goal: understand the system you're using so you can build the same.*

---

## 1. The Big Picture

Claude Code is a **CLI tool** that wraps the Claude API in an **agentic loop**.

You type a request in your terminal. Claude Code doesn't just answer — it *acts*.
It reads your files. It writes code. It runs commands. It loops until the task is done.

**Key insight:** What we're building in `backend/agents/executor.py` is the same pattern.
Claude Code = the blueprint. Our executor = our own version of it.

---

## 2. The Agentic Loop

This is the core mechanism. Every "turn" looks like this:

```
User request
     ↓
Send to Claude API (with tools + conversation history)
     ↓
Claude returns: text blocks + tool_use blocks
     ↓
Execute each tool (read file, write file, run bash, etc.)
     ↓
Send tool results back to Claude
     ↓
Repeat until: Claude stops calling tools (task done) or safety limit hit
```

Our executor implements this exact loop at [backend/agents/executor.py:169](../../backend/agents/executor.py#L169).

**Why a loop?** One API call gives Claude one "turn" — it can call multiple tools,
but then it must wait for results. After seeing results, it decides what to do next.
This loop is how complex multi-step tasks are completed.

---

## 3. Tools — What Claude Can Do

Tools are structured actions Claude can request. The API sends back a `tool_use` block
when Claude wants to call one. Your code executes it and returns the result.

### Claude Code's Built-in Tools

| Tool | What it does |
|------|-------------|
| `Read` | Read a file (returns content with line numbers) |
| `Write` | Create or overwrite a file |
| `Edit` | Make a precise string replacement in a file |
| `Bash` | Run any shell command (git, npm, python, etc.) |
| `Glob` | Find files by pattern (`**/*.py`) |
| `Grep` | Search file content with regex |
| `Agent` | Spawn a sub-agent to handle a complex sub-task |
| `WebFetch` | Fetch a URL and read its content |
| `WebSearch` | Search the web |
| `TodoWrite` | Write/update a task list (Claude's working memory) |

### Our Executor's Tools

Defined in `backend/agents/tools.py`. Similar concept, different tools:
- `write_file` — write code to the worktree
- `read_file` — read existing code
- `list_directory` — explore project structure
- `run_command` — run tests, npm build, etc.
- `search_files` — find code patterns
- `session_complete` — signal "I'm done"

**Key difference:** Claude Code has `Bash` (runs anything). Our executor controls
what commands are allowed for security. We can't let user-triggered AI run `rm -rf /`.

---

## 4. Tool Definition Format (Anthropic API)

Each tool is defined as a JSON schema. This is what you pass to `messages.create(tools=...)`:

```json
{
  "name": "write_file",
  "description": "Write content to a file in the project.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from the project root"
      },
      "content": {
        "type": "string",
        "description": "Full file content to write"
      }
    },
    "required": ["path", "content"]
  }
}
```

Claude reads the description to know *when* to use a tool and *what* to pass.
Good descriptions = better tool choices. Bad descriptions = wrong tool use.

**This is why `anthropic>=0.40.0` matters.** The `tools` parameter in
`messages.create()` was added in later SDK versions. Version 0.21.3 didn't have it.

---

## 5. Conversation History — How Context Works

Every API call sends the full conversation history. Not just the latest message — ALL of it.

```python
messages = [
    {"role": "user", "content": "Build a login page"},      # initial request
    {"role": "assistant", "content": [                       # Claude's response
        {"type": "text", "text": "I'll start with..."},
        {"type": "tool_use", "id": "t1", "name": "write_file", "input": {...}}
    ]},
    {"role": "user", "content": [                            # tool results
        {"type": "tool_result", "tool_use_id": "t1", "content": "File written."}
    ]},
    # ... more turns
]
```

Claude sees everything: what it wrote before, what tools it called, what results came back.
This is how it knows "I already wrote auth.py — now I should write the route."

**Token cost warning:** Long conversation histories = high token costs.
Our 30-iteration limit exists partly for this reason. After 30 turns, the history
alone would cost several dollars per API call.

---

## 6. Context Window — The Memory Limit

Claude's context window is ~200,000 tokens (claude-sonnet-4-6).
That sounds huge, but it fills up fast when:
- Reading large files
- Many iterations of back-and-forth
- Large command outputs

**Claude Code handles this with:**
- `TodoWrite` — offloads task tracking outside the context
- Truncation — cuts old history when approaching limits
- Summarization — compacts prior conversation turns
- Careful tool output limits (see our 8000-char cap in executor.py:356)

**Our executor does this at line 355:**
```python
if len(content) > 8000:
    return content[:8000] + "\n... (truncated)"
```

---

## 7. System Prompt — The Personality and Rules

Before any user message, a system prompt sets the rules:

```python
response = await client.messages.create(
    model="claude-sonnet-4-6",
    system="You are a DalkkakAI agent. Your task is...",  # ← system prompt
    messages=conversation_history,
    tools=TOOL_DEFINITIONS,
    max_tokens=4000,
)
```

The system prompt tells Claude:
- What role it's playing (Build agent? Fix agent? Marketing agent?)
- What rules to follow (write tests, commit style, file limits)
- What the project context is

**Claude Code's system prompt** includes all the rules you see in the UI:
bash-safety rules, file read requirements, conciseness rules, etc.
That's why Claude Code refuses to run `rm -rf` without asking.

---

## 8. Stop Reasons — When Does Claude Stop?

`response.stop_reason` tells you why Claude stopped:

| Stop reason | Meaning |
|------------|---------|
| `end_turn` | Claude finished naturally — no more tool calls |
| `tool_use` | Claude wants to call tools (loop must continue) |
| `max_tokens` | Hit the `max_tokens` limit — increase it |
| `stop_sequence` | Matched a custom stop sequence |

Our executor checks this at line 304:
```python
if response.stop_reason == "end_turn" and not tool_results:
    # Claude is truly done — no more tools, no more turns
    return ExecutionResult(success=True, ...)
```

---

## 9. Permissions — Who Controls What Claude Can Do

Claude Code has a permission system:
- **Auto-allowed:** Read files, search, non-destructive commands
- **Requires approval:** Write files, run bash, git push
- **Blocked:** Certain dangerous commands

When you see the approval prompt in Claude Code, that's the permission system.

**Our executor equivalent:** We whitelist specific commands in `backend/agents/tools.py`.
No arbitrary bash — only approved commands (pytest, npm build, etc.).

---

## 10. Memory Across Sessions

Claude has **zero built-in memory** between conversations. Every session starts fresh.
So how does Claude Code "remember" things?

**Answer: CLAUDE.md files.**
Claude Code reads `CLAUDE.md` automatically at the start of every session.
That file IS the persistent memory — it's why your rules and preferences carry over.

**Other persistence mechanisms:**
- `MEMORY.md` (what Claude stores about you across sessions)
- `logs/` directory (the learning log you read at session start)
- `TodoWrite` tool (task tracking within a session)

**In our product:** Sessions are stateless too. The DB stores conversation history
(`session_messages` table) which is loaded as the conversation seed for resumed sessions.

---

## 11. Parallel Agents — The Agent Tool

Claude Code can spawn sub-agents with the `Agent` tool. The parent agent:
1. Creates a new Claude instance
2. Gives it a specific sub-task
3. Gets back a result when done
4. Continues its own work

This is parallel execution within a single user session.

**Our product's equivalent:** Parallel git worktrees. Not sub-agents within one session,
but multiple independent sessions running concurrently in separate worktrees.

---

## 12. How Claude Code Handles Errors

When a bash command fails (exit code != 0), Claude Code:
1. Shows the error output
2. Keeps it in the conversation history
3. Claude sees the error and either fixes it or tries a different approach

It doesn't crash — errors are just data for the next turn.

**Our executor does the same at line 253:**
```python
result = await self.tool_executor.execute(tool_name, tool_input)
# result can be {"success": false, "error": "..."} — that's fine
# Claude will see the error and adjust
```

---

## 13. Streaming vs. Non-Streaming

Claude Code shows text appearing in real time. That's **streaming**.

Streaming API:
```python
async with client.messages.stream(model=..., messages=...) as stream:
    async for text in stream.text_stream:
        print(text, end="", flush=True)  # appears in real time
```

Non-streaming (what our executor currently uses):
```python
response = await client.messages.create(...)  # waits for full response
```

**Our current executor uses non-streaming** — Claude writes the full response,
then we process it. To get the "typing live" effect in our UI, we'd need streaming.
This is a future improvement (connect to WebSocket streaming).

---

## 14. What Makes This Different from "Just Asking ChatGPT"

| Feature | Chat AI | Claude Code / Our Executor |
|---------|---------|---------------------------|
| Memory | None | Persistent files, DB |
| Actions | Talk only | Read/write files, run commands |
| Loops | Single response | Multi-turn loop until task done |
| Output | Text | Actual working code, committed to git |
| Verification | None | Runs tests, checks output |

**This is the core insight of DalkkakAI:**
We're not building a chatbot. We're building an autonomous agent that *does work*,
not just *talks about work*. The difference is tool use + execution loop.

---

## 15. Cost Model for Agentic Loops

Every iteration of the loop costs money because:
- Full conversation history is sent every time
- History grows with each turn

**Typical costs for one feature session:**
- 10 iterations × ~5000 tokens/call = ~50K tokens total
- At Sonnet pricing ($3/M in, $15/M out): ~$0.25–$0.75 per session

**This is why COST.md rules exist:**
- Use Haiku for simple tasks (10× cheaper than Sonnet)
- Cap max_tokens at what you actually need (not 4096 always)
- Cache repeated calls
- Hard limit at $5/session

---

## Summary: What to Remember

1. **Agentic loop** = send request → get tool calls → execute → send results → repeat
2. **Tools** = the hands of the agent (read, write, run, search)
3. **Context** = full history sent every turn → costs grow with iterations
4. **System prompt** = the "personality" and rules for each agent type
5. **Stop reason** = how you know when Claude is done
6. **No built-in memory** → persistence via files (CLAUDE.md), DB, logs
7. **Our executor** = the same pattern, scoped to git worktrees + safe tool set

The executor you have in `backend/agents/executor.py` is correct in architecture.
The only bug was the SDK version — `anthropic==0.21.3` didn't support `tools`.
Fixed to `anthropic>=0.40.0`.

---
*Created: 2026-03-16 | Author: Claude for Jason*
