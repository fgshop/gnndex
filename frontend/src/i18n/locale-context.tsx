"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale =
  | "en" | "fr" | "es" | "it" | "de"
  | "zh" | "ja" | "ko"
  | "th" | "vi" | "id" | "ru";

export const SUPPORTED_LOCALES: Locale[] = [
  "en", "fr", "es", "it", "de", "zh", "ja", "ko", "th", "vi", "id", "ru",
];

export type LocaleInfo = { code: Locale; flag: string; label: string };

export const LOCALE_META: LocaleInfo[] = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "th", flag: "🇹🇭", label: "ไทย" },
  { code: "vi", flag: "🇻🇳", label: "Tiếng Việt" },
  { code: "id", flag: "🇮🇩", label: "Indonesia" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
];

export type Messages = Record<string, string>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const STORAGE_KEY = "gnndex.locale";
const DEFAULT_LOCALE: Locale = "en";

const LocaleContext = createContext<LocaleContextValue | null>(null);

/* ── Message loading ── */

type MessageModule = { default: Record<string, Messages> };

const loaders: Record<Locale, () => Promise<MessageModule>> = {
  en: () => import("./messages/common"),
  fr: () => import("./messages/common"),
  es: () => import("./messages/common"),
  it: () => import("./messages/common"),
  de: () => import("./messages/common"),
  zh: () => import("./messages/common"),
  ja: () => import("./messages/common"),
  ko: () => import("./messages/common"),
  th: () => import("./messages/common"),
  vi: () => import("./messages/common"),
  id: () => import("./messages/common"),
  ru: () => import("./messages/common"),
};

/* We eagerly import common and lazily merge page-specific bundles */
import commonMessages from "./messages/common";

const pageModules = [
  () => import("./messages/landing"),
  () => import("./messages/trade"),
  () => import("./messages/markets"),
  () => import("./messages/wallet"),
  () => import("./messages/mypage"),
  () => import("./messages/support"),
  () => import("./messages/auth"),
  () => import("./messages/legal"),
];

function buildMessages(locale: Locale, extras: Record<string, Messages>[]): Messages {
  const merged: Messages = { ...(commonMessages[locale] ?? commonMessages.en) };
  for (const mod of extras) {
    const localeMessages = mod[locale] ?? mod.en ?? {};
    Object.assign(merged, localeMessages);
  }
  return merged;
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale;
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [pageMessages, setPageMessages] = useState<Record<string, Messages>[]>([]);

  /* Load stored locale + all page message bundles */
  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);

    Promise.all(pageModules.map((load) => load())).then((mods) => {
      setPageMessages(mods.map((m) => m.default));
    });
  }, []);

  const messages = useMemo(
    () => buildMessages(locale, pageMessages),
    [locale, pageMessages],
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let value = messages[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replaceAll(`{{${k}}}`, v);
        }
      }
      return value;
    },
    [messages],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslation must be used within LocaleProvider");
  return ctx;
}
