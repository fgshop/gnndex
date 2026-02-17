"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { StreamReconnectNotice } from "@/components/stream-reconnect-notice";
import { LISTED_MARKET_SYMBOLS, LISTED_MARKET_SYMBOLS_CSV } from "@/lib/listed-markets";
import { api, apiBaseUrl } from "@/lib/api";
import { getSiteUrl } from "@/lib/site-url";
import { streamSseWithBackoff, type SseRetryInfo } from "@/lib/sse-stream";
import { useTranslation } from "@/i18n/locale-context";
import { CosmicBackground } from "@/components/cosmic-background";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

type TickerRow = {
  symbol: string;
  lastPrice: string | null;
  openPrice24h: string | null;
  highPrice24h: string | null;
  lowPrice24h: string | null;
  volume24h: string;
  changePercent24h: string | null;
  updatedAt: string;
};

type TickerStreamEvent = {
  eventId: string;
  eventType: "market.ticker.snapshot" | "market.ticker.error";
  eventVersion: number;
  occurredAt: string;
  data: TickerRow[] | { message?: string };
};

type CandleRow = {
  open: string;
  close: string;
};

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const FEATURED_SYMBOLS = LISTED_MARKET_SYMBOLS;
const FEATURED_SYMBOLS_CSV = LISTED_MARKET_SYMBOLS_CSV;

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XRP: "Ripple",
  SBK: "SBK Token",
  G99: "G99 Token",
};

const siteUrl = getSiteUrl();

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "GnnDEX",
      url: siteUrl,
      logo: `${siteUrl}/opengraph-image`,
    },
    {
      "@type": "WebSite",
      name: "GnnDEX",
      url: siteUrl,
      inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/markets?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/* ═══════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════ */

function parseTickerStreamEvent(raw: string): TickerStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TickerStreamEvent>;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      parsed.eventType !== "market.ticker.snapshot" &&
      parsed.eventType !== "market.ticker.error"
    )
      return null;
    return parsed as TickerStreamEvent;
  } catch {
    return null;
  }
}

function toRows(payload: unknown): TickerRow[] {
  return Array.isArray(payload) ? (payload as TickerRow[]) : [];
}

function toNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function formatPrice(raw: number | null): string {
  if (raw === null || !Number.isFinite(raw)) return "--";
  if (raw >= 1000) {
    return raw.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (raw >= 1) {
    return raw.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return raw.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const fixed = value.toFixed(2);
  return `${value >= 0 ? "+" : ""}${fixed}%`;
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildPlaceholderRow(symbol: string): TickerRow {
  return {
    symbol,
    lastPrice: null,
    openPrice24h: null,
    highPrice24h: null,
    lowPrice24h: null,
    volume24h: "0",
    changePercent24h: null,
    updatedAt: new Date().toISOString(),
  };
}

function changeColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "text-muted-foreground";
  return value >= 0 ? "text-exchange-up" : "text-exchange-down";
}

function changeBg(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "bg-muted text-muted-foreground";
  return value >= 0
    ? "bg-exchange-up/10 text-exchange-up"
    : "bg-exchange-down/10 text-exchange-down";
}

/* ═══════════════════════════════════════════════════════
   Sparkline SVG
   ═══════════════════════════════════════════════════════ */

function MiniSparkline({
  points,
  positive,
}: {
  points: number[];
  positive: boolean;
}) {
  if (points.length < 2) {
    return <div className="h-10 w-20" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const delta = max - min || 1;
  const w = 80;
  const h = 40;
  const pad = 2;

  const path = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / delta) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${path} L${(w - pad).toFixed(1)},${h} L${pad},${h} Z`;

  const strokeColor = positive ? "hsl(var(--exchange-up))" : "hsl(var(--exchange-down))";
  const fillColor = positive
    ? "hsl(var(--exchange-up) / 0.1)"
    : "hsl(var(--exchange-down) / 0.1)";

  return (
    <svg
      aria-label="price trend"
      className="h-10 w-20"
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={areaPath} fill={fillColor} />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   Intersection Observer Hook (scroll animations)
   ═══════════════════════════════════════════════════════ */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════
   Section Components
   ═══════════════════════════════════════════════════════ */

function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      {/* Cosmic space background — Earth + shooting stars */}
      <div className="pointer-events-none absolute inset-0">
        <CosmicBackground className="absolute inset-0" />
      </div>
      {/* Edge vignette — fades to background color */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 12%, transparent 80%, hsl(var(--background)) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-24 lg:px-6 lg:pb-36 lg:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-glow-pulse" />
            {t("landing.hero.badge")}
          </div>

          <h1 className="mt-8 font-display text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl animate-fade-up [animation-delay:100ms]">
            {t("landing.hero.heading1")}
            <br />
            <span className="gradient-text">{t("landing.hero.heading2")}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-up [animation-delay:200ms]">
            {t("landing.hero.description").split(" — ").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-up [animation-delay:300ms]">
            <Link
              className="btn-primary px-8 py-3.5 text-base shadow-lg shadow-primary/25"
              href="/auth/register"
            >
              {t("landing.hero.cta.start")}
            </Link>
            <Link
              className="btn-secondary px-8 py-3.5 text-base"
              href="/markets"
            >
              {t("landing.hero.cta.explore")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveTickerStrip({
  rows,
  loading,
  streamRetryInfo,
}: {
  rows: TickerRow[];
  loading: boolean;
  streamRetryInfo: SseRetryInfo | null;
}) {
  const { t } = useTranslation();
  // Double the rows for seamless looping
  const doubled = useMemo(() => [...rows, ...rows], [rows]);

  return (
    <section className="relative border-y border-border bg-card/60 backdrop-blur-sm">
      <StreamReconnectNotice
        className="absolute left-4 top-2 z-10"
        retryInfo={streamRetryInfo}
      />
      <div className="overflow-hidden py-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-1 text-xs text-muted-foreground">
            {t("landing.ticker.loading")}
          </div>
        ) : (
          <div className="ticker-marquee flex min-w-max items-center gap-5 px-4">
            {doubled.map((row, index) => {
              const price = toNumber(row.lastPrice);
              const change = toNumber(row.changePercent24h);
              const isPositive = change !== null && change >= 0;
              return (
                <Link
                  className="group inline-flex items-center gap-2.5 rounded-lg px-1 py-0.5 text-sm transition-colors hover:bg-muted/50"
                  href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
                  key={`t-${row.symbol}-${index}`}
                >
                  <CoinIcon symbol={row.symbol} size="sm" />
                  <span className="font-semibold text-foreground">
                    {row.symbol.replace("-USDT", "")}
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    ${formatPrice(price)}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      isPositive ? "text-exchange-up" : "text-exchange-down"
                    }`}
                  >
                    {formatSignedPercent(change)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedMarketsGrid({
  rows,
  sparklines,
}: {
  rows: TickerRow[];
  sparklines: Record<string, number[]>;
}) {
  const { t } = useTranslation();
  const section = useInView();

  return (
    <section
      ref={section.ref as React.RefObject<HTMLDivElement>}
      className="mx-auto max-w-[1440px] px-4 py-20 lg:px-6 lg:py-28"
    >
      <div className="mb-12 text-center">
        <h2
          className={`font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl ${
            section.visible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          {t("landing.markets.heading")}
        </h2>
        <p
          className={`mx-auto mt-3 max-w-lg text-muted-foreground ${
            section.visible ? "animate-fade-up [animation-delay:100ms]" : "opacity-0"
          }`}
        >
          {t("landing.markets.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row, i) => {
          const base = row.symbol.split("-")[0];
          const name = COIN_NAMES[base] ?? base;
          const price = toNumber(row.lastPrice);
          const change = toNumber(row.changePercent24h);
          const isPositive = change !== null && change >= 0;
          const sparkPts = sparklines[row.symbol] ?? [];

          return (
            <Link
              key={row.symbol}
              href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
              className={`panel panel-hover group relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${
                section.visible
                  ? `animate-fade-up [animation-delay:${150 + i * 80}ms]`
                  : "opacity-0"
              }`}
            >
              {/* Subtle gradient top accent */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CoinIcon symbol={row.symbol} size="lg" />
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.symbol}
                    </p>
                  </div>
                </div>
                <MiniSparkline points={sparkPts} positive={isPositive} />
              </div>

              <div className="mt-4 flex items-end justify-between">
                <p className="font-mono text-2xl font-bold text-foreground">
                  ${formatPrice(price)}
                </p>
                <span
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold ${changeBg(change)}`}
                >
                  {formatSignedPercent(change)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WhyGnnDEXSection() {
  const { t } = useTranslation();
  const section = useInView();

  const features = [
    {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      title: t("landing.why.security.title"),
      description: t("landing.why.security.description"),
    },
    {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
      ),
      title: t("landing.why.execution.title"),
      description: t("landing.why.execution.description"),
    },
    {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
      title: t("landing.why.fees.title"),
      description: t("landing.why.fees.description"),
    },
    {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
      title: t("landing.why.support.title"),
      description: t("landing.why.support.description"),
    },
  ];

  return (
    <section
      ref={section.ref as React.RefObject<HTMLDivElement>}
      className="mx-auto max-w-[1440px] px-4 py-20 lg:px-6 lg:py-28"
    >
      <div className="mb-12 text-center">
        <h2
          className={`font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl ${
            section.visible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          {t("landing.why.heading")}
        </h2>
        <p
          className={`mx-auto mt-3 max-w-lg text-muted-foreground ${
            section.visible ? "animate-fade-up [animation-delay:100ms]" : "opacity-0"
          }`}
        >
          {t("landing.why.description")}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feat, i) => (
          <article
            key={i}
            className={`panel-glass group relative overflow-hidden rounded-2xl border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 ${
              section.visible
                ? `animate-fade-up [animation-delay:${150 + i * 100}ms]`
                : "opacity-0"
            }`}
          >
            {/* Gradient border on hover */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
              {feat.icon}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {feat.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feat.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlatformStatsSection() {
  const { t } = useTranslation();
  const section = useInView();

  const stats = [
    { label: t("landing.stats.volume"), value: "$1.2B+", suffix: "" },
    { label: t("landing.stats.traders"), value: "500K+", suffix: "" },
    { label: t("landing.stats.assets"), value: "200+", suffix: "" },
    { label: t("landing.stats.uptime"), value: "99.99", suffix: "%" },
  ];

  return (
    <section
      ref={section.ref as React.RefObject<HTMLDivElement>}
      className="relative overflow-hidden border-y border-border bg-card/50 backdrop-blur-sm"
    >
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute right-1/4 bottom-0 h-48 w-48 rounded-full bg-accent/5 blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 py-16 lg:px-6 lg:py-24">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`text-center ${
                section.visible
                  ? `animate-count-up [animation-delay:${i * 120}ms]`
                  : "opacity-0"
              }`}
            >
              <p className="font-mono text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {stat.value}
                {stat.suffix && (
                  <span className="text-primary">{stat.suffix}</span>
                )}
              </p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSecuritySection() {
  const { t } = useTranslation();
  const section = useInView();

  const securityFeatures = [
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      ),
      title: t("landing.trust.coldStorage.title"),
      description: t("landing.trust.coldStorage.description"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a48.667 48.667 0 0 0 .065 7.092M12 10.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 0V6.89" />
        </svg>
      ),
      title: t("landing.trust.multiSig.title"),
      description: t("landing.trust.multiSig.description"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ),
      title: t("landing.trust.monitoring.title"),
      description: t("landing.trust.monitoring.description"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
      title: t("landing.trust.ddos.title"),
      description: t("landing.trust.ddos.description"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
      title: t("landing.trust.twoFactor.title"),
      description: t("landing.trust.twoFactor.description"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      title: t("landing.trust.audit.title"),
      description: t("landing.trust.audit.description"),
    },
  ];

  return (
    <section
      ref={section.ref as React.RefObject<HTMLDivElement>}
      className="mx-auto max-w-[1440px] px-4 py-20 lg:px-6 lg:py-28"
    >
      <div className="mb-12 text-center">
        <h2
          className={`font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl ${
            section.visible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          {t("landing.trust.heading")}
        </h2>
        <p
          className={`mx-auto mt-3 max-w-lg text-muted-foreground ${
            section.visible ? "animate-fade-up [animation-delay:100ms]" : "opacity-0"
          }`}
        >
          {t("landing.trust.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {securityFeatures.map((feat, i) => (
          <article
            key={i}
            className={`group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:bg-card ${
              section.visible
                ? `animate-fade-up [animation-delay:${150 + i * 80}ms]`
                : "opacity-0"
            }`}
          >
            <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-muted p-2.5 text-primary transition-colors group-hover:bg-primary/10">
              {feat.icon}
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {feat.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {feat.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GetStartedCTA() {
  const { t } = useTranslation();
  const section = useInView();

  return (
    <section
      ref={section.ref as React.RefObject<HTMLDivElement>}
      className="mx-auto max-w-[1440px] px-4 pb-20 lg:px-6 lg:pb-28"
    >
      <div
        className={`relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-10 text-center sm:p-16 lg:p-20 ${
          section.visible ? "animate-fade-up" : "opacity-0"
        }`}
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/6 blur-[80px]" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />
        </div>

        {/* Geometric lines */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[20%] h-20 w-20 rotate-12 rounded-xl border border-primary/10" />
          <div className="absolute right-[10%] bottom-[20%] h-16 w-16 -rotate-12 rounded-lg border border-accent/10" />
        </div>

        <div className="relative">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t("landing.cta.heading")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
            {t("landing.cta.description")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="btn-primary px-10 py-4 text-base shadow-lg shadow-primary/25"
              href="/auth/register"
            >
              {t("landing.cta.create")}
            </Link>
            <Link
              className="btn-ghost px-8 py-4 text-base"
              href="/support"
            >
              {t("landing.cta.talk")}
            </Link>
          </div>
          <p className="mt-6 text-base text-muted-foreground">
            {t("landing.cta.finePrint")}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════ */

export default function HomePage() {
  const { t } = useTranslation();

  /* ── Ticker state ── */
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamRetryInfo, setStreamRetryInfo] = useState<SseRetryInfo | null>(null);
  const [sparklineBySymbol, setSparklineBySymbol] = useState<Record<string, number[]>>({});

  /* ── Load tickers (initial + fallback polling) ── */
  const loadTickers = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) setLoading(true);
      setError("");

      const { data, error: apiError } = await api.GET("/market/tickers", {
        params: {
          query: {
            symbols: FEATURED_SYMBOLS_CSV,
            limit: FEATURED_SYMBOLS.length,
          },
        },
      });

      if (apiError || !data) {
        setRows([]);
        setError(t("landing.error.loadMarket"));
        if (!options?.background) setLoading(false);
        return;
      }

      setRows(toRows(data));
      setLoading(false);
    },
    [t]
  );

  /* Initial load */
  useEffect(() => {
    loadTickers().catch(() => {
      setRows([]);
      setError(t("landing.error.loadMarket"));
      setLoading(false);
    });
  }, [loadTickers, t]);

  /* ── SSE stream ── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const streamUrl = new URL(
      `${apiBaseUrl}/market/stream/tickers`,
      window.location.origin
    );
    streamUrl.searchParams.set("symbols", FEATURED_SYMBOLS_CSV);
    streamUrl.searchParams.set("limit", String(FEATURED_SYMBOLS.length));
    streamUrl.searchParams.set("intervalMs", "3000");

    const controller = new AbortController();
    let isActive = true;

    void streamSseWithBackoff({
      url: streamUrl.toString(),
      signal: controller.signal,
      onOpen: () => {
        if (!isActive) return;
        setStreamConnected(true);
        setStreamRetryInfo(null);
      },
      onData: (rawData) => {
        if (!isActive) return;
        const parsed = parseTickerStreamEvent(rawData);
        if (!parsed) return;
        if (parsed.eventType === "market.ticker.error") {
          const detail =
            parsed.data &&
            !Array.isArray(parsed.data) &&
            typeof parsed.data.message === "string"
              ? parsed.data.message
              : "Stream error";
          setError(detail);
          return;
        }
        setRows(toRows(parsed.data));
        setLoading(false);
      },
      onRetry: (info) => {
        if (!isActive) return;
        setStreamConnected(false);
        setStreamRetryInfo(info);
      },
    }).catch(() => {
      if (isActive) setStreamConnected(false);
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  /* ── Fallback polling when SSE is down ── */
  useEffect(() => {
    if (streamConnected || typeof window === "undefined") return;

    const id = window.setInterval(() => {
      loadTickers({ background: true }).catch(() => {
        setError(t("landing.error.refreshMarket"));
      });
    }, 15000);

    return () => window.clearInterval(id);
  }, [loadTickers, streamConnected, t]);

  /* ── Build display rows ── */
  const displayRows = useMemo(() => {
    const map = new Map(rows.map((r) => [r.symbol, r]));
    return FEATURED_SYMBOLS.map(
      (sym) => map.get(sym) ?? buildPlaceholderRow(sym)
    );
  }, [rows]);

  /* ── Load sparklines ── */
  const sparklineSymbols = useMemo(
    () => displayRows.map((r) => r.symbol),
    [displayRows]
  );
  const sparklineKey = useMemo(
    () => sparklineSymbols.join(","),
    [sparklineSymbols]
  );

  useEffect(() => {
    if (!sparklineKey) return;
    let isMounted = true;

    const loadSparklines = async () => {
      const entries = await Promise.allSettled(
        sparklineSymbols.map(async (symbol) => {
          const { data } = await api.GET("/market/candles", {
            params: {
              query: { symbol, interval: "15m", limit: 24 },
            },
          });
          const candles = Array.isArray(data) ? (data as CandleRow[]) : [];
          const points = candles
            .map((c) => Number(c.close))
            .filter((v) => Number.isFinite(v));
          return [symbol, points] as const;
        })
      );

      if (!isMounted) return;

      const next: Record<string, number[]> = {};
      for (const entry of entries) {
        if (entry.status === "fulfilled") {
          next[entry.value[0]] = entry.value[1];
        }
      }
      setSparklineBySymbol(next);
    };

    void loadSparklines();
    const id = window.setInterval(() => {
      void loadSparklines();
    }, 120000);

    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, [sparklineKey, sparklineSymbols]);

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */

  return (
    <main className="w-full">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Live Ticker Strip */}
      <LiveTickerStrip
        rows={displayRows}
        loading={loading}
        streamRetryInfo={streamRetryInfo}
      />

      {/* Error banner */}
      {error ? (
        <div className="mx-auto max-w-[1440px] px-4 pt-6 lg:px-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : null}

      {/* 3. Featured Markets */}
      <FeaturedMarketsGrid rows={displayRows} sparklines={sparklineBySymbol} />

      {/* 4. Why GnnDEX */}
      <WhyGnnDEXSection />

      {/* 5. Platform Stats */}
      <PlatformStatsSection />

      {/* 6. Trust & Security */}
      <TrustSecuritySection />

      {/* 7. Get Started CTA */}
      <GetStartedCTA />
    </main>
  );
}
