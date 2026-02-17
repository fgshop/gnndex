"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/locale-context";

type Section = { titleKey: string; contentKey: string };

export function LegalPage({
  titleKey,
  introKey,
  sections,
  warningKey,
  children,
}: {
  titleKey: string;
  introKey: string;
  sections: Section[];
  warningKey?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("legal.backToHome")}
      </Link>

      {/* Header */}
      <section className="panel p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">
              {t(titleKey)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {t(introKey)}
        </p>
      </section>

      {/* Sections */}
      {sections.map((section, i) => (
        <section className="panel p-6" key={section.titleKey}>
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div>
              <h2 className="font-[var(--font-display)] text-base font-semibold text-foreground">
                {t(section.titleKey)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(section.contentKey)}
              </p>
            </div>
          </div>
        </section>
      ))}

      {/* Extra content (e.g. fee table) */}
      {children}

      {/* Warning banner */}
      {warningKey ? (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 shrink-0 text-amber-500" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {t(warningKey)}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
