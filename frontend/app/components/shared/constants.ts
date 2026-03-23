/**
 * Shared design tokens, API config, and utility components.
 * All session-related components import from here for consistent styling.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

// Design tokens from UI_GUIDE.md
export const C = {
  bgPrimary: "#09090b", bgSecondary: "#0f0f13", bgTertiary: "#1c1c22",
  textPrimary: "#fafafa", textSecondary: "#a1a1aa", textMuted: "#52525b",
  accentPurple: "#8b5cf6", accentCyan: "#06b6d4",
  green: "#10b981", yellow: "#f59e0b", red: "#ef4444", gray: "#6b7280",
};

export const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  queued:    { color: C.gray,   bg: "rgba(107,114,128,0.15)", border: C.gray,   label: "Queued" },
  running:   { color: C.yellow, bg: "rgba(245,158,11,0.15)",  border: C.yellow, label: "Running" },
  paused:    { color: C.yellow, bg: "rgba(245,158,11,0.10)",  border: C.yellow, label: "Paused" },
  review:    { color: C.accentCyan, bg: "rgba(6,182,212,0.15)", border: C.accentCyan, label: "Ready" },
  completed: { color: C.green,  bg: "rgba(16,185,129,0.15)",  border: C.green,  label: "Approved" },
  error:     { color: C.red,    bg: "rgba(239,68,68,0.15)",    border: C.red,    label: "Error" },
  cancelled: { color: C.gray,   bg: "rgba(107,114,128,0.10)", border: C.gray,   label: "Cancelled" },
  merged:    { color: C.green,  bg: "rgba(16,185,129,0.15)",  border: C.green,  label: "Merged" },
};

export type DetailTab = "chat" | "terminal" | "files" | "tests" | "logs" | "errors";
