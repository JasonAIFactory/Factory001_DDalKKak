"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, setToken } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Login page — email + password -> JWT -> redirect to dashboard.
 * All user-facing strings loaded via i18n t() for KO/EN support.
 */
export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    console.log("[LOGIN] Attempting login:", email);
    const result = await auth.login(email, password);
    console.log("[LOGIN] Result:", JSON.stringify(result));

    if (!result.ok) {
      console.error("[LOGIN] Failed:", result.error);
      setError(result.error);
      setLoading(false);
      return;
    }

    console.log("[LOGIN] Success, setting token");
    setToken(result.data.token.access_token);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t("landing.brand")}</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {t("auth.brandSubtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {t("auth.signIn")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                {t("auth.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                {t("auth.password")}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 transition-colors"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            {t("auth.noAccount")}{" "}
            <Link
              href="/register"
              className="text-indigo-400 hover:text-indigo-300"
            >
              {t("auth.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
