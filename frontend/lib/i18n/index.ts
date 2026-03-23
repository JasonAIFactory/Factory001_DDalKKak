"use client";

/**
 * Lightweight i18n system for DalkkakAI.
 * Provides LanguageProvider (React Context) and useT() hook.
 * Default language: Korean. Persists choice to localStorage.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import React from "react";
import ko, { type TranslationKey } from "./ko";
import en from "./en";

export type Language = "ko" | "en";

const STORAGE_KEY = "dalkkak-lang";

const translations: Record<Language, Record<TranslationKey, string>> = {
  ko,
  en,
};

interface I18nContextValue {
  /** Current translation function — returns the string for a given key */
  t: (key: TranslationKey) => string;
  /** Current language code */
  lang: Language;
  /** Switch language and persist to localStorage */
  setLang: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Reads saved language from localStorage (SSR-safe) */
function getSavedLanguage(): Language {
  if (typeof window === "undefined") return "ko";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ko" || saved === "en") return saved;
  return "ko";
}

interface LanguageProviderProps {
  children: ReactNode;
  /** Override default language (useful for testing) */
  defaultLang?: Language;
}

/**
 * Wrap your app with LanguageProvider to enable translations.
 *
 * Example:
 * ```tsx
 * <LanguageProvider>
 *   <App />
 * </LanguageProvider>
 * ```
 */
export function LanguageProvider({ children, defaultLang }: LanguageProviderProps) {
  const [lang, setLangState] = useState<Language>(defaultLang ?? "ko");

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    if (!defaultLang) {
      setLangState(getSavedLanguage());
    }
  }, [defaultLang]);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLang);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang][key];
    },
    [lang],
  );

  const value: I18nContextValue = { t, lang, setLang };

  return React.createElement(I18nContext.Provider, { value }, children);
}

/**
 * Hook to access translations, current language, and language setter.
 *
 * Example:
 * ```tsx
 * const { t, lang, setLang } = useT();
 * <h1>{t('landing.heroTitle')}</h1>
 * <button onClick={() => setLang('en')}>English</button>
 * ```
 */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useT() must be used inside <LanguageProvider>");
  }
  return ctx;
}

// Re-export types for convenience
export type { TranslationKey };
