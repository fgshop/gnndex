"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALE_META, type Locale } from "@/i18n/locale-context";
import { useTranslation } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LOCALE_META.find((m) => m.code === locale) ?? LOCALE_META[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label={t("lang.select")}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground transition-all hover:text-foreground hover:bg-secondary"
        onClick={() => setOpen((p) => !p)}
        type="button"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden text-xs font-medium sm:inline">{current.code.toUpperCase()}</span>
        <svg
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 animate-fade-up rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/10">
          {LOCALE_META.map((meta) => (
            <button
              key={meta.code}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                meta.code === locale
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              onClick={() => {
                setLocale(meta.code as Locale);
                setOpen(false);
              }}
              type="button"
            >
              <span className="text-base leading-none">{meta.flag}</span>
              <span>{meta.label}</span>
              {meta.code === locale && (
                <svg
                  className="ml-auto h-4 w-4 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
