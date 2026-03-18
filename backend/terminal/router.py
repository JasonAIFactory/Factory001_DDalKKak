"""WebSocket-based PTY terminal for web browser access.

Spawns a real bash shell in the Docker container via subprocess.
Users can run `claude` (Claude Code CLI) with their own auth.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import struct

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()


class TerminalSession:
    """Manages a subprocess shell connected to a WebSocket."""

    def __init__(self, ws_id: str):
        self.ws_id = ws_id
        self.process: asyncio.subprocess.Process | None = None
        self._reader_task: asyncio.Task | None = None

    async def start(self, websocket: WebSocket) -> None:
        """Start a bash shell subprocess with pipes."""
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["SHELL"] = "/bin/bash"
        env["COLUMNS"] = "120"
        env["LINES"] = "30"

        self.process = await asyncio.create_subprocess_exec(
            "/bin/bash", "--login", "-i",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )

        self._reader_task = asyncio.create_task(self._read_loop(websocket))
        logger.info("Terminal started: ws=%s pid=%d", self.ws_id, self.process.pid)

    async def _read_loop(self, websocket: WebSocket) -> None:
        """Read subprocess stdout and send to WebSocket."""
        try:
            while True:
                if not self.process or not self.process.stdout:
                    break
                data = await self.process.stdout.read(4096)
                if not data:
                    break
                try:
                    await websocket.send_bytes(data)
                except Exception:
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Terminal read error: %s", e)

    async def write(self, data: bytes) -> None:
        """Write input to subprocess stdin."""
        if self.process and self.process.stdin:
            self.process.stdin.write(data)
            await self.process.stdin.drain()

    async def stop(self) -> None:
        """Kill the shell and cleanup."""
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass

        if self.process:
            try:
                self.process.kill()
                await self.process.wait()
            except (OSError, ProcessLookupError):
                pass

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

        # Send welcome message
        welcome = (
            "\x1b[1;35m=== DalkkakAI Web Terminal ===\x1b[0m\r\n"
            "\x1b[90mType 'claude' to start Claude Code with your account.\x1b[0m\r\n\r\n"
        )
        await websocket.send_bytes(welcome.encode())

        while True:
            msg = await websocket.receive()

            if "bytes" in msg and msg["bytes"]:
                await terminal.write(msg["bytes"])
            elif "text" in msg and msg["text"]:
                try:
                    cmd = json.loads(msg["text"])
                    if cmd.get("type") == "ping":
                        await websocket.send_text('{"type":"pong"}')
                except (json.JSONDecodeError, KeyError):
                    await terminal.write(msg["text"].encode())

    except WebSocketDisconnect:
        logger.info("Terminal disconnected: %s", ws_id)
    except Exception as e:
        logger.error("Terminal error: %s", e)
    finally:
        await terminal.stop()
