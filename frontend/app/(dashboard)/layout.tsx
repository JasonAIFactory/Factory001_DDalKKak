"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth, clearToken, getToken, type User } from "@/lib/api";
import {
  LayoutDashboard,
  Rocket,
  LogOut,
  Zap,
  Settings,
  TerminalSquare,
  Languages,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Dashboard layout — sidebar + main content area.
 * Redirects to /login if not authenticated.
 * Includes language toggle at sidebar bottom.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, setLang } = useT();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    auth.me().then((result) => {
      if (!result.ok) {
        clearToken();
        router.replace("/login");
      } else {
        setUser(result.data);
      }
    });
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  function toggleLang() {
    setLang(lang === "ko" ? "en" : "ko");
  }

  const navItems: {
    href: string;
    labelKey: TranslationKey;
    icon: typeof LayoutDashboard;
  }[] = [
    { href: "/dashboard", labelKey: "dashboard.dashboard", icon: LayoutDashboard },
    { href: "/startups", labelKey: "dashboard.myStartups", icon: Rocket },
    { href: "/terminal", labelKey: "dashboard.terminal", icon: TerminalSquare },
    { href: "/settings", labelKey: "dashboard.settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white text-lg">
              {t("landing.brand")}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* User + language toggle + logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          )}

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors mb-1"
            aria-label="Toggle language"
          >
            <Languages className="w-4 h-4" />
            {t("lang.toggle")}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("dashboard.signOut")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
