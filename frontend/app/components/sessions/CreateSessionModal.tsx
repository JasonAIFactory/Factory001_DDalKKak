"use client";

/**
 * Modal dialog for creating a new session.
 * Supports Auto AI and Terminal modes, with quick-start templates.
 */

import { useState } from "react";
import { X, Zap, Cpu, TerminalSquare } from "lucide-react";
import { sessions } from "@/lib/api";
import { C } from "@/app/components/shared/constants";

export default function CreateSessionModal({
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

  /** Submit session creation to backend. */
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
