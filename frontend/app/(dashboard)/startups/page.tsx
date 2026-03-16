"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startups, type Startup } from "@/lib/api";
import { Rocket, Plus, Loader2 } from "lucide-react";

export default function StartupsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startups.list().then((r) => {
      if (r.ok) setItems(Array.isArray(r.data) ? r.data : []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">My Startups</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
          <Rocket className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No startups yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/startups/${s.id}`)}
              className="text-left bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-2xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-indigo-400" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.status === "live" ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-400"
                }`}>{s.status}</span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{s.name}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
