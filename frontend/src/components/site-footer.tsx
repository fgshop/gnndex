"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/locale-context";

function CheckBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
      <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}

function FooterColumn({ title, links }: { title: string; links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l, idx) => (
          <li key={`${l.href}-${idx}`}>
            <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href={l.href}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();

  const products = [
    { href: "/markets", label: t("nav.markets") },
    { href: "/trade", label: t("footer.spotTrading") },
    { href: "/wallet", label: t("nav.wallet") },
    { href: "/mypage", label: t("nav.account") },
  ];

  const resources = [
    { href: "/support?tab=notice", label: t("footer.announcements") },
    { href: "/support?tab=faq", label: t("footer.faq") },
    { href: "#", label: t("footer.apiDocs") },
    { href: "#", label: t("footer.tradingGuide") },
  ];

  const support = [
    { href: "/support?tab=inquiry", label: t("footer.submitRequest") },
    { href: "/support?tab=tickets", label: t("footer.myTickets") },
    { href: "#", label: t("footer.systemStatus") },
  ];

  const legal = [
    { href: "/legal/terms", label: t("footer.terms") },
    { href: "/legal/privacy", label: t("footer.privacy") },
    { href: "/legal/fees", label: t("footer.fees") },
    { href: "/legal/risk", label: t("footer.risk") },
  ];

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto w-full max-w-[1440px] px-6">
        {/* Main */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <section className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/25">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  <line x1="12" y1="22" x2="12" y2="15.5" />
                  <polyline points="22 8.5 12 15.5 2 8.5" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight font-[var(--font-display)]">
                Gnn<span className="text-primary">DEX</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("footer.brandDesc")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CheckBadge label={t("footer.coldStorage")} />
              <CheckBadge label={t("footer.monitoring")} />
              <CheckBadge label={t("footer.riskEngine")} />
            </div>
          </section>

          <FooterColumn title={t("footer.products")} links={products} />
          <FooterColumn title={t("footer.resources")} links={resources} />
          <FooterColumn title={t("footer.support")} links={support} />
          <FooterColumn title={t("footer.legal")} links={legal} />
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-muted-foreground">
              {t("footer.copyright")}
            </p>
            <p className="max-w-xl text-center text-xs leading-relaxed text-muted-foreground/70 md:text-right">
              {t("footer.disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
