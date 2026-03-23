"use client";

/**
 * Individual session card shown in the session grid.
 * Displays status, progress bar, metrics, and action buttons.
 */

import { useState } from "react";
import { Play, Pause, CheckCircle, RefreshCw, GitMerge, Eye, ChevronRight } from "lucide-react";
import { getToken, type Session } from "@/lib/api";
import { C, API_BASE } from "@/app/components/shared/constants";
import { StatusBadge, StatusIcon, Btn } from "@/app/components/sessions/StatusBadge";

export default function SessionCard({
  session, startupId, isSelected, onSelect, onAction, onOpen,
}: {
  session: Session; startupId: string; isSelected: boolean;
  onSelect: () => void; onAction: () => void; onOpen: () => void;
}) {
  const [acting, setActing] = useState(false);

  /** Fire a session action (resume, pause, approve, retry, merge, preview). */
  async function doAction(path: string) {
    setActing(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.id}/${path}?startup_id=${startupId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      if (path === "preview") {
        const json = await res.json();
        if (json.ok && json.data?.url) {
          window.open(json.data.url, "_blank");
        } else {
          alert("Failed: " + (json.data?.error || json.error || "Unknown error"));
        }
      }
      onAction();
    } catch (err) {
      alert("Network error: " + err);
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

      {/* Mode badge + branch */}
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

      {/* Terminal connection status */}
      {isTerminal && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: session.status === "running" ? C.green : C.textMuted }} />
          <span className="text-[10px]" style={{ color: C.textMuted }}>
            {session.status === "running" ? "Terminal active" : "Terminal idle"}
          </span>
        </div>
      )}

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
        {["review", "completed", "running"].includes(session.status) && !session.preview_url && (
          <Btn icon={<Play className="w-3 h-3" />} label="Test" color={C.accentCyan} onClick={() => doAction("preview")} disabled={acting} />
        )}
        {session.preview_url && (
          <a href={session.preview_url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all"
            style={{ backgroundColor: `${C.green}22`, color: C.green }}>
            <Eye className="w-3 h-3" /> Live
          </a>
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
