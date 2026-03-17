"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  startups, sessions, getToken,
  type Startup, type Session,
} from "@/lib/api";
import {
  Plus, Loader2, CheckCircle, XCircle, Clock, Play, Pause,
  GitMerge, Trash2, ChevronLeft, Zap, AlertCircle,
  Eye, FileCode, ChevronRight, X, Send,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  queued:    "bg-gray-700 text-gray-300",
  running:   "bg-indigo-700 text-indigo-200",
  paused:    "bg-yellow-800 text-yellow-200",
  review:    "bg-amber-700 text-amber-200",
  completed: "bg-green-800 text-green-200",
  error:     "bg-red-900 text-red-300",
  cancelled: "bg-gray-800 text-gray-500",
};

const STATUS_BORDER: Record<string, string> = {
  queued:    "border-gray-700",
  running:   "border-indigo-500",
  paused:    "border-yellow-600",
  review:    "border-amber-500",
  completed: "border-green-700",
  error:     "border-red-700",
  cancelled: "border-gray-800",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "running")   return <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />;
  if (status === "completed") return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
  if (status === "error")     return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "review")    return <GitMerge className="w-3.5 h-3.5 text-amber-400" />;
  if (status === "paused")    return <Pause className="w-3.5 h-3.5 text-yellow-400" />;
  return <Clock className="w-3.5 h-3.5 text-gray-400" />;
}

// ── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  session, startupId, isSelected, onSelect, onAction,
}: {
  session: Session;
  startupId: string;
  isSelected: boolean;
  onSelect: () => void;
  onAction: () => void;
}) {
  const [acting, setActing] = useState(false);

  async function doAction(path: string, method = "POST", body?: object) {
    setActing(true);
    try {
      await fetch(
        `${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      onAction();
    } finally {
      setActing(false);
    }
  }

  async function doDelete() {
    setActing(true);
    try {
      await fetch(`${API_BASE}/api/sessions/${session.id}?startup_id=${startupId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      onAction();
    } finally {
      setActing(false);
    }
  }

  const canMerge   = session.status === "review";
  const canPause   = session.status === "running";
  const canResume  = session.status === "paused";
  const canCancel  = ["queued", "running", "paused"].includes(session.status);
  const isDone     = ["completed", "error", "cancelled"].includes(session.status);

  return (
    <div
      onClick={onSelect}
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all ${
        isSelected ? "border-indigo-500 ring-1 ring-indigo-500/30" : STATUS_BORDER[session.status] ?? "border-gray-800"
      } hover:border-gray-600`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={session.status} />
          <span className="text-sm font-medium text-white truncate">{session.title}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[session.status] ?? "bg-gray-700 text-gray-400"}`}>
          {session.status}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="uppercase tracking-wide">{session.type}</span>
        {(session.cost_usd ?? 0) > 0 && <span>${(session.cost_usd ?? 0).toFixed(4)}</span>}
        {session.branch_name && <span className="font-mono truncate">{session.branch_name}</span>}
      </div>

      {/* Progress bar */}
      {session.status === "running" && (
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${session.progress ?? 0}%` }}
          />
        </div>
      )}

      {/* Files changed */}
      {Array.isArray(session.files_changed) && session.files_changed.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <FileCode className="w-3 h-3" />
          {session.files_changed.length} files changed
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        {canMerge && (
          <button
            onClick={() => doAction("merge")}
            disabled={acting}
            className="flex items-center gap-1.5 text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <GitMerge className="w-3 h-3" /> Merge
          </button>
        )}
        {canMerge && (
          <button
            onClick={onSelect}
            className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Eye className="w-3 h-3" /> Review
          </button>
        )}
        {canPause && (
          <button
            onClick={() => doAction("pause")}
            disabled={acting}
            className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Pause className="w-3 h-3" /> Pause
          </button>
        )}
        {canResume && (
          <button
            onClick={() => doAction("resume")}
            disabled={acting}
            className="flex items-center gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" /> Resume
          </button>
        )}
        {isDone && (
          <button
            onClick={onSelect}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-3 h-3" /> Details
          </button>
        )}
        {canCancel && (
          <button
            onClick={doDelete}
            disabled={acting}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail panel (right side) ────────────────────────────────────────────────

function SessionDetailPanel({
  session, startupId, onClose, onAction,
}: {
  session: Session;
  startupId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load conversation messages
  useEffect(() => {
    setLoadingMessages(true);
    fetch(`${API_BASE}/api/sessions/${session.id}/messages?startup_id=${startupId}&limit=50`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setMessages(json.data ?? []); })
      .finally(() => setLoadingMessages(false));
  }, [session.id, session.status]);

  async function doAction(path: string, method = "POST", body?: object) {
    setActing(true);
    try {
      await fetch(
        `${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`,
        {
          method,
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      onAction();
    } finally {
      setActing(false);
    }
  }

  async function sendFeedback() {
    if (!feedback.trim()) return;
    setSending(true);
    // POST /sessions/{id}/chat — sends message to Claude's conversation history
    await fetch(`${API_BASE}/api/sessions/${session.id}/chat?startup_id=${startupId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: feedback }),
    });
    setMessages((prev) => [...prev, { role: "user", content: feedback, created_at: new Date().toISOString() }]);
    setFeedback("");
    setSending(false);
  }

  const canMerge  = session.status === "review";
  const canRetry  = session.status === "error";

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <StatusIcon status={session.status} />
            <span className="text-sm font-semibold text-white">{session.title}</span>
          </div>
          <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${STATUS_COLOR[session.status] ?? ""}`}>
            {session.status}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Summary */}
        {session.summary && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Summary</p>
            <p className="text-sm text-gray-300 leading-relaxed">{session.summary}</p>
          </div>
        )}

        {/* Error */}
        {session.status === "error" && session.error_message && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-400 font-medium mb-1">Error</p>
            <p className="text-xs text-red-300 font-mono leading-relaxed">{session.error_message}</p>
          </div>
        )}

        {/* Files changed */}
        {Array.isArray(session.files_changed) && session.files_changed.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Files Changed</p>
            <div className="space-y-1">
              {session.files_changed.map((f: string) => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                  <FileCode className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {((session.cost_usd ?? 0) > 0 || session.model_calls > 0) && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Stats</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(session.cost_usd ?? 0) > 0 && (
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-0.5">Cost</p>
                  <p className="text-white font-mono">${(session.cost_usd ?? 0).toFixed(4)}</p>
                </div>
              )}
              {session.model_calls > 0 && (
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-0.5">API Calls</p>
                  <p className="text-white font-mono">{session.model_calls}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview URL */}
        {session.preview_url && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Preview</p>
            <a
              href={session.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-gray-800 rounded-lg px-3 py-2.5 transition-colors"
            >
              <Eye className="w-3 h-3" />
              {session.preview_url}
            </a>
          </div>
        )}

        {/* Conversation */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Conversation</p>
          {loadingMessages ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          ) : messages.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No messages yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`text-xs rounded-lg px-3 py-2 ${m.role === "user" ? "bg-indigo-900/40 text-indigo-200" : "bg-gray-800 text-gray-300"}`}>
                  <p className="text-gray-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: "10px" }}>{m.role}</p>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch */}
        {session.branch_name && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Branch</p>
            <p className="text-xs text-gray-400 font-mono bg-gray-800 rounded-lg px-3 py-2">{session.branch_name}</p>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="border-t border-gray-800 p-4 space-y-3">

        {/* Merge / Retry buttons */}
        {canMerge && (
          <div className="flex gap-2">
            <button
              onClick={() => doAction("merge")}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <GitMerge className="w-4 h-4" /> Merge & Deploy
            </button>
          </div>
        )}
        {canRetry && (
          <button
            onClick={() => doAction("retry")}
            disabled={acting}
            className="w-full flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> Retry
          </button>
        )}

        {/* Request changes / feedback */}
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendFeedback()}
              placeholder="Request changes or give instructions..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={sendFeedback}
              disabled={sending || !feedback.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Re-queues session with your feedback added.</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function StartupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [startup, setStartup]         = useState<Startup | null>(null);
  const [mySessions, setMySessions]   = useState<Session[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [newType, setNewType]         = useState("feature");
  const [creating, setCreating]       = useState(false);
  const [selected, setSelected]       = useState<Session | null>(null);
  const [wsStatus, setWsStatus]       = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  async function load() {
    const [startupRes, sessionsRes] = await Promise.all([
      startups.get(id),
      sessions.list(id),
    ]);
    if (startupRes.ok) setStartup(startupRes.data);
    if (sessionsRes.ok) {
      const items = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      setMySessions(items);
      // Refresh selected session data if panel is open
      if (selected) {
        const updated = items.find((s: Session) => s.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // WebSocket live updates
  useEffect(() => {
    const token = getToken();
    if (!token || !id) return;
    const ws = new WebSocket(`${WS_BASE}/ws/sessions/${id}`);
    wsRef.current = ws;
    ws.onopen  = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event?.startsWith("session.")) load();
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [id]);

  // Auto-poll while sessions are active
  useEffect(() => {
    const hasActive = mySessions.some((s) => ["queued", "running"].includes(s.status));
    if (!hasActive) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [mySessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const result = await sessions.create(id, newTitle, newDesc, newType);
    if (result.ok) {
      setShowForm(false);
      setNewTitle("");
      setNewDesc("");
      await load();
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }
  if (!startup) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-400">Startup not found.</p>
        <button onClick={() => router.back()} className="text-indigo-400 text-sm">Go back</button>
      </div>
    );
  }

  const active   = mySessions.filter((s) => ["queued", "running", "paused"].includes(s.status));
  const review   = mySessions.filter((s) => s.status === "review");
  const finished = mySessions.filter((s) => ["completed", "error", "cancelled"].includes(s.status));

  return (
    <div className="flex h-full">

      {/* Left: main content */}
      <div className={`flex-1 overflow-auto p-8 ${selected ? "max-w-3xl" : ""}`}>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{startup.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${startup.status === "live" ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-400"}`}>
                {startup.status}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${wsStatus === "connected" ? "bg-green-500" : wsStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-600"}`}
                title={`WebSocket: ${wsStatus}`}
              />
            </div>
            <p className="text-gray-500 text-sm mt-0.5">{startup.description}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>

        {/* New session form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold text-white mb-4">New Session</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Title</label>
                  <input
                    type="text" required value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Add user authentication"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Type</label>
                  <select
                    value={newType} onChange={(e) => setNewType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="feature">Feature</option>
                    <option value="fix">Fix</option>
                    <option value="build">Full Build</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Describe in detail</label>
                <textarea
                  required minLength={10} rows={2} value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Add email + password authentication with JWT tokens, registration, login, and /me endpoint."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit" disabled={creating}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  {creating ? "Starting..." : "딸깍"}
                </button>
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-white text-sm px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {mySessions.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
            <Zap className="w-10 h-10 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">No sessions yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create a session to start building.</p>
            <button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              Create first session
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Active</h2>
                  <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">{active.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {active.map((s) => (
                    <SessionCard key={s.id} session={s} startupId={id}
                      isSelected={selected?.id === s.id}
                      onSelect={() => setSelected(selected?.id === s.id ? null : s)}
                      onAction={load}
                    />
                  ))}
                </div>
              </section>
            )}

            {review.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-medium text-amber-500 uppercase tracking-wider">Ready to Review</h2>
                  <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">{review.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {review.map((s) => (
                    <SessionCard key={s.id} session={s} startupId={id}
                      isSelected={selected?.id === s.id}
                      onSelect={() => setSelected(selected?.id === s.id ? null : s)}
                      onAction={load}
                    />
                  ))}
                </div>
              </section>
            )}

            {finished.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-4">History</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {finished.map((s) => (
                    <SessionCard key={s.id} session={s} startupId={id}
                      isSelected={selected?.id === s.id}
                      onSelect={() => setSelected(selected?.id === s.id ? null : s)}
                      onAction={load}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 h-full">
          <SessionDetailPanel
            session={selected}
            startupId={id}
            onClose={() => setSelected(null)}
            onAction={load}
          />
        </div>
      )}
    </div>
  );
}
