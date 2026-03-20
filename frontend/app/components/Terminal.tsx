"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web terminal — real PTY shell via WebSocket.
 * Identical to iTerm2 / native terminal experience.
 * Type `claude` to start Claude Code with your own account.
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

  useEffect(() => {
    console.log("[Terminal] mounting, ref:", !!termRef.current, "initialized:", initialized.current);
    if (!termRef.current || initialized.current) return;
    initialized.current = true;
    console.log("[Terminal] initializing xterm + websocket");

    let ws: WebSocket | null = null;
    let term: any = null;
    let fitAddon: any = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      await import("@xterm/xterm/css/xterm.css");

      if (!termRef.current) return;

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
        convertEol: false,
        windowsMode: false,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      term.open(termRef.current);
      xtermRef.current = term;

      // Small delay to ensure DOM is ready for fit
      requestAnimationFrame(() => {
        fitAddon.fit();
      });

      // WebSocket to backend PTY
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/terminal/${sessionId}`;
      console.log("[Terminal] connecting to:", wsUrl);
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        term.focus();
        // Sync terminal size
        ws!.send(JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }));
        // Keep-alive ping every 30s to prevent idle disconnect
        const pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        term.write("\r\n\x1b[31m[Disconnected]\x1b[0m\r\n");
      };

      ws.onerror = () => {
        setConnected(false);
      };

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
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(new TextEncoder().encode(text));
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
        if (ws && ws.readyState === WebSocket.OPEN) {
          const bytes = new TextEncoder().encode(data);
          ws.send(bytes);
        }
      });

      // Send binary sequences (Ctrl+C, arrow keys, etc.)
      term.onBinary((data: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const buffer = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) {
            buffer[i] = data.charCodeAt(i);
          }
          ws.send(buffer);
        }
      });

      // Resize handling
      const doResize = () => {
        if (!fitAddon || !term) return;
        fitAddon.fit();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }));
        }
      };

      resizeObserver = new ResizeObserver(doResize);
      if (termRef.current) {
        resizeObserver.observe(termRef.current);
      }
    })();

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      if (term) term.dispose();
      wsRef.current = null;
      initialized.current = false;
    };
  }, []);

  return (
    <div className={`flex flex-col ${className}`} style={{ backgroundColor: "#1a1b26", height: "100%", position: "absolute", inset: 0 }}>
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

      {/* Terminal body — fills all available space */}
      <div
        ref={termRef}
        className="flex-1 overflow-hidden"
        style={{ padding: "8px 4px 4px 8px" }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        onClick={() => ctxMenu && setCtxMenu(null)}
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
