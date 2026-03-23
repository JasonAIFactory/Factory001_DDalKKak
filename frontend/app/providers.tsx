"use client";

import { LanguageProvider } from "@/lib/i18n";

/**
 * Client-side providers wrapper.
 * Wraps the app with LanguageProvider for i18n support.
 * Separated from layout.tsx so the root layout stays a server component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
