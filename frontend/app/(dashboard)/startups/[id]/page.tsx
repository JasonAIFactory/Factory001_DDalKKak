"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  startups, sessions, getToken,
  type Startup, type Session,
} from "@/lib/api";
import {
  Plus, Loader2, CheckCircle, XCircle, Clock, Play, Pause,
  GitMerge, Trash2, ChevronLeft, Zap, AlertCircle, TerminalSquare,
  Eye, FileCode, ChevronRight, X, Send, RefreshCw, Settings2,
  Activity, GitBranch, DollarSign, Timer, Cpu, CheckSquare,
} from "lucide-react";

const Terminal = dynamic(() => import("../../../components/Terminal"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

// ── Design tokens from UI_GUIDE.md ──────────────────────────────────────────
const C = {
  bgPrimary: "#09090b", bgSecondary: "#0f0f13", bgTertiary: "#1c1c22",
  textPrimary: "#fafafa", textSecondary: "#a1a1aa", textMuted: "#52525b",
  accentPurple: "#8b5cf6", accentCyan: "#06b6d4",
  green: "#10b981", yellow: "#f59e0b", red: "#ef4444", gray: "#6b7280",
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  queued:    { color: C.gray,   bg: "rgba(107,114,128,0.15)", border: C.gray,   label: "Queued" },
  running:   { color: C.yellow, bg: "rgba(245,158,11,0.15)",  border: C.yellow, label: "Running" },
  paused:    { color: C.yellow, bg: "rgba(245,158,11,0.10)",  border: C.yellow, label: "Paused" },
  review:    { color: C.accentCyan, bg: "rgba(6,182,212,0.15)", border: C.accentCyan, label: "Ready" },
  completed: { color: C.green,  bg: "rgba(16,185,129,0.15)",  border: C.green,  label: "Approved" },
  error:     { color: C.red,    bg: "rgba(239,68,68,0.15)",    border: C.red,    label: "Error" },
  cancelled: { color: C.gray,   bg: "rgba(107,114,128,0.10)", border: C.gray,   label: "Cancelled" },
  merged:    { color: C.green,  bg: "rgba(16,185,129,0.15)",  border: C.green,  label: "Merged" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.queued;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running")   return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.yellow }} />;
  if (status === "completed" || status === "merged") return <CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} />;
  if (status === "error")     return <XCircle className="w-3.5 h-3.5" style={{ color: C.red }} />;
  if (status === "review")    return <Eye className="w-3.5 h-3.5" style={{ color: C.accentCyan }} />;
  if (status === "paused")    return <Pause className="w-3.5 h-3.5" style={{ color: C.yellow }} />;
  return <Clock className="w-3.5 h-3.5" style={{ color: C.gray }} />;
}

// ── Status Pipeline ─────────────────────────────────────────────────────────
function StatusPipeline({ sessions: ss }: { sessions: Session[] }) {
  const counts = {
    running: ss.filter(s => ["queued","running","paused"].includes(s.status)).length,
    ready:   ss.filter(s => s.status === "review").length,
    approved:ss.filter(s => ["completed","merged"].includes(s.status)).length,
    blocked: ss.filter(s => s.status === "error").length,
  };
  const nodes = [
    { label: "Running", count: counts.running, color: C.yellow },
    { label: "Ready",   count: counts.ready,   color: C.accentCyan },
    { label: "Approved",count: counts.approved, color: C.green },
    { label: "Blocked", count: counts.blocked,  color: C.red },
  ];
  return (
    <div className="flex items-center gap-1 px-6 py-3" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-1">
          {i > 0 && <div className="w-8 h-px mx-1" style={{ backgroundColor: n.count > 0 ? C.bgTertiary : C.bgTertiary, opacity: n.count > 0 ? 1 : 0.3 }} />}
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.count > 0 ? n.color : C.bgTertiary }} />
          <span className="text-xs font-medium" style={{ color: n.count > 0 ? n.color : C.textMuted }}>
            {n.count} {n.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Session Card (UI_GUIDE.md spec) ─────────────────────────────────────────
function SessionCard({
  session, startupId, isSelected, onSelect, onAction, onOpen,
}: {
  session: Session; startupId: string; isSelected: boolean;
  onSelect: () => void; onAction: () => void; onOpen: () => void;
}) {
  const [acting, setActing] = useState(false);
  const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.queued;

  async function doAction(path: string) {
    setActing(true);
    try {
      await fetch(`${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      onAction();
    } finally { setActing(false); }
  }

  const progress = session.progress ?? 0;
  const cost = Number(session.total_cost ?? 0);
  const filesCount = Array.isArray(session.files_changed) ? session.files_changed.length : 0;
  const isTerminal = session.agent_type === "terminal";

  return (
    <div
      onClick={onOpen}
      className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:brightness-110"
      style={{
        backgroundColor: C.bgSecondary,
        border: `1px solid ${isSelected ? C.accentPurple : C.bgTertiary}`,
        boxShadow: isSelected ? `0 0 0 1px ${C.accentPurple}33` : "none",
      }}
    >
      {/* Header: title + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={session.status} />
          <span className="text-sm font-medium truncate" style={{ color: C.textPrimary }}>{session.title}</span>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Mode badge + module */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{
          backgroundColor: isTerminal ? "rgba(6,182,212,0.15)" : "rgba(139,92,246,0.15)",
          color: isTerminal ? C.accentCyan : C.accentPurple,
        }}>
          {isTerminal ? "Terminal" : "Auto AI"}
        </span>
        {session.branch_name && (
          <span className="text-[10px] font-mono truncate" style={{ color: C.textMuted }}>
            {session.branch_name}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {["running", "queued"].includes(session.status) && (
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: C.bgTertiary }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: progress < 50 ? C.yellow : progress < 100 ? C.accentPurple : C.green,
            }}
          />
        </div>
      )}

      {/* Metrics row */}
      <div className="flex items-center gap-3 text-[11px]" style={{ color: C.textMuted }}>
        {filesCount > 0 && <span>{filesCount} files</span>}
        {cost > 0 && <span>${cost.toFixed(3)}</span>}
        {session.model_calls > 0 && <span>{session.model_calls} calls</span>}
      </div>

      {/* Latest action / error */}
      {session.error_message && session.status === "error" && (
        <p className="text-[11px] truncate" style={{ color: C.red }}>{session.error_message}</p>
      )}
      {session.summary && session.status === "completed" && (
        <p className="text-[11px] truncate" style={{ color: C.textSecondary }}>{session.summary}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        {session.status === "queued" && (
          <Btn icon={<Play className="w-3 h-3" />} label="Start" color={C.green} onClick={() => doAction("resume")} disabled={acting} />
        )}
        {session.status === "running" && (
          <Btn icon={<Pause className="w-3 h-3" />} label="Pause" color={C.yellow} onClick={() => doAction("pause")} disabled={acting} />
        )}
        {session.status === "review" && (
          <Btn icon={<CheckCircle className="w-3 h-3" />} label="Approve" color={C.green} onClick={() => doAction("approve")} disabled={acting} />
        )}
        {session.status === "error" && (
          <Btn icon={<RefreshCw className="w-3 h-3" />} label="Retry" color={C.yellow} onClick={() => doAction("retry")} disabled={acting} />
        )}
        {session.status === "completed" && (
          <Btn icon={<GitMerge className="w-3 h-3" />} label="Merge" color={C.accentPurple} onClick={() => doAction("merge")} disabled={acting} />
        )}
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ml-auto"
          style={{ color: C.textMuted }}
        >
          Open <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function Btn({ icon, label, color, onClick, disabled }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all disabled:opacity-40"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {icon} {label}
    </button>
  );
}

// ── Session Detail Page (Screen 2) ──────────────────────────────────────────
type DetailTab = "chat" | "terminal" | "files" | "tests" | "logs" | "errors";

function SessionDetail({
  session, startupId, onBack, onAction,
}: {
  session: Session; startupId: string; onBack: () => void; onAction: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>(session.agent_type === "terminal" ? "terminal" : "chat");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [acting, setActing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/${session.id}/messages?startup_id=${startupId}&limit=50`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(json => { if (json.ok) setMessages(json.data ?? []); })
      .catch(() => {});
  }, [session.id, session.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function doAction(path: string) {
    setActing(true);
    try {
      await fetch(`${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      onAction();
    } finally { setActing(false); }
  }

  async function sendChat() {
    if (!feedback.trim()) return;
    setSending(true);
    await fetch(`${API_BASE}/api/sessions/${session.id}/chat?startup_id=${startupId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: feedback }),
    });
    setMessages(prev => [...prev, { role: "user", content: feedback, created_at: new Date().toISOString() }]);
    setFeedback("");
    setSending(false);
  }

  const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.queued;
  const progress = session.progress ?? 0;
  const cost = Number(session.total_cost ?? 0);
  const filesCount = Array.isArray(session.files_changed) ? session.files_changed.length : 0;
  const isTerminal = session.agent_type === "terminal";

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    ...(isTerminal ? [{ id: "terminal" as DetailTab, label: "Terminal", icon: <TerminalSquare className="w-3.5 h-3.5" /> }] : []),
    { id: "chat", label: "Chat", icon: <Send className="w-3.5 h-3.5" /> },
    { id: "files", label: "Files", icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: "tests", label: "Tests", icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: "logs", label: "Logs", icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "errors", label: "Errors", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: C.bgPrimary }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.bgTertiary}` }}>
        <button onClick={onBack} className="hover:brightness-150 transition-all" style={{ color: C.textMuted }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate" style={{ color: C.textPrimary }}>{session.title}</h2>
            <StatusBadge status={session.status} />
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{
              backgroundColor: isTerminal ? "rgba(6,182,212,0.15)" : "rgba(139,92,246,0.15)",
              color: isTerminal ? C.accentCyan : C.accentPurple,
            }}>
              {isTerminal ? "Terminal Mode" : "Auto AI"}
            </span>
          </div>
          {session.branch_name && (
            <div className="flex items-center gap-1 mt-0.5">
              <GitBranch className="w-3 h-3" style={{ color: C.textMuted }} />
              <span className="text-xs font-mono" style={{ color: C.textMuted }}>{session.branch_name}</span>
            </div>
          )}
        </div>
        {/* Header actions by status */}
        <div className="flex gap-2">
          {session.status === "running" && (
            <>
              <Btn icon={<Pause className="w-3 h-3" />} label="Pause" color={C.yellow} onClick={() => doAction("pause")} disabled={acting} />
              <Btn icon={<X className="w-3 h-3" />} label="Cancel" color={C.red} onClick={() => doAction("cancel")} disabled={acting} />
            </>
          )}
          {session.status === "paused" && (
            <Btn icon={<Play className="w-3 h-3" />} label="Resume" color={C.green} onClick={() => doAction("resume")} disabled={acting} />
          )}
          {session.status === "review" && (
            <>
              <Btn icon={<CheckCircle className="w-3 h-3" />} label="Approve" color={C.green} onClick={() => doAction("approve")} disabled={acting} />
              <Btn icon={<RefreshCw className="w-3 h-3" />} label="Request Changes" color={C.yellow} onClick={() => doAction("retry")} disabled={acting} />
            </>
          )}
          {session.status === "error" && (
            <Btn icon={<RefreshCw className="w-3 h-3" />} label="Retry" color={C.yellow} onClick={() => doAction("retry")} disabled={acting} />
          )}
          {session.status === "completed" && (
            <Btn icon={<GitMerge className="w-3 h-3" />} label="Merge & Deploy" color={C.accentPurple} onClick={() => doAction("merge")} disabled={acting} />
          )}
        </div>
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-6 px-6 py-3" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
        <Metric label="Progress" value={`${progress}%`} color={progress < 50 ? C.yellow : progress < 100 ? C.accentPurple : C.green} />
        <Metric label="Files" value={`${filesCount}`} color={C.textSecondary} />
        <Metric label="API Calls" value={`${session.model_calls}`} color={C.textSecondary} />
        <Metric label="Cost" value={`$${cost.toFixed(3)}`} color={cost > 1 ? C.yellow : C.textSecondary} />
        {session.preview_url && (
          <a href={session.preview_url} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs font-mono hover:brightness-125 transition-all"
            style={{ color: C.accentCyan }}>
            <Eye className="w-3 h-3" /> {session.preview_url}
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: tab === t.id ? C.accentPurple : C.textMuted,
              borderBottom: tab === t.id ? `2px solid ${C.accentPurple}` : "2px solid transparent",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        {tab === "terminal" && (
          <Terminal className="h-full rounded-none border-0" sessionId={session.id} />
        )}

        {tab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-6 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm italic" style={{ color: C.textMuted }}>No messages yet.</p>
              ) : messages.map((m, i) => (
                <div key={i} className={`max-w-[80%] ${m.role === "user" ? "ml-auto" : "mr-auto"}`}>
                  <div className="rounded-xl px-4 py-2.5 text-sm" style={{
                    backgroundColor: m.role === "user" ? `${C.accentPurple}22` : C.bgSecondary,
                    color: C.textPrimary,
                    border: `1px solid ${m.role === "user" ? `${C.accentPurple}33` : C.bgTertiary}`,
                  }}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  <p className="text-[10px] mt-1 px-1" style={{ color: C.textMuted }}>
                    {m.role === "user" ? "You" : "Agent"} · {new Date(m.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {/* Chat input */}
            <div className="p-4" style={{ borderTop: `1px solid ${C.bgTertiary}` }}>
              <div className="flex gap-2">
                <input
                  type="text" value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder={
                    session.status === "running" ? "Tell the agent what to do..." :
                    session.status === "error" ? "Describe what you expected..." :
                    "Request specific changes..."
                  }
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: C.bgSecondary, color: C.textPrimary,
                    border: `1px solid ${C.bgTertiary}`,
                  }}
                />
                <button
                  onClick={sendChat} disabled={sending || !feedback.trim()}
                  className="px-4 py-2.5 rounded-lg transition-all disabled:opacity-30"
                  style={{ backgroundColor: C.accentPurple, color: C.textPrimary }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "files" && (
          <FilesViewer session={session} startupId={startupId} />
        )}

        {tab === "tests" && (
          <div className="p-6">
            <p className="text-sm italic" style={{ color: C.textMuted }}>Test results will appear here when tests run.</p>
          </div>
        )}

        {tab === "logs" && (
          <div className="p-6 font-mono text-xs space-y-1" style={{ color: C.textMuted }}>
            <p>Session created at {new Date(session.created_at).toLocaleString()}</p>
            {session.status === "running" && <p style={{ color: C.yellow }}>Agent is working...</p>}
            {session.error_message && <p style={{ color: C.red }}>[ERROR] {session.error_message}</p>}
            {session.summary && <p style={{ color: C.green }}>[DONE] {session.summary}</p>}
          </div>
        )}

        {tab === "errors" && (
          <div className="p-6">
            {session.error_message ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: `${C.red}11`, border: `1px solid ${C.red}33` }}>
                <p className="text-sm font-medium mb-2" style={{ color: C.red }}>Error</p>
                <p className="text-sm font-mono leading-relaxed" style={{ color: C.textSecondary }}>{session.error_message}</p>
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: C.textMuted }}>No errors.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Files Viewer (split: file list + code content) ──────────────────────────
function FilesViewer({ session, startupId }: { session: Session; startupId: string }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const files = Array.isArray(session.files_changed) ? session.files_changed : [];

  async function loadFile(path: string) {
    setSelectedFile(path);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/sessions/${session.id}/files/${encodeURIComponent(path)}?startup_id=${startupId}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const json = await res.json();
      if (json.ok) {
        setFileContent(json.data.content);
      } else {
        setError(json.error || "Failed to load file");
        setFileContent("");
      }
    } catch {
      setError("Network error");
      setFileContent("");
    } finally {
      setLoading(false);
    }
  }

  if (files.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm italic" style={{ color: C.textMuted }}>No files changed yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: file list */}
      <div className="w-64 flex-shrink-0 overflow-auto" style={{ borderRight: `1px solid ${C.bgTertiary}` }}>
        <div className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
            {files.length} files changed
          </p>
          {files.map((f: string) => (
            <button
              key={f}
              onClick={() => loadFile(f)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all mb-1"
              style={{
                backgroundColor: selectedFile === f ? `${C.accentPurple}15` : "transparent",
                color: selectedFile === f ? C.accentPurple : C.textSecondary,
                border: selectedFile === f ? `1px solid ${C.accentPurple}33` : "1px solid transparent",
              }}
            >
              <FileCode className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: code viewer */}
      <div className="flex-1 overflow-auto">
        {!selectedFile ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: C.textMuted }}>Select a file to view its content</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.accentPurple }} />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-lg p-4" style={{ backgroundColor: `${C.red}11`, border: `1px solid ${C.red}33` }}>
              <p className="text-sm" style={{ color: C.red }}>{error}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* File header */}
            <div className="sticky top-0 px-4 py-2 flex items-center gap-2" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
              <FileCode className="w-3.5 h-3.5" style={{ color: C.accentPurple }} />
              <span className="text-xs font-mono" style={{ color: C.textSecondary }}>{selectedFile}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: `${C.green}22`, color: C.green }}>
                {fileContent.split("\n").length} lines
              </span>
            </div>
            {/* Code content with line numbers */}
            <pre className="p-4 text-[13px] leading-6 overflow-x-auto" style={{ color: C.textSecondary, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
              {fileContent.split("\n").map((line, i) => (
                <div key={i} className="flex hover:brightness-125 transition-all">
                  <span className="w-10 text-right pr-4 select-none flex-shrink-0" style={{ color: C.textMuted }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-pre">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-base font-semibold" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>{label}</p>
    </div>
  );
}

// ── Create Session Modal ────────────────────────────────────────────────────
function CreateSessionModal({
  startupId, onClose, onCreated,
}: {
  startupId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [agentType, setAgentType] = useState("feature");
  const [mode, setMode] = useState<"auto" | "terminal">("auto");
  const [creating, setCreating] = useState(false);

  const templates = [
    { label: "Auth", title: "Auth Module", desc: "JWT auth with register, login, refresh, password reset", type: "feature" },
    { label: "CRUD API", title: "CRUD Endpoints", desc: "REST CRUD endpoints with validation and error handling", type: "feature" },
    { label: "Page", title: "Frontend Page", desc: "Create a new page with components and data fetching", type: "feature" },
    { label: "Tests", title: "Write Tests", desc: "Write comprehensive tests with success and error cases", type: "feature" },
    { label: "Fix bug", title: "Bug Fix", desc: "Fix the following issue: ", type: "fix" },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const result = await sessions.create(startupId, title, desc, mode === "terminal" ? "terminal" : agentType);
    if (result.ok) {
      onCreated();
      onClose();
    }
    setCreating(false);
  }

  function applyTemplate(t: typeof templates[0]) {
    setTitle(t.title);
    setDesc(t.desc);
    setAgentType(t.type);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: C.bgSecondary, border: `1px solid ${C.bgTertiary}` }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold" style={{ color: C.textPrimary }}>New Session</h3>
          <button onClick={onClose} style={{ color: C.textMuted }}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Mode selection */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: C.textMuted }}>Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMode("auto")}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  backgroundColor: mode === "auto" ? `${C.accentPurple}15` : C.bgPrimary,
                  border: `2px solid ${mode === "auto" ? C.accentPurple : C.bgTertiary}`,
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4" style={{ color: C.accentPurple }} />
                  <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>Auto AI</span>
                </div>
                <p className="text-[11px]" style={{ color: C.textMuted }}>AI builds autonomously. Uses API tokens.</p>
              </button>
              <button type="button" onClick={() => setMode("terminal")}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  backgroundColor: mode === "terminal" ? `${C.accentCyan}15` : C.bgPrimary,
                  border: `2px solid ${mode === "terminal" ? C.accentCyan : C.bgTertiary}`,
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <TerminalSquare className="w-4 h-4" style={{ color: C.accentCyan }} />
                  <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>Terminal</span>
                </div>
                <p className="text-[11px]" style={{ color: C.textMuted }}>Run Claude Code with your account. $0 cost.</p>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: C.textMuted }}>
              What should this session build?
            </label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Add user authentication with JWT..."
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
              style={{ backgroundColor: C.bgPrimary, color: C.textPrimary, border: `1px solid ${C.bgTertiary}` }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: C.textMuted }}>
              Description
            </label>
            <textarea required minLength={10} rows={3} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Detailed description of what needs to be built..."
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors resize-none"
              style={{ backgroundColor: C.bgPrimary, color: C.textPrimary, border: `1px solid ${C.bgTertiary}` }}
            />
          </div>

          {/* Agent type (only for auto mode) */}
          {mode === "auto" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: C.textMuted }}>Agent type</label>
              <select value={agentType} onChange={e => setAgentType(e.target.value)}
                className="rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: C.bgPrimary, color: C.textPrimary, border: `1px solid ${C.bgTertiary}` }}>
                <option value="feature">Feature</option>
                <option value="fix">Fix</option>
                <option value="build">Full Build</option>
              </select>
            </div>
          )}

          {/* Templates */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: C.textMuted }}>Templates</label>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button key={t.label} type="button" onClick={() => applyTemplate(t)}
                  className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
                  style={{ backgroundColor: C.bgPrimary, color: C.textSecondary, border: `1px solid ${C.bgTertiary}` }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm transition-colors"
              style={{ color: C.textMuted }}>
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ backgroundColor: mode === "terminal" ? C.accentCyan : C.accentPurple, color: C.textPrimary }}>
              <Zap className="w-4 h-4" />
              {creating ? "Creating..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function StartupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [startup, setStartup] = useState<Startup | null>(null);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "ready" | "approved">("all");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const load = useCallback(async () => {
    const [startupRes, sessionsRes] = await Promise.all([
      startups.get(id), sessions.list(id),
    ]);
    if (startupRes.ok) setStartup(startupRes.data);
    if (sessionsRes.ok) {
      const items = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      setMySessions(items);
      if (detailSession) {
        const updated = items.find((s: Session) => s.id === detailSession.id);
        if (updated) setDetailSession(updated);
      }
    }
    setLoading(false);
  }, [id, detailSession]);

  useEffect(() => { load(); }, [id]);

  // WebSocket
  useEffect(() => {
    if (!getToken() || !id) return;
    const ws = new WebSocket(`${WS_BASE}/ws/sessions/${id}`);
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");
    ws.onmessage = () => load();
    return () => ws.close();
  }, [id]);

  // Auto-poll
  useEffect(() => {
    const hasActive = mySessions.some(s => ["queued", "running"].includes(s.status));
    if (!hasActive) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [mySessions]);

  // If viewing session detail
  if (detailSession) {
    return (
      <SessionDetail
        session={detailSession} startupId={id}
        onBack={() => setDetailSession(null)}
        onAction={load}
      />
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.accentPurple }} /></div>;
  }
  if (!startup) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-8 h-8" style={{ color: C.red }} />
        <p style={{ color: C.textSecondary }}>Startup not found.</p>
        <button onClick={() => router.back()} style={{ color: C.accentPurple }} className="text-sm">Go back</button>
      </div>
    );
  }

  // Filter sessions
  const counts = {
    running: mySessions.filter(s => ["queued","running","paused"].includes(s.status)).length,
    ready:   mySessions.filter(s => s.status === "review").length,
    approved:mySessions.filter(s => ["completed","merged"].includes(s.status)).length,
  };

  const filtered = filter === "all" ? mySessions :
    filter === "running" ? mySessions.filter(s => ["queued","running","paused"].includes(s.status)) :
    filter === "ready" ? mySessions.filter(s => s.status === "review") :
    mySessions.filter(s => ["completed","merged"].includes(s.status));

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: C.bgPrimary }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} style={{ color: C.textMuted }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Zap className="w-5 h-5" style={{ color: C.accentPurple }} />
          <span className="font-bold text-lg" style={{ color: C.textPrimary }}>{startup.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${C.accentPurple}22`, color: C.accentPurple }}>
            Preview Environment
          </span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wsStatus === "connected" ? C.green : C.gray }} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: C.accentPurple, color: C.textPrimary }}>
            <Plus className="w-4 h-4" /> Create Session
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: `${C.green}22`, color: C.green }}>
            <GitMerge className="w-4 h-4" /> Merge & Deploy
          </button>
        </div>
      </div>

      {/* Status pipeline */}
      <StatusPipeline sessions={mySessions} />

      {/* Filter tabs */}
      <div className="flex gap-0 px-6" style={{ borderBottom: `1px solid ${C.bgTertiary}` }}>
        {[
          { id: "all" as const, label: "All", count: mySessions.length },
          { id: "running" as const, label: `Running (${counts.running})`, count: counts.running },
          { id: "ready" as const, label: `Ready (${counts.ready})`, count: counts.ready },
          { id: "approved" as const, label: `Approved (${counts.approved})`, count: counts.approved },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: filter === t.id ? C.accentPurple : C.textMuted,
              borderBottom: filter === t.id ? `2px solid ${C.accentPurple}` : "2px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Session grid */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={{ border: `1px dashed ${C.bgTertiary}` }}>
            <Zap className="w-10 h-10 mb-4" style={{ color: C.textMuted }} />
            <h3 className="font-medium mb-2" style={{ color: C.textPrimary }}>No sessions yet</h3>
            <p className="text-sm mb-6" style={{ color: C.textMuted }}>Create a session to start building.</p>
            <button onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: C.accentPurple, color: C.textPrimary }}>
              Create first session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(s => (
              <SessionCard key={s.id} session={s} startupId={id}
                isSelected={false}
                onSelect={() => {}}
                onAction={load}
                onOpen={() => setDetailSession(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create session modal */}
      {showCreate && (
        <CreateSessionModal
          startupId={id}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
