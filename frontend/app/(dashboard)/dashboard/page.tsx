"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startups, sessions, type Startup, type Session } from "@/lib/api";
import { Plus, Rocket, Zap, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

/**
 * Main dashboard — shows all startups and recent sessions.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [myStartups, setMyStartups] = useState<Startup[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const result = await startups.list();
    if (result.ok) {
      const items = Array.isArray(result.data) ? result.data : [];
      setMyStartups(items);
      if (items.length > 0) {
        const sessResult = await sessions.list(items[0].id);
        if (sessResult.ok) {
          const sessItems = Array.isArray(sessResult.data) ? sessResult.data : [];
          setRecentSessions(sessItems.slice(0, 5));
        }
      }
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    const result = await startups.create(newName, newDesc);
    if (!result.ok) {
      setFormError(result.error);
      setCreating(false);
      return;
    }
    setShowNewForm(false);
    setNewName("");
    setNewDesc("");
    setCreating(false);
    router.push(`/startups/${result.data.id}`);
  }

  function statusIcon(status: string) {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":    return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":   return <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />;
      default:          return <Clock className="w-4 h-4 text-gray-400" />;
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Your startups, all in one place.</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Startup
        </button>
      </div>

      {/* New startup form */}
      {showNewForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Describe your startup</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Startup name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ReviewPro"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">What does it do?</label>
              <textarea
                required
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="A SaaS that helps restaurants manage and respond to reviews automatically using AI."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
            {formError && (
              <p className="text-red-400 text-sm">{formError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                <Zap className="w-4 h-4" />
                {creating ? "Building..." : "Build it"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="text-gray-400 hover:text-white text-sm px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : myStartups.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
          <Rocket className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No startups yet</h3>
          <p className="text-gray-500 text-sm mb-6">Describe your idea and we&apos;ll build it for you.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Create your first startup
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Startups */}
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Your Startups
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myStartups.map((startup) => (
                <button
                  key={startup.id}
                  onClick={() => router.push(`/startups/${startup.id}`)}
                  className="text-left bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-2xl p-5 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                      <Rocket className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      startup.status === "live"
                        ? "bg-green-900/50 text-green-400"
                        : "bg-gray-800 text-gray-400"
                    }`}>
                      {startup.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {startup.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{startup.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                Recent Sessions
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-4 px-5 py-3.5">
                    {statusIcon(session.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{session.title}</p>
                      <p className="text-xs text-gray-500">{session.type}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      ${(session.cost_usd ?? 0).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
