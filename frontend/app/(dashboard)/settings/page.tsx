"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/api";
import { Key, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

/**
 * Settings page — lets users save their own Anthropic API key (BYOK).
 * If set, all AI sessions use their key instead of the platform key.
 */
export default function SettingsPage() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    auth.me().then((result) => {
      if (result.ok) setHasApiKey(result.data.has_api_key ?? false);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await auth.saveApiKey(inputKey);
    if (result.ok) {
      setHasApiKey(true);
      setInputKey("");
      setMessage({ type: "ok", text: "API key saved. Your sessions will now use your key." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setSaving(false);
  }

  async function handleRemove() {
    setMessage(null);
    setRemoving(true);
    const result = await auth.deleteApiKey();
    if (result.ok) {
      setHasApiKey(false);
      setMessage({ type: "ok", text: "API key removed. Sessions will use the platform key." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setRemoving(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-gray-400 text-sm mb-8">Manage your account and AI configuration.</p>

      {/* BYOK Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <Key className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Anthropic API Key</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Connect your own Anthropic API key. Your sessions will use your account directly —
          you control the cost and usage.
        </p>

        {/* Current status */}
        <div className={`flex items-center gap-2 text-sm mb-6 px-4 py-3 rounded-lg ${
          hasApiKey ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-400"
        }`}>
          {hasApiKey ? (
            <><CheckCircle className="w-4 h-4" /> Your API key is connected</>
          ) : (
            <><AlertCircle className="w-4 h-4" /> No API key set — using platform key</>
          )}
        </div>

        {/* Save new key */}
        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-sm text-gray-400">
            {hasApiKey ? "Replace with a new key" : "Enter your Anthropic API key"}
          </label>
          <div className="flex gap-3">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm"
            />
            <button
              type="submit"
              disabled={saving || inputKey.length < 10}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>

        {/* Remove key */}
        {hasApiKey && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="mt-4 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            {removing ? "Removing..." : "Remove key"}
          </button>
        )}

        {/* Feedback */}
        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}

        {/* Help */}
        <p className="mt-6 text-xs text-gray-500">
          Get your API key at console.anthropic.com → API Keys.
          Your key is stored securely and never shown after saving.
        </p>
      </div>
    </div>
  );
}
