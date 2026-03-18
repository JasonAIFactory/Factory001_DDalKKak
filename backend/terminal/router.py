"""WebSocket-based terminal with tmux session persistence.

Each user gets a named tmux session that survives page refreshes.
Reconnecting re-attaches to the same session — Claude Code keeps running.
"""
from __future__ import annotations

import asyncio
import fcntl
import json
import logging
import os
import pty
import signal
import struct
import subprocess
import termios

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

# Track active tmux sessions: session_name -> child_pid
_active_sessions: dict[str, int] = {}


def _tmux_session_exists(name: str) -> bool:
    """Check if a named tmux session exists."""
    result = subprocess.run(
        ["tmux", "has-session", "-t", name],
        capture_output=True,
    )
    return result.returncode == 0


def _create_tmux_session(name: str) -> None:
    """Create a detached tmux session."""
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    subprocess.run(
        ["tmux", "new-session", "-d", "-s", name, "-x", "120", "-y", "30"],
        capture_output=True,
        env=env,
        cwd="/workspace",
    )
    logger.info("tmux session created: %s", name)


class TerminalSession:
    """Attaches to a tmux session via PTY."""

    def __init__(self, session_name: str):
        self.session_name = session_name
        self.master_fd: int | None = None
        self.child_pid: int | None = None
        self._reader_task: asyncio.Task | None = None

    async def attach(self, websocket: WebSocket, cols: int = 120, rows: int = 30) -> None:
        """Attach to an existing tmux session via a new PTY."""
        master_fd, slave_fd = pty.openpty()

        # Set terminal size
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

        env = os.environ.copy()
        env["TERM"] = "xterm-256color"

        # Attach to tmux session (not create new)
        proc = subprocess.Popen(
            ["tmux", "attach-session", "-t", self.session_name],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            env=env,
        )

        os.close(slave_fd)
        self.master_fd = master_fd
        self.child_pid = proc.pid

        # Non-blocking reads
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        self._reader_task = asyncio.create_task(self._read_loop(websocket))
        logger.info("Attached to tmux '%s': pid=%d", self.session_name, proc.pid)

    async def _read_loop(self, websocket: WebSocket) -> None:
        """Read PTY output and send to WebSocket."""
        loop = asyncio.get_event_loop()
        try:
            while True:
                try:
                    data = await loop.run_in_executor(None, self._blocking_read)
                    if data:
                        await websocket.send_bytes(data)
                    else:
                        await asyncio.sleep(0.02)
                except OSError:
                    break
                except Exception as e:
                    if "disconnect" in str(e).lower() or "close" in str(e).lower():
                        break
                    await asyncio.sleep(0.02)
        except asyncio.CancelledError:
            pass

    def _blocking_read(self) -> bytes | None:
        """Read from master fd in executor thread."""
        import select as sel
        if self.master_fd is None:
            return None
        try:
            r, _, _ = sel.select([self.master_fd], [], [], 0.1)
            if r:
                return os.read(self.master_fd, 4096)
        except OSError:
            raise
        return None

    async def write(self, data: bytes) -> None:
        """Write input to PTY."""
        if self.master_fd is not None:
            try:
                os.write(self.master_fd, data)
            except OSError as e:
                logger.error("Write error: %s", e)

    def resize(self, cols: int, rows: int) -> None:
        """Resize the PTY and tmux window."""
        if self.master_fd is not None:
            try:
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except OSError:
                pass
        # Also resize tmux
        subprocess.run(
            ["tmux", "resize-window", "-t", self.session_name, "-x", str(cols), "-y", str(rows)],
            capture_output=True,
        )

    async def detach(self) -> None:
        """Detach from tmux (session stays alive)."""
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass

        # Kill the attach process, NOT the tmux session
        if self.child_pid:
            try:
                os.killpg(os.getpgid(self.child_pid), signal.SIGHUP)
            except (OSError, ProcessLookupError):
                pass
            try:
                os.waitpid(self.child_pid, os.WNOHANG)
            except ChildProcessError:
                pass

        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None

        logger.info("Detached from tmux '%s' (session still alive)", self.session_name)


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """WebSocket terminal endpoint with tmux persistence.

    - First connect: creates tmux session + attaches
    - Reconnect: re-attaches to existing session (Claude Code still running)
    - Disconnect: detaches only (tmux session stays alive)
    """
    await websocket.accept()

    # Use a fixed session name per connection (TODO: per-user when auth added)
    session_name = "dalkkak-main"

    # Create tmux session if it doesn't exist
    if not _tmux_session_exists(session_name):
        _create_tmux_session(session_name)

    terminal = TerminalSession(session_name)

    try:
        await terminal.attach(websocket)

        while True:
            msg = await websocket.receive()

            if "bytes" in msg and msg["bytes"]:
                await terminal.write(msg["bytes"])
            elif "text" in msg and msg["text"]:
                try:
                    cmd = json.loads(msg["text"])
                    if cmd.get("type") == "resize":
                        terminal.resize(
                            cmd.get("cols", 120),
                            cmd.get("rows", 30),
                        )
                    elif cmd.get("type") == "ping":
                        await websocket.send_text('{"type":"pong"}')
                except (json.JSONDecodeError, KeyError):
                    await terminal.write(msg["text"].encode())

    except WebSocketDisconnect:
        logger.info("Terminal disconnected (tmux '%s' stays alive)", session_name)
    except Exception as e:
        logger.error("Terminal error: %s", e)
    finally:
        await terminal.detach()
