"""
agents/executor.py — The agent execution engine. The core of DalkkakAI.

This is what makes DalkkakAI a "visual tmux for AI agents."
It runs Claude in a loop with tool use inside a git worktree,
streaming every action (file write, test run, message) to the WebSocket.

Flow:
  1. Load session context (description, existing files, conversation)
  2. Call Claude API with tool definitions
  3. Claude calls tools → write_file, run_command, run tests
  4. Each tool call is broadcast via WebSocket (UI updates live)
  5. Loop until Claude calls session_complete or hits cost/time limit
  6. Commit changes, mark session as ready for review
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from decimal import Decimal

import anthropic

from backend.agents.tools import TOOL_DEFINITIONS, ToolExecutor
from backend.config import settings

logger = logging.getLogger(__name__)

_platform_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

# ── Model IDs ─────────────────────────────────────────────────────────────────
_MODEL_MAP = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
    "opus": "claude-opus-4-6",
}

# ── Safety limits ──────────────────────────────────────────────────────────────
MAX_ITERATIONS = 30        # Max tool-call loops per session
MAX_COST_USD = 5.0         # Auto-pause if session exceeds $5 (SESSIONS.md rule)
MAX_DURATION_SECONDS = 1800  # Auto-pause after 30 minutes


@dataclass
class ExecutionResult:
    """Final result of running a session."""

    success: bool
    summary: str = ""
    files_created: list[str] = field(default_factory=list)
    files_modified: list[str] = field(default_factory=list)
    total_cost: Decimal = Decimal("0")
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    model_calls: int = 0
    error: str | None = None


# ── System prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(session_description: str, startup_name: str, agent_type: str) -> str:
    """
    Build the system prompt for the agent.
    Short and focused — we don't dump the entire codebase (AGENTS.md rule).
    """
    agent_roles = {
        "build": "You are building a complete startup application from scratch.",
        "feature": "You are adding a specific feature to an existing application.",
        "fix": "You are diagnosing and fixing a bug or error.",
        "marketing": "You are creating marketing content (copy, blog posts, SEO).",
        "support": "You are handling a customer support ticket.",
    }
    role = agent_roles.get(agent_type, "You are implementing a software feature.")

    return f"""You are a DalkkakAI agent. {role}

## Your Task
{session_description}

## Rules
- Write production-quality code with proper error handling
- Read existing files before modifying them
- Run tests after making changes — fix failures before proceeding
- Write one file at a time, then verify it works
- Use `session_complete` when ALL work is done and tests pass
- Never use git commands — the system handles git automatically
- Max 10 files per session — focus on one feature at a time

## Startup
Name: {startup_name}

## Workflow
1. List existing files to understand the project structure
2. Read relevant files before writing new ones
3. Write/modify files one at a time
4. Run tests after each significant change
5. Fix any failures before continuing
6. Call session_complete with a clear summary when done
"""


# ── Main executor ─────────────────────────────────────────────────────────────

class AgentExecutor:
    """
    Runs a Claude agent in a loop inside a git worktree.

    The executor:
    - Calls Claude with tool definitions
    - Routes each tool call to ToolExecutor
    - Broadcasts every action via WebSocket
    - Tracks cost and enforces safety limits
    - Persists messages and file changes to the DB
    """

    def __init__(
        self,
        session_id: str,
        startup_id: str,
        startup_name: str,
        worktree_path: str,
        description: str,
        agent_type: str,
        model_tier: str,
        api_key: str | None = None,
    ) -> None:
        self.session_id = session_id
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.worktree_path = worktree_path
        self.description = description
        self.agent_type = agent_type
        self.model_id = _MODEL_MAP.get(model_tier, _MODEL_MAP["sonnet"])
        # BYOK: use user's key if provided, otherwise fall back to platform key
        self._client = (
            anthropic.AsyncAnthropic(api_key=api_key)
            if api_key
            else _platform_client
        )

        self.tool_executor = ToolExecutor(worktree_path, startup_id, session_id)
        self.conversation: list[dict] = []

        # Tracking
        self.total_cost = Decimal("0")
        self.total_tokens_in = 0
        self.total_tokens_out = 0
        self.model_calls = 0
        self.files_created: list[str] = []
        self.files_modified: list[str] = []
        self.start_time = time.time()

    async def _load_conversation(self) -> list[dict]:
        """Load existing conversation from DB for chat follow-ups."""
        try:
            from backend.database import AsyncSessionLocal
            from backend.models.session import SessionMessage
            from sqlalchemy import select as sa_select

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    sa_select(SessionMessage)
                    .where(SessionMessage.session_id == self.session_id)
                    .order_by(SessionMessage.created_at.asc())
                )
                messages = result.scalars().all()

                if not messages:
                    return []

                conversation = []
                for msg in messages:
                    if msg.role in ("user", "assistant"):
                        conversation.append({
                            "role": msg.role,
                            "content": msg.content,
                        })
                return conversation
        except Exception as e:
            logger.warning("Could not load conversation: %s", e)
            return []

    async def run(self) -> ExecutionResult:
        """
        Main execution loop. Runs until session_complete or a safety limit.
        Called by the session queue worker.
        """
        from backend.websocket.hub import broadcast_error, broadcast_message, broadcast_progress

        logger.info(
            "Executor starting: session=%s model=%s",
            self.session_id, self.model_id,
        )

        # Initial progress broadcast
        await broadcast_progress(self.startup_id, self.session_id, 0, "Starting agent...")

        # Load existing conversation from DB (for chat follow-ups)
        self.conversation = await self._load_conversation()
        if not self.conversation:
            # Fresh session — start with description
            self.conversation = [
                {"role": "user", "content": self.description}
            ]

        for iteration in range(MAX_ITERATIONS):
            # ── Safety checks ────────────────────────────────────────
            if float(self.total_cost) >= MAX_COST_USD:
                logger.warning("Session hit cost limit: %s", self.session_id)
                return ExecutionResult(
                    success=False,
                    error=f"Session paused: cost limit ${MAX_COST_USD} reached (spent ${self.total_cost:.2f})",
                )

            elapsed = time.time() - self.start_time
            if elapsed > MAX_DURATION_SECONDS:
                return ExecutionResult(
                    success=False,
                    error=f"Session paused: 30-minute time limit reached",
                )

            # ── Progress estimate ─────────────────────────────────────
            # Rough heuristic: each iteration = ~3% progress, capped at 90%
            progress = min(90, iteration * 3)
            await broadcast_progress(
                self.startup_id, self.session_id,
                progress, f"Working... (step {iteration + 1})"
            )

            # ── Call Claude API ───────────────────────────────────────
            try:
                response = await self._client.messages.create(
                    model=self.model_id,
                    max_tokens=4000,
                    system=_build_system_prompt(
                        self.description, self.startup_name, self.agent_type
                    ),
                    tools=TOOL_DEFINITIONS,
                    messages=self.conversation,
                )
            except anthropic.RateLimitError:
                await asyncio.sleep(10)
                continue
            except anthropic.BadRequestError as exc:
                # Parse human-readable message from Anthropic error body
                try:
                    msg = exc.body["error"]["message"]  # type: ignore[index]
                except Exception:
                    msg = str(exc)
                logger.error("Anthropic bad request in session %s: %s", self.session_id, msg)
                return ExecutionResult(success=False, error=msg)
            except anthropic.APIError as exc:
                logger.exception("Anthropic API error in session %s", self.session_id)
                return ExecutionResult(success=False, error=f"AI API error: {exc}")

            # ── Track cost ────────────────────────────────────────────
            self.model_calls += 1
            self.total_tokens_in += response.usage.input_tokens
            self.total_tokens_out += response.usage.output_tokens
            self._add_cost(response.usage.input_tokens, response.usage.output_tokens)

            # ── Process response content blocks ───────────────────────
            # A response can contain text + multiple tool_use blocks
            assistant_message = {"role": "assistant", "content": response.content}
            self.conversation.append(assistant_message)

            tool_results = []
            session_done = False
            completion_result = None

            for block in response.content:

                if block.type == "text" and block.text.strip():
                    # Claude wrote a thought/explanation — broadcast to chat
                    await broadcast_message(
                        self.startup_id, self.session_id, "agent", block.text
                    )
                    await self._persist_message("agent", block.text)

                elif block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input

                    logger.info("Tool call: %s %s", tool_name, list(tool_input.keys()))

                    # ── Handle session_complete ───────────────────────
                    if tool_name == "session_complete":
                        session_done = True
                        completion_result = tool_input
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": "Session marked as complete.",
                        })
                        break  # Stop processing more blocks

                    # ── Execute the tool ──────────────────────────────
                    result = await self.tool_executor.execute(tool_name, tool_input)

                    # Track file changes
                    if tool_name == "write_file" and result.get("success"):
                        path = tool_input["path"]
                        if result.get("change_type") == "added":
                            self.files_created.append(path)
                        else:
                            self.files_modified.append(path)

                        # Persist file change to DB
                        await self._persist_file_change(
                            path,
                            result.get("change_type", "modified"),
                            result.get("lines_added", 0),
                        )

                    # Format result as string for Claude's next context
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": self._format_tool_result(result),
                    })

            # ── Feed tool results back to Claude ──────────────────────
            if tool_results:
                self.conversation.append({
                    "role": "user",
                    "content": tool_results,
                })

            # ── Check if done ─────────────────────────────────────────
            if session_done and completion_result:
                summary = completion_result.get("summary", "Session complete.")

                # Commit the work
                await self._commit_work(summary)

                logger.info("Session complete: %s", self.session_id)
                return ExecutionResult(
                    success=True,
                    summary=summary,
                    files_created=self.files_created,
                    files_modified=self.files_modified,
                    total_cost=self.total_cost,
                    total_tokens_in=self.total_tokens_in,
                    total_tokens_out=self.total_tokens_out,
                    model_calls=self.model_calls,
                )

            # ── Check stop reason ─────────────────────────────────────
            if response.stop_reason == "end_turn":
                # Claude stopped but didn't call session_complete
                # This means it's done with this turn but may need more info
                if not tool_results:
                    # No tools called, no more turns — treat as done
                    return ExecutionResult(
                        success=True,
                        summary="Session completed.",
                        files_created=self.files_created,
                        files_modified=self.files_modified,
                        total_cost=self.total_cost,
                        total_tokens_in=self.total_tokens_in,
                        total_tokens_out=self.total_tokens_out,
                        model_calls=self.model_calls,
                    )

        # Exhausted max iterations without session_complete
        return ExecutionResult(
            success=False,
            error=f"Session reached max iterations ({MAX_ITERATIONS}) without completing.",
            total_cost=self.total_cost,
            total_tokens_in=self.total_tokens_in,
            total_tokens_out=self.total_tokens_out,
            model_calls=self.model_calls,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _add_cost(self, tokens_in: int, tokens_out: int) -> None:
        """Add cost for one API call based on model pricing."""
        # Prices per 1M tokens
        pricing = {
            "claude-haiku-4-5-20251001": (0.25, 1.25),
            "claude-sonnet-4-6": (3.0, 15.0),
            "claude-opus-4-6": (15.0, 75.0),
        }
        in_price, out_price = pricing.get(self.model_id, (3.0, 15.0))
        cost = Decimal(str(
            (tokens_in / 1_000_000) * in_price +
            (tokens_out / 1_000_000) * out_price
        ))
        self.total_cost += cost

    def _format_tool_result(self, result: dict) -> str:
        """Format a tool result as a readable string for Claude's next context."""
        if not result.get("success"):
            return f"ERROR: {result.get('error', 'Unknown error')}"

        if "content" in result:
            content = result["content"]
            # Cap file content at 8000 chars to avoid token overflow
            if len(content) > 8000:
                return content[:8000] + "\n... (truncated)"
            return content

        if "entries" in result:
            lines = []
            for entry in result["entries"]:
                prefix = "📁 " if entry["type"] == "dir" else "📄 "
                lines.append(f"{prefix}{entry['name']}")
            return "\n".join(lines) or "(empty directory)"

        if "matches" in result:
            if not result["matches"]:
                return "No matches found."
            lines = [f"{m['file']}:{m['line']}: {m['content']}" for m in result["matches"]]
            return "\n".join(lines)

        if "stdout" in result:
            output = result.get("stdout", "")
            stderr = result.get("stderr", "")
            rc = result.get("returncode", 0)
            parts = [f"Exit code: {rc}"]
            if output:
                parts.append(f"Output:\n{output}")
            if stderr:
                parts.append(f"Stderr:\n{stderr}")
            return "\n".join(parts)

        return "OK"

    async def _persist_message(self, role: str, content: str) -> None:
        """Persist a conversation message to the DB (best-effort)."""
        try:
            from backend.database import AsyncSessionLocal
            from backend.sessions.service import add_message

            async with AsyncSessionLocal() as db:
                import uuid
                await add_message(
                    db,
                    session_id=uuid.UUID(self.session_id),
                    role=role,
                    content=content,
                    model_used=self.model_id,
                )
                await db.commit()
        except Exception:
            logger.warning("Failed to persist message for session %s", self.session_id)

    async def _persist_file_change(
        self, file_path: str, change_type: str, lines_added: int
    ) -> None:
        """Persist a file change record to the DB (best-effort)."""
        try:
            from backend.database import AsyncSessionLocal
            from backend.sessions.service import record_file_change

            async with AsyncSessionLocal() as db:
                import uuid
                await record_file_change(
                    db,
                    session_id=uuid.UUID(self.session_id),
                    file_path=file_path,
                    change_type=change_type,
                    lines_added=lines_added,
                )
                await db.commit()
        except Exception:
            logger.warning("Failed to persist file change for session %s", self.session_id)

    async def _commit_work(self, summary: str) -> None:
        """Commit all changes made in the worktree."""
        try:
            from backend.sessions.git import commit_session_work
            await commit_session_work(
                self.worktree_path,
                f"feat: {summary[:72]}",  # git commit message limit
            )
        except Exception:
            logger.warning("Failed to commit worktree for session %s", self.session_id)
