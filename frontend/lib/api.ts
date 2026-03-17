/**
 * lib/api.ts — Centralized API client for DalkkakAI backend.
 *
 * All requests go through here. Handles auth headers, error parsing,
 * and returns typed responses in the standard { ok, data/error } envelope.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

// ── Auth types ───────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  has_api_key: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: TokenResponse;
  user: User;
}

// ── Startup types ────────────────────────────────────────────────────────────

export interface Startup {
  id: string;
  name: string;
  description: string;
  status: string;
  tech_stack: string;
  domain: string | null;
  preview_url: string | null;
  created_at: string;
}

// ── Session types ─────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  startup_id: string;
  type: string;
  status: string;
  title: string;
  progress: number;
  model_used: string | null;
  cost_usd: number;
  branch_name: string | null;
  preview_url: string | null;
  created_at: string;
}

// ── Token storage ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dalkkak_token");
}

export function setToken(token: string): void {
  localStorage.setItem("dalkkak_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("dalkkak_token");
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const json = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: json.error ?? json.detail ?? "Something went wrong",
        code: json.code,
      };
    }

    // Backend wraps in { ok, data } — unwrap it
    if ("data" in json) return { ok: true, data: json.data as T };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Network error — is the server running?" };
  }
}

// ── Auth API ─────────────────────────────────────────────────────────────────

export const auth = {
  register: (name: string, email: string, password: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>("/api/auth/me"),

  saveApiKey: (key: string) =>
    request<{ has_api_key: boolean }>("/api/auth/me/api-key", {
      method: "PUT",
      body: JSON.stringify({ anthropic_api_key: key }),
    }),

  deleteApiKey: () =>
    request<{ has_api_key: boolean }>("/api/auth/me/api-key", {
      method: "DELETE",
    }),
};

// ── Startups API ─────────────────────────────────────────────────────────────

export const startups = {
  list: () => request<Startup[]>("/api/startups"),

  create: (name: string, description: string) =>
    request<Startup>("/api/startups", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  get: (id: string) => request<Startup>(`/api/startups/${id}`),
};

// ── Sessions API ─────────────────────────────────────────────────────────────

export const sessions = {
  list: (startupId: string) =>
    request<Session[]>(`/api/startups/${startupId}/sessions`),

  create: (startupId: string, title: string, description: string, agent_type = "feature") =>
    request<Session>(`/api/startups/${startupId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title, description, agent_type }),
    }),
};
