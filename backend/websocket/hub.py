"""
websocket/hub.py — Real-time WebSocket hub for session updates.

Every session state change (progress, file write, test result, message)
is broadcast to all clients watching that startup's sessions.

Client connects to: /ws/sessions/{startup_id}
Events sent: session.progress, session.file_change, session.message,
             session.test_result, session.completed, session.error, session.merged
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class SessionHub:
    """
    In-memory WebSocket connection manager.

    Architecture: one hub per startup_id.
    When an agent updates session state, it calls broadcast()
    and all connected browser clients receive the update instantly.

    Phase 1 (monolith): in-memory dict — works for one process.
    Phase 2 (microservices): replace with Redis pub/sub so
    multiple FastAPI instances can all broadcast to the same clients.
    """

    def __init__(self) -> None:
        # startup_id → list of connected WebSocket clients
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, startup_id: str, websocket: WebSocket) -> None:
        """Accept and register a new client connection."""
        await websocket.accept()
        self._connections[startup_id].append(websocket)
        logger.info("WS connected: startup=%s total=%d", startup_id, len(self._connections[startup_id]))

    def disconnect(self, startup_id: str, websocket: WebSocket) -> None:
        """Remove a client connection (on close or error)."""
        connections = self._connections.get(startup_id, [])
        if websocket in connections:
            connections.remove(websocket)
        logger.info("WS disconnected: startup=%s remaining=%d", startup_id, len(connections))

    async def broadcast(self, startup_id: str, event: str, data: dict) -> None:
        """
        Send an event to all clients watching a startup's sessions.
        Silently drops failed connections (client closed tab, network drop).
        """
        payload = json.dumps({"event": event, "data": data})
        dead_connections: list[WebSocket] = []

        for ws in self._connections.get(startup_id, []):
            try:
                await ws.send_text(payload)
            except Exception:
                dead_connections.append(ws)

        # Clean up dead connections
        for ws in dead_connections:
            self.disconnect(startup_id, ws)

    def connection_count(self, startup_id: str) -> int:
        """Return how many clients are watching a startup."""
        return len(self._connections.get(startup_id, []))


# ── Singleton hub instance ────────────────────────────────────────────────────
# One hub for the entire application (safe for Phase 1 monolith).
hub = SessionHub()


# ── Convenience broadcast helpers ─────────────────────────────────────────────
# These are called by the agent executor during session execution.

async def broadcast_progress(startup_id: str, session_id: str, progress: int, task: str) -> None:
    """Broadcast session progress update (0-100 + current task description)."""
    await hub.broadcast(startup_id, "session.progress", {
        "session_id": session_id,
        "progress": progress,
        "current_task": task,
    })


async def broadcast_file_change(
    startup_id: str,
    session_id: str,
    file_path: str,
    change_type: str,
) -> None:
    """Broadcast when the agent writes or modifies a file."""
    await hub.broadcast(startup_id, "session.file_change", {
        "session_id": session_id,
        "file_path": file_path,
        "change_type": change_type,
    })


async def broadcast_message(
    startup_id: str,
    session_id: str,
    role: str,
    content: str,
) -> None:
    """Broadcast a new chat message (agent response streamed to UI)."""
    await hub.broadcast(startup_id, "session.message", {
        "session_id": session_id,
        "role": role,
        "content": content,
    })


async def broadcast_test_result(
    startup_id: str,
    session_id: str,
    passed: int,
    failed: int,
    total: int,
) -> None:
    """Broadcast test run results."""
    await hub.broadcast(startup_id, "session.test_result", {
        "session_id": session_id,
        "passed": passed,
        "failed": failed,
        "total": total,
    })


async def broadcast_completed(startup_id: str, session_id: str, summary: str) -> None:
    """Broadcast session completion — triggers Review state in UI."""
    await hub.broadcast(startup_id, "session.completed", {
        "session_id": session_id,
        "summary": summary,
    })


async def broadcast_error(startup_id: str, session_id: str, error: str) -> None:
    """Broadcast agent error — triggers Error state in UI."""
    await hub.broadcast(startup_id, "session.error", {
        "session_id": session_id,
        "error": error,
    })


async def broadcast_merged(startup_id: str, session_id: str) -> None:
    """Broadcast successful merge — triggers deploy in UI."""
    await hub.broadcast(startup_id, "session.merged", {
        "session_id": session_id,
    })


async def broadcast_test_output(
    startup_id: str,
    session_id: str,
    event: str,
    data: dict,
) -> None:
    """
    Broadcast live test output to the UI.

    Events:
      test.started   — tests are beginning
      test.line      — one line of pytest output (streamed live)
      test.completed — final results with pass/fail counts
      test.preview   — preview URL ready for user to click
    """
    await hub.broadcast(startup_id, event, {
        "session_id": session_id,
        **data,
    })
