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
  const initialized = useRef(false);
  const [connected, setConnected] = useState(false);

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

      ws.onopen = () => {
        setConnected(true);
        term.focus();
        // Sync terminal size
        ws!.send(JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }));
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
      if (ws) ws.close();
      if (term) term.dispose();
      initialized.current = false;
    };
  }, []);

  return (
    <div className={`flex flex-col ${className}`} style={{ backgroundColor: "#1a1b26", height: "100%", minHeight: "500px" }}>
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
      />
    </div>
  );
}
