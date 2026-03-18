"""WebSocket-based PTY terminal for web browser access.

Uses pty.openpty() + subprocess to create a real pseudo-terminal.
This gives proper line discipline, job control, and interactive support.
Users can run `claude` (Claude Code CLI) with their own auth.
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


class TerminalSession:
    """Manages a PTY subprocess connected to a WebSocket."""

    def __init__(self, ws_id: str):
        self.ws_id = ws_id
        self.master_fd: int | None = None
        self.child_pid: int | None = None
        self._reader_task: asyncio.Task | None = None

    async def start(self, websocket: WebSocket, cols: int = 120, rows: int = 30) -> None:
        """Spawn bash in a real PTY."""
        # Create PTY pair
        master_fd, slave_fd = pty.openpty()

        # Set terminal size on slave
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

        # Spawn bash with slave as its terminal
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["SHELL"] = "/bin/bash"
        env["HOME"] = "/root"

        child_pid = subprocess.Popen(
            ["/bin/bash", "--login"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            env=env,
            cwd="/workspace",
        ).pid

        # Parent keeps master, close slave
        os.close(slave_fd)

        self.master_fd = master_fd
        self.child_pid = child_pid

        # Make master non-blocking for async reads
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        self._reader_task = asyncio.create_task(self._read_loop(websocket))
        logger.info("Terminal started: ws=%s pid=%d", self.ws_id, child_pid)

    async def _read_loop(self, websocket: WebSocket) -> None:
        """Read PTY output and send to WebSocket."""
        loop = asyncio.get_event_loop()
        try:
            while True:
                # Use loop.run_in_executor to avoid blocking
                try:
                    data = await loop.run_in_executor(
                        None, self._blocking_read
                    )
                    if data:
                        await websocket.send_bytes(data)
                    else:
                        # Small sleep to prevent busy-loop when no data
                        await asyncio.sleep(0.02)
                except OSError:
                    break
                except Exception as e:
                    if "disconnect" in str(e).lower():
                        break
                    await asyncio.sleep(0.02)
        except asyncio.CancelledError:
            pass

    def _blocking_read(self) -> bytes | None:
        """Read from master fd (called in executor thread)."""
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
        """Write input to PTY master."""
        if self.master_fd is not None:
            try:
                os.write(self.master_fd, data)
            except OSError as e:
                logger.error("Write error: %s", e)

    def resize(self, cols: int, rows: int) -> None:
        """Resize the PTY."""
        if self.master_fd is not None:
            try:
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except OSError:
                pass

    async def stop(self) -> None:
        """Kill the shell and cleanup."""
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass

        if self.child_pid:
            try:
                os.killpg(os.getpgid(self.child_pid), signal.SIGTERM)
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

        logger.info("Terminal stopped: ws=%s", self.ws_id)


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """WebSocket endpoint for web terminal.

    Protocol:
    - Binary frames: raw terminal input (keystrokes)
    - Text frames: JSON commands (resize, ping)
    """
    await websocket.accept()
    ws_id = str(id(websocket))
    terminal = TerminalSession(ws_id)

    try:
        await terminal.start(websocket)

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
                    # Raw text input
                    await terminal.write(msg["text"].encode())

    except WebSocketDisconnect:
        logger.info("Terminal disconnected: %s", ws_id)
    except Exception as e:
        logger.error("Terminal error: %s", e)
    finally:
        await terminal.stop()
