"""WebSocket-based PTY terminal for web browser access.

Spawns a real bash shell in the Docker container.
Users can run `claude` (Claude Code CLI) with their own auth.
"""
from __future__ import annotations

import asyncio
import fcntl
import logging
import os
import pty
import select
import struct
import termios
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

# Active terminal sessions: websocket_id -> TerminalSession
_terminals: dict[str, "TerminalSession"] = {}


class TerminalSession:
    """Manages a PTY subprocess connected to a WebSocket."""

    def __init__(self, ws_id: str, cols: int = 120, rows: int = 30):
        self.ws_id = ws_id
        self.cols = cols
        self.rows = rows
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self._reader_task: Optional[asyncio.Task] = None

    async def start(self, websocket: WebSocket) -> None:
        """Fork a PTY and start reading output."""
        pid, fd = pty.openpty()
        self.master_fd = fd
        self.pid = pid

        # Set initial terminal size
        self._set_winsize(self.cols, self.rows)

        # Fork the actual shell process
        child_pid = os.fork()
        if child_pid == 0:
            # Child process: become the PTY slave
            os.close(fd)
            os.setsid()

            slave_fd = os.open(os.ttyname(pid), os.O_RDWR)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)

            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["SHELL"] = "/bin/bash"

            os.execvpe("/bin/bash", ["/bin/bash", "--login"], env)
        else:
            # Parent process: close slave side, keep master
            os.close(pid)
            self.pid = child_pid

            # Make master fd non-blocking
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            # Start reading from PTY
            self._reader_task = asyncio.create_task(
                self._read_loop(websocket)
            )
            logger.info(
                "Terminal started: ws=%s pid=%d", self.ws_id, child_pid
            )

    async def _read_loop(self, websocket: WebSocket) -> None:
        """Read PTY output and send to WebSocket."""
        loop = asyncio.get_event_loop()
        try:
            while True:
                await asyncio.sleep(0.01)
                try:
                    if self.master_fd is None:
                        break
                    r, _, _ = select.select([self.master_fd], [], [], 0)
                    if r:
                        data = os.read(self.master_fd, 4096)
                        if not data:
                            break
                        await websocket.send_bytes(data)
                except OSError:
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Terminal read error: %s", e)

    async def write(self, data: bytes) -> None:
        """Write input to PTY."""
        if self.master_fd is not None:
            os.write(self.master_fd, data)

    def resize(self, cols: int, rows: int) -> None:
        """Resize the PTY."""
        self.cols = cols
        self.rows = rows
        self._set_winsize(cols, rows)

    def _set_winsize(self, cols: int, rows: int) -> None:
        """Set PTY window size."""
        if self.master_fd is not None:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)

    async def stop(self) -> None:
        """Kill the shell and cleanup."""
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass

        if self.pid:
            try:
                os.kill(self.pid, 9)
                os.waitpid(self.pid, 0)
            except (OSError, ChildProcessError):
                pass

        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass

        logger.info("Terminal stopped: ws=%s", self.ws_id)


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """WebSocket endpoint for web terminal.

    Protocol:
    - Binary frames: raw terminal input (keystrokes)
    - Text frames: JSON commands (resize, ping)
      {"type": "resize", "cols": 120, "rows": 30}
    """
    await websocket.accept()
    ws_id = str(id(websocket))
    terminal = TerminalSession(ws_id)

    try:
        await terminal.start(websocket)
        _terminals[ws_id] = terminal

        while True:
            msg = await websocket.receive()

            if msg.get("bytes"):
                await terminal.write(msg["bytes"])
            elif msg.get("text"):
                import json
                try:
                    cmd = json.loads(msg["text"])
                    if cmd.get("type") == "resize":
                        terminal.resize(
                            cmd.get("cols", 120),
                            cmd.get("rows", 30)
                        )
                    elif cmd.get("type") == "ping":
                        await websocket.send_text('{"type":"pong"}')
                except json.JSONDecodeError:
                    # Treat as raw text input
                    await terminal.write(msg["text"].encode())

    except WebSocketDisconnect:
        logger.info("Terminal WebSocket disconnected: %s", ws_id)
    except Exception as e:
        logger.error("Terminal WebSocket error: %s", e)
    finally:
        await terminal.stop()
        _terminals.pop(ws_id, None)
