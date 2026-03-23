"use client";

/**
 * Startup detail page — orchestrates session list and detail views.
 * Manages data loading, WebSocket updates, and auto-polling.
 * All UI rendering is delegated to components in app/components/.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { startups, sessions, getToken, type Startup, type Session } from "@/lib/api";
import { C, WS_BASE } from "@/app/components/shared/constants";
import SessionDetail from "@/app/components/sessions/SessionDetail";
import SessionListView from "@/app/components/sessions/SessionListView";

export default function StartupDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [startup, setStartup] = useState<Startup | null>(null);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const detailRef = useRef<Session | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => { detailRef.current = detailSession; }, [detailSession]);

  /** Fetch startup + sessions data, refresh detail if viewing one. */
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

  /* WebSocket for real-time session updates. */
  useEffect(() => {
    if (!getToken() || !id) return;
    const ws = new WebSocket(`${WS_BASE}/ws/sessions/${id}`);
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");
    ws.onmessage = () => load();
    return () => ws.close();
  }, [id]);

  /* Auto-poll while any session is active. */
  useEffect(() => {
    const hasActive = mySessions.some(s => ["queued", "running"].includes(s.status));
    if (!hasActive) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [mySessions]);

  if (detailSession) {
    return <SessionDetail session={detailSession} startupId={id} onBack={() => setDetailSession(null)} onAction={load} />;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.accentPurple }} /></div>;
  }
  if (!startup) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-8 h-8" style={{ color: C.red }} />
        <p style={{ color: C.textSecondary }}>Startup not found.</p>
      </div>
    );
  }

  return (
    <SessionListView
      startup={startup} sessions={mySessions} startupId={id}
      wsStatus={wsStatus} onAction={load} onOpenSession={setDetailSession}
    />
  );
}
