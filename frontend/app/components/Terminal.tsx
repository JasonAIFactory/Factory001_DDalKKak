"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Web terminal component using xterm.js.
 * Connects to backend PTY via WebSocket at /ws/terminal.
 * Users can run `claude` (Claude Code CLI) with their own auth.
 */
export default function Terminal({
  className = "",
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!termRef.current) return;

    // Dynamic imports — xterm is browser-only
    const { Terminal: XTerm } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const { WebLinksAddon } = await import("@xterm/addon-web-links");

    // Import xterm CSS
    await import("@xterm/xterm/css/xterm.css");

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#8b5cf6",
        selectionBackground: "#8b5cf633",
        black: "#09090b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#fafafa",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#a78bfa",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitRef.current = fitAddon;

    // Connect WebSocket to backend PTY
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || "localhost:8000";
    const ws = new WebSocket(`${wsProtocol}//${apiHost}/ws/terminal`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setConnected(true);
      // Send initial size
      ws.send(JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      term.write("\r\n\x1b[31m[Connection closed]\x1b[0m\r\n");
    };

    ws.onerror = () => {
      setConnected(false);
      term.write("\r\n\x1b[31m[Connection error]\x1b[0m\r\n");
    };

    wsRef.current = ws;

    // Forward keystrokes to backend
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [connect]);

  return (
    <div className={`flex flex-col bg-[#09090b] rounded-xl border border-[#1c1c22] overflow-hidden ${className}`}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f0f13] border-b border-[#1c1c22]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className={`w-3 h-3 rounded-full ${connected ? "bg-[#10b981]" : "bg-[#ef4444]"}`} />
            <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
            <div className="w-3 h-3 rounded-full bg-[#6b7280]" />
          </div>
          <span className="text-[#a1a1aa] text-xs font-mono ml-2">
            {connected ? "Terminal — Connected" : "Terminal — Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#52525b] text-[10px]">
            Type `claude` to start Claude Code
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#52525b] hover:text-[#fafafa] transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={termRef}
        className="flex-1 min-h-[300px]"
        style={{ padding: "4px" }}
      />
    </div>
  );
}
