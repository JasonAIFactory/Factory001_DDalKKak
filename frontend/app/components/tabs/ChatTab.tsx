"use client";

/**
 * Chat tab content for session detail view.
 * Shows message history and input field for sending feedback to the agent.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { getToken, type Session } from "@/lib/api";
import { C, API_BASE } from "@/app/components/shared/constants";

export default function ChatTab({ session, startupId }: { session: Session; startupId: string }) {
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Fetch chat messages when session changes. */
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

  /** Send a chat message to the session agent. */
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

  return (
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
  );
}
