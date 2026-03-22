"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Loader2, CheckCircle, Play, Pause, GitMerge, X, Send, RefreshCw,
  TerminalSquare, Eye, FileCode, ChevronLeft, GitBranch, Activity,
  AlertCircle, CheckSquare, Cpu,
} from "lucide-react";
import { getToken, type Session } from "@/lib/api";
import { C, API_BASE, type DetailTab } from "../shared";
import { StatusBadge, Btn, Metric } from "./StatusBadge";
import FilesViewer from "./FilesViewer";

const Terminal = dynamic(() => import("../../../../components/Terminal"), { ssr: false });

export default function SessionDetail({
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
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/${session.id}/messages?startup_id=${startupId}&limit=50`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(json => { if (json.ok) setMessages(json.data ?? []); })
      .catch(() => {});
  }, [session.id, session.status, startupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function doAction(path: string) {
    setActing(true);
    if (path === "preview") setPreviewStatus("Launching test environment...");
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      if (path === "preview") {
        const json = await res.json();
        setPreviewStatus(null);
        if (json.ok && json.data?.url) {
          window.open(json.data.url, "_blank");
        } else {
          alert("Failed: " + (json.data?.error || json.error || "Unknown error"));
        }
      }
      onAction();
    } catch (err) {
      setPreviewStatus(null);
      alert("Error: " + err);
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
        {/* Header actions */}
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
          {["review", "completed", "running"].includes(session.status) && !session.preview_url && (
            <Btn icon={<Play className="w-3 h-3" />} label="Test Run" color={C.accentCyan} onClick={() => doAction("preview")} disabled={acting} />
          )}
          {session.preview_url && (
            <a href={session.preview_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all"
              style={{ backgroundColor: `${C.green}22`, color: C.green }}>
              <Eye className="w-3 h-3" /> Open App
            </a>
          )}
        </div>
      </div>

      {/* Preview status banner */}
      {previewStatus && (
        <div className="flex items-center gap-2 px-6 py-2" style={{ backgroundColor: `${C.accentCyan}15`, borderBottom: `1px solid ${C.accentCyan}33` }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.accentCyan }} />
          <span className="text-sm font-medium" style={{ color: C.accentCyan }}>{previewStatus}</span>
        </div>
      )}

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
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: tab === "terminal" ? "500px" : 0 }}>
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
