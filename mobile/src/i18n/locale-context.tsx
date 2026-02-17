import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

export type Locale =
  | "en" | "fr" | "es" | "it" | "de"
  | "zh" | "ja" | "ko"
  | "th" | "vi" | "id" | "ru";

export const SUPPORTED_LOCALES: Locale[] = [
  "en", "fr", "es", "it", "de", "zh", "ja", "ko", "th", "vi", "id", "ru",
];

export type LocaleInfo = { code: Locale; flag: string; label: string };

export const LOCALE_META: LocaleInfo[] = [
  { code: "en", flag: "\u{1F1FA}\u{1F1F8}", label: "English" },
  { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", label: "Fran\u00e7ais" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}", label: "Espa\u00f1ol" },
  { code: "it", flag: "\u{1F1EE}\u{1F1F9}", label: "Italiano" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}", label: "Deutsch" },
  { code: "zh", flag: "\u{1F1E8}\u{1F1F3}", label: "\u4e2d\u6587" },
  { code: "ja", flag: "\u{1F1EF}\u{1F1F5}", label: "\u65e5\u672c\u8a9e" },
  { code: "ko", flag: "\u{1F1F0}\u{1F1F7}", label: "\ud55c\uad6d\uc5b4" },
  { code: "th", flag: "\u{1F1F9}\u{1F1ED}", label: "\u0e44\u0e17\u0e22" },
  { code: "vi", flag: "\u{1F1FB}\u{1F1F3}", label: "Ti\u1ebfng Vi\u1ec7t" },
  { code: "id", flag: "\u{1F1EE}\u{1F1E9}", label: "Indonesia" },
  { code: "ru", flag: "\u{1F1F7}\u{1F1FA}", label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
];

export type Messages = Record<string, string>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const STORAGE_KEY = "gnndex.mobile.locale";
const DEFAULT_LOCALE: Locale = "en";

const LocaleContext = createContext<LocaleContextValue | null>(null);

/* ── Eagerly import all message modules ── */

import commonMessages from "./messages/common";
import authMessages from "./messages/auth";
import marketMessages from "./messages/market";
import tradeMessages from "./messages/trade";
import walletMessages from "./messages/wallet";
import mypageMessages from "./messages/mypage";

const allModules = [
  commonMessages,
  authMessages,
  marketMessages,
  tradeMessages,
  walletMessages,
  mypageMessages,
];

function buildMessages(locale: Locale): Messages {
  const merged: Messages = {};
  for (const mod of allModules) {
    const localeMessages = mod[locale] ?? mod.en ?? {};
    Object.assign(merged, localeMessages);
  }
  return merged;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
        setLocaleState(stored as Locale);
      }
    });
  }, []);

  const messages = useMemo(() => buildMessages(locale), [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next);
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
