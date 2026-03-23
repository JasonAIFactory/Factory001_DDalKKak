"use client";

/**
 * Status display components for sessions.
 * StatusBadge: colored pill label. StatusIcon: animated icon. StatusPipeline: overview bar.
 * Btn/Metric: small reusable UI helpers used across session components.
 */

import { Clock, Loader2, CheckCircle, XCircle, Eye, Pause } from "lucide-react";
import { C, STATUS_CFG } from "@/app/components/shared/constants";

export function StatusBadge({ status }: { status: string }) {
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

export function StatusIcon({ status }: { status: string }) {
  if (status === "running")   return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.yellow }} />;
  if (status === "completed" || status === "merged") return <CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} />;
  if (status === "error")     return <XCircle className="w-3.5 h-3.5" style={{ color: C.red }} />;
  if (status === "review")    return <Eye className="w-3.5 h-3.5" style={{ color: C.accentCyan }} />;
  if (status === "paused")    return <Pause className="w-3.5 h-3.5" style={{ color: C.yellow }} />;
  return <Clock className="w-3.5 h-3.5" style={{ color: C.gray }} />;
}

export function StatusPipeline({ sessions: ss }: { sessions: { status: string }[] }) {
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
          {i > 0 && <div className="w-8 h-px mx-1" style={{ backgroundColor: C.bgTertiary, opacity: n.count > 0 ? 1 : 0.3 }} />}
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.count > 0 ? n.color : C.bgTertiary }} />
          <span className="text-xs font-medium" style={{ color: n.count > 0 ? n.color : C.textMuted }}>
            {n.count} {n.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Btn({ icon, label, color, onClick, disabled }: {
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

export function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-base font-semibold" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>{label}</p>
    </div>
  );
}
