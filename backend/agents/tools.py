"""
agents/tools.py — Tool definitions that Claude can call during a session.

These are the "hands" of the AI agent. Claude calls these tools to:
  - Write code files to the worktree
  - Read existing files for context
  - Run tests to verify changes
  - List files to understand project structure
  - Run shell commands (npm install, pip install, etc.)

Every tool call is recorded as a file change and broadcast via WebSocket.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Tool schema definitions (sent to Claude API) ──────────────────────────────
# Claude reads these and decides which tool to call.

TOOL_DEFINITIONS = [
    {
        "name": "write_file",
        "description": (
            "Write content to a file in the project. "
            "Creates the file if it doesn't exist, overwrites if it does. "
            "Use this to create or modify source code files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative file path from project root (e.g. 'src/components/Button.tsx')",
                },
                "content": {
                    "type": "string",
                    "description": "Complete file content to write",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "read_file",
        "description": (
            "Read the contents of an existing file. "
            "Use this to understand existing code before modifying it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative file path from project root",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": (
            "List files and directories in a given path. "
            "Use this to understand project structure."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative directory path (use '.' for project root)",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_command",
        "description": (
            "Run a shell command in the project directory. "
            "Use for: running tests, installing packages, generating files. "
            "DO NOT use for: git operations, deploying, or destructive commands."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to run (e.g. 'pytest tests/', 'npm test', 'pip install -r requirements.txt')",
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default: 60, max: 300)",
                    "default": 60,
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "search_files",
        "description": (
            "Search for text patterns across project files. "
            "Use to find where something is defined or used."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Text or regex pattern to search for",
                },
                "file_pattern": {
                    "type": "string",
                    "description": "File glob pattern to limit search (e.g. '*.py', '*.tsx')",
                    "default": "*",
                },
            },
            "required": ["pattern"],
        },
    },
    {
        "name": "session_complete",
        "description": (
            "Signal that the session work is complete and ready for review. "
            "Call this when all files are written and tests pass. "
            "Include a summary of what was done."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "What was built/changed in this session (2-5 sentences)",
                },
                "files_created": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of new files created",
                },
                "files_modified": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of existing files modified",
                },
            },
            "required": ["summary"],
        },
    },
]


# ── Tool executor ─────────────────────────────────────────────────────────────

class ToolExecutor:
    """
    Executes tool calls made by Claude during a session.
    All file operations are scoped to the session's worktree.
    Broadcasts results via WebSocket after each tool call.
    """

    # Commands that are never allowed regardless of context
    _BLOCKED_COMMANDS = [
        "git push", "git reset --hard", "git checkout",
        "rm -rf", "rmdir /s", "del /f",
        "curl", "wget",  # no network from within agent
        "sudo", "su ",
    ]

    def __init__(self, worktree_path: str, startup_id: str, session_id: str) -> None:
        self.worktree_path = worktree_path
        self.startup_id = startup_id
        self.session_id = session_id

    def _resolve_path(self, relative: str) -> Path:
        """
        Resolve a relative path safely within the worktree.
        Prevents path traversal attacks (../../etc/passwd).
        """
        base = Path(self.worktree_path).resolve()
        target = (base / relative).resolve()

        # Security: ensure target is inside the worktree
        if not str(target).startswith(str(base)):
            raise ValueError(f"Path traversal blocked: {relative}")

        return target

    async def write_file(self, path: str, content: str) -> dict:
        """Write content to a file. Creates parent directories if needed."""
        target = self._resolve_path(path)

        is_new = not target.exists()
        target.parent.mkdir(parents=True, exist_ok=True)

        # Count line changes
        old_lines = target.read_text(encoding="utf-8").splitlines() if not is_new else []
        new_lines = content.splitlines()
        lines_added = max(0, len(new_lines) - len(old_lines))

        target.write_text(content, encoding="utf-8")

        change_type = "added" if is_new else "modified"
        logger.info("Agent wrote file: %s (%s)", path, change_type)

        # Broadcast to WebSocket clients
        from backend.websocket.hub import broadcast_file_change
        await broadcast_file_change(self.startup_id, self.session_id, path, change_type)

        return {
            "success": True,
            "path": path,
            "change_type": change_type,
            "lines": len(new_lines),
            "lines_added": lines_added,
        }

    async def read_file(self, path: str) -> dict:
        """Read and return file contents."""
        target = self._resolve_path(path)

        if not target.exists():
            return {"success": False, "error": f"File not found: {path}"}

        content = target.read_text(encoding="utf-8")
        return {"success": True, "path": path, "content": content}

    async def list_files(self, path: str) -> dict:
        """List directory contents."""
        target = self._resolve_path(path)

        if not target.exists():
            return {"success": False, "error": f"Path not found: {path}"}
        if not target.is_dir():
            return {"success": False, "error": f"Not a directory: {path}"}

        entries = []
        for item in sorted(target.iterdir()):
            # Skip hidden dirs and common noise
            if item.name.startswith(".") or item.name in ("__pycache__", "node_modules"):
                continue
            entries.append({
                "name": item.name,
                "type": "dir" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None,
            })

        return {"success": True, "path": path, "entries": entries}

    async def run_command(self, command: str, timeout: int = 60) -> dict:
        """
        Run a shell command in the worktree directory.
        Blocked commands are rejected before execution.
        """
        # Security: reject blocked commands
        command_lower = command.lower().strip()
        for blocked in self._BLOCKED_COMMANDS:
            if blocked in command_lower:
                return {
                    "success": False,
                    "error": f"Command blocked for security: '{blocked}' is not allowed",
                }

        timeout_capped = min(timeout, 300)  # max 5 minutes

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=self.worktree_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout_capped,
            )
            stdout = stdout_b.decode("utf-8", errors="replace")
            stderr = stderr_b.decode("utf-8", errors="replace")
            returncode = proc.returncode or 0

            logger.info("Command '%s' → rc=%d", command[:80], returncode)
            return {
                "success": returncode == 0,
                "returncode": returncode,
                "stdout": stdout[:4000],  # cap output size
                "stderr": stderr[:2000],
            }

        except asyncio.TimeoutError:
            return {"success": False, "error": f"Command timed out after {timeout_capped}s"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def search_files(self, pattern: str, file_pattern: str = "*") -> dict:
        """Search for text pattern across project files."""
        import fnmatch
        import re

        base = Path(self.worktree_path)
        matches = []

        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error:
            regex = re.compile(re.escape(pattern), re.IGNORECASE)

        for file_path in base.rglob(file_pattern):
            if not file_path.is_file():
                continue
            # Skip binary files and noise
            if file_path.suffix in (".pyc", ".png", ".jpg", ".ico", ".lock"):
                continue
            if any(p in str(file_path) for p in ["__pycache__", "node_modules", ".git"]):
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for line_num, line in enumerate(content.splitlines(), 1):
                    if regex.search(line):
                        matches.append({
                            "file": str(file_path.relative_to(base)),
                            "line": line_num,
                            "content": line.strip()[:200],
                        })
                        if len(matches) >= 50:  # cap results
                            break
            except Exception:
                continue

            if len(matches) >= 50:
                break

        return {"success": True, "matches": matches, "total": len(matches)}

    async def execute(self, tool_name: str, tool_input: dict) -> dict:
        """
        Dispatch a tool call from Claude to the right method.
        Returns the tool result as a dict.
        """
        handlers = {
            "write_file": lambda: self.write_file(
                tool_input["path"], tool_input["content"]
            ),
            "read_file": lambda: self.read_file(tool_input["path"]),
            "list_files": lambda: self.list_files(tool_input["path"]),
            "run_command": lambda: self.run_command(
                tool_input["command"], tool_input.get("timeout", 60)
            ),
            "search_files": lambda: self.search_files(
                tool_input["pattern"], tool_input.get("file_pattern", "*")
            ),
        }

        handler = handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        try:
            return await handler()
        except ValueError as exc:
            return {"success": False, "error": str(exc)}
        except Exception as exc:
            logger.exception("Tool execution error: %s", tool_name)
            return {"success": False, "error": f"Tool error: {exc}"}
