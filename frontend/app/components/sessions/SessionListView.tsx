"use client";

/**
 * Session list view — top bar, status pipeline, filter tabs, and session grid.
 * Shown when no session detail is selected on the startup detail page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronLeft, Zap, GitMerge } from "lucide-react";
import type { Startup, Session } from "@/lib/api";
import { C } from "@/app/components/shared/constants";
import { StatusPipeline } from "@/app/components/sessions/StatusBadge";
import SessionCard from "@/app/components/sessions/SessionCard";
import CreateSessionModal from "@/app/components/sessions/CreateSessionModal";

export default function SessionListView({
  startup, sessions: mySessions, startupId, wsStatus, onAction, onOpenSession,
}: {
  startup: Startup;
  sessions: Session[];
  startupId: string;
  wsStatus: "connecting" | "connected" | "disconnected";
  onAction: () => void;
  onOpenSession: (s: Session) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "running" | "ready" | "approved">("all");
  const [showCreate, setShowCreate] = useState(false);

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
          <button onClick={() => router.push("/dashboard")} style={{ color: C.textMuted }}><ChevronLeft className="w-5 h-5" /></button>
          <Zap className="w-5 h-5" style={{ color: C.accentPurple }} />
          <span className="font-bold text-lg" style={{ color: C.textPrimary }}>{startup.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${C.accentPurple}22`, color: C.accentPurple }}>Preview Environment</span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wsStatus === "connected" ? C.green : C.gray }} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ backgroundColor: C.accentPurple, color: C.textPrimary }}>
            <Plus className="w-4 h-4" /> Create Session
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ backgroundColor: `${C.green}22`, color: C.green }}>
            <GitMerge className="w-4 h-4" /> Merge & Deploy
          </button>
        </div>
      </div>

      <StatusPipeline sessions={mySessions} />

      {/* Filter tabs */}
      <div className="flex gap-0 px-6" style={{ borderBottom: `1px solid ${C.bgTertiary}` }}>
        {([
          { id: "all" as const, label: "All", count: mySessions.length },
          { id: "running" as const, label: `Running (${counts.running})`, count: counts.running },
          { id: "ready" as const, label: `Ready (${counts.ready})`, count: counts.ready },
          { id: "approved" as const, label: `Approved (${counts.approved})`, count: counts.approved },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: filter === t.id ? C.accentPurple : C.textMuted, borderBottom: filter === t.id ? `2px solid ${C.accentPurple}` : "2px solid transparent" }}>
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
            <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: C.accentPurple, color: C.textPrimary }}>
              <Plus className="w-4 h-4 inline mr-2" />Create Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(s => (
              <SessionCard key={s.id} session={s} startupId={startupId} isSelected={false} onSelect={() => {}} onAction={onAction} onOpen={() => onOpenSession(s)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateSessionModal startupId={startupId} onClose={() => setShowCreate(false)} onCreated={onAction} />}
    </div>
  );
}
