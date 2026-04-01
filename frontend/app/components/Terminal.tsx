"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web terminal — real PTY shell via WebSocket.
 * Identical to iTerm2 / native terminal experience.
 * Type `claude` to start Claude Code with your own account.
 *
 * Features: ping/pong heartbeat, auto-reconnect on disconnect,
 * mouse wheel scroll (scrollback=10000), flex-based full-height layout.
 */
export default function Terminal({
  className = "",
  sessionId = "main",
  onClose,
}: {
  className?: string;
  sessionId?: string;
  onClose?: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);
  const initialized = useRef(false);
  const [connected, setConnected] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  /** Track reconnect state across the async closure. */
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectWsRef = useRef<(() => void) | null>(null);
  const unmountedRef = useRef(false);
  const MAX_RECONNECT_RETRIES = 5;
  const RECONNECT_INTERVAL_MS = 3000;

  useEffect(() => {
    console.log("[Terminal] mounting, ref:", !!termRef.current, "initialized:", initialized.current);
    if (!termRef.current || initialized.current) return;
    initialized.current = true;
    unmountedRef.current = false;
    console.log("[Terminal] initializing xterm + websocket");

    let term: any = null;
    let fitAddon: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    /** Build WebSocket URL from env. */
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/terminal/${sessionId}`;

    /**
     * Connect (or reconnect) the WebSocket to the backend PTY.
     * Reuses the existing xterm instance — only the WS is replaced.
     */
    const connectWs = () => {
      if (unmountedRef.current) return;

      console.log("[Terminal] connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectCountRef.current = 0; // reset on success
        if (term) term.focus();
        // Sync terminal size
        ws.send(JSON.stringify({
          type: "resize",
          cols: term?.cols ?? 120,
          rows: term?.rows ?? 30,
        }));
        // Keep-alive ping every 25s to prevent idle disconnect
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          } else {
            if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
          }
        }, 25000);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!term) return;
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else {
          // Ignore pong heartbeat responses — they just keep the connection alive
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "pong") return;
          } catch {
            // Not JSON — normal terminal output, write it
          }
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }

        if (unmountedRef.current) return;

        // Auto-reconnect logic
        if (reconnectCountRef.current < MAX_RECONNECT_RETRIES) {
          reconnectCountRef.current += 1;
          if (term) {
            term.write(
              `\r\n\x1b[33m[Reconnecting... attempt ${reconnectCountRef.current}/${MAX_RECONNECT_RETRIES}]\x1b[0m\r\n`
            );
          }
          reconnectTimerRef.current = setTimeout(connectWs, RECONNECT_INTERVAL_MS);
        } else {
          if (term) {
            term.write(
              "\r\n\x1b[31m[Connection failed. Click terminal to reconnect]\x1b[0m\r\n"
            );
          }
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror — reconnect handled there
        setConnected(false);
      };
    };
    connectWsRef.current = connectWs;

    (async () => {
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      // @ts-expect-error — CSS import works at runtime but TS can't resolve it
      await import("@xterm/xterm/css/xterm.css");

      if (!termRef.current || unmountedRef.current) return;

      term = new XTerm({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
        fontWeight: "normal",
        letterSpacing: 0,
        lineHeight: 1.2,
        scrollback: 10000,
        theme: {
          background: "#1a1b26",
          foreground: "#c0caf5",
          cursor: "#c0caf5",
          cursorAccent: "#1a1b26",
          selectionBackground: "#33467c",
          selectionForeground: "#c0caf5",
          black: "#15161e",
          red: "#f7768e",
          green: "#9ece6a",
          yellow: "#e0af68",
          blue: "#7aa2f7",
          magenta: "#bb9af7",
          cyan: "#7dcfff",
          white: "#a9b1d6",
          brightBlack: "#414868",
          brightRed: "#f7768e",
          brightGreen: "#9ece6a",
          brightYellow: "#e0af68",
          brightBlue: "#7aa2f7",
          brightMagenta: "#bb9af7",
          brightCyan: "#7dcfff",
          brightWhite: "#c0caf5",
        },
        allowProposedApi: true,
        convertEol: true,
        scrollOnUserInput: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      term.open(termRef.current);
      xtermRef.current = term;

      // Multiple fit attempts — DOM may not be laid out yet on first frame
      const doFit = () => { try { fitAddon.fit(); } catch {} };
      requestAnimationFrame(doFit);
      setTimeout(doFit, 100);
      setTimeout(doFit, 300);
      setTimeout(doFit, 600);

      // Initial WebSocket connection
      connectWs();

      // Copy on select (Ctrl+C copies when text selected, sends SIGINT otherwise)
      term.onSelectionChange(() => {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {});
        }
      });

      // Paste support (Ctrl+V)
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.type === "keydown" && e.ctrlKey && e.key === "v") {
          navigator.clipboard.readText().then((text) => {
            const currentWs = wsRef.current;
            if (currentWs && currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(new TextEncoder().encode(text));
            }
          }).catch(() => {});
          return false;
        }
        // Ctrl+C with selection = copy (don't send to PTY)
        if (e.type === "keydown" && e.ctrlKey && e.key === "c" && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          term.clearSelection();
          return false;
        }
        return true;
      });

      // Send keystrokes as binary
      term.onData((data: string) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          const bytes = new TextEncoder().encode(data);
          currentWs.send(bytes);
        }
      });

      // Send binary sequences (Ctrl+C, arrow keys, etc.)
      term.onBinary((data: string) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          const buffer = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) {
            buffer[i] = data.charCodeAt(i);
          }
          currentWs.send(buffer);
        }
      });

      // Resize handling — debounced to avoid excessive fit() calls
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const doResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!fitAddon || !term) return;
          try { fitAddon.fit(); } catch {}
          const currentWs = wsRef.current;
          if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            }));
          }
        }, 50);
      };

      resizeObserver = new ResizeObserver(doResize);
      if (termRef.current) {
        resizeObserver.observe(termRef.current);
      }
    })();

    return () => {
      unmountedRef.current = true;
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (resizeObserver) resizeObserver.disconnect();
      const currentWs = wsRef.current;
      if (currentWs && currentWs.readyState === WebSocket.OPEN) currentWs.close();
      if (term) term.dispose();
      wsRef.current = null;
      initialized.current = false;
    };
  }, []);

  return (
    <div className={`flex flex-col ${className}`} style={{ backgroundColor: "#1a1b26", height: "100%", minHeight: 0 }}>
      {/* macOS-style title bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5"
        style={{ backgroundColor: "#16161e", borderBottom: "1px solid #292e42" }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all"
              title="Close"
            />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-mono ml-3" style={{ color: "#565f89" }}>
            {connected ? "bash — /workspace" : "connecting..."}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: "#414868" }}>
          {connected ? "●" : "○"} {connected ? "PTY" : ""}
        </span>
      </div>

      {/* Terminal body — fills all remaining space via flex.
          minHeight:0 is critical so flex-1 can shrink below content height.
          No overflow:hidden — xterm.js manages its own viewport scrolling. */}
      <div
        ref={termRef}
        className="flex-1"
        style={{ padding: "8px 4px 4px 8px", minHeight: 0 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        onClick={() => {
          if (ctxMenu) { setCtxMenu(null); return; }
          // Click-to-reconnect after max retries exhausted
          if (!connected && reconnectCountRef.current >= MAX_RECONNECT_RETRIES) {
            reconnectCountRef.current = 0;
            if (xtermRef.current) {
              xtermRef.current.write("\r\n\x1b[33m[Reconnecting...]\x1b[0m\r\n");
            }
            if (connectWsRef.current) connectWsRef.current();
          }
        }}
      />

      {/* Custom context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 rounded-lg py-1 shadow-xl"
            style={{
              left: ctxMenu.x,
              top: ctxMenu.y,
              backgroundColor: "#1e1e2e",
              border: "1px solid #313244",
              minWidth: "160px",
            }}
          >
            <CtxBtn
              label="Copy"
              shortcut="Ctrl+C"
              onClick={() => {
                const sel = xtermRef.current?.getSelection();
                if (sel) navigator.clipboard.writeText(sel);
                setCtxMenu(null);
              }}
            />
            <CtxBtn
              label="Paste"
              shortcut="Ctrl+V"
              onClick={() => {
                navigator.clipboard.readText().then((text) => {
                  if (text && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(new TextEncoder().encode(text));
                  }
                });
                setCtxMenu(null);
              }}
            />
            <div className="my-1" style={{ borderTop: "1px solid #313244" }} />
            <CtxBtn
              label="Select All"
              shortcut=""
              onClick={() => {
                xtermRef.current?.selectAll();
                setCtxMenu(null);
              }}
            />
            <CtxBtn
              label="Clear Terminal"
              shortcut=""
              onClick={() => {
                xtermRef.current?.clear();
                setCtxMenu(null);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CtxBtn({ label, shortcut, onClick }: { label: string; shortcut: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors"
      style={{ color: "#cdd6f4" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#313244")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <span>{label}</span>
      {shortcut && <span style={{ color: "#6c7086", fontSize: "11px" }}>{shortcut}</span>}
    </button>
  );
}
