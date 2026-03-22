"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Loader2, ChevronLeft, Zap, AlertCircle, GitMerge,
} from "lucide-react";
import { startups, sessions, getToken, type Startup, type Session } from "@/lib/api";
import { C, WS_BASE } from "./shared";
import { StatusPipeline } from "./components/StatusBadge";
import SessionCard from "./components/SessionCard";
import SessionDetail from "./components/SessionDetail";
import CreateSessionModal from "./components/CreateSessionModal";

// ── Main Page ───────────────────────────────────────────────────────────────
export default function StartupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [startup, setStartup] = useState<Startup | null>(null);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const detailRef = useRef<Session | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "ready" | "approved">("all");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // Keep ref in sync so load() never has a stale closure
  useEffect(() => { detailRef.current = detailSession; }, [detailSession]);

  const load = useCallback(async () => {
    const [startupRes, sessionsRes] = await Promise.all([
      startups.get(id), sessions.list(id),
    ]);
    if (startupRes.ok) setStartup(startupRes.data);
    if (sessionsRes.ok) {
      const items = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      setMySessions(items);
      const current = detailRef.current;
      if (current) {
        const updated = items.find((s: Session) => s.id === current.id);
        if (updated) setDetailSession(updated);
      }
    }
    setLoading(false);
  }, [id]);

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
              <Plus className="w-4 h-4 inline mr-2" />Create Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(s => (
              <SessionCard
                key={s.id} session={s} startupId={id}
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
        <CreateSessionModal startupId={id} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
