"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { StreamReconnectNotice } from "@/components/stream-reconnect-notice";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { useTranslation } from "@/i18n/locale-context";
import { LISTED_MARKET_SYMBOLS, LISTED_MARKET_SYMBOLS_CSV } from "@/lib/listed-markets";
import { api, apiBaseUrl } from "@/lib/api";
import { getSiteUrl } from "@/lib/site-url";
import { streamSseWithBackoff, type SseRetryInfo } from "@/lib/sse-stream";

/* ─── Types ─────────────────────────────────────────────── */

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

type SortKey = "symbol" | "lastPrice" | "changePercent24h" | "highPrice24h" | "lowPrice24h" | "volume24h";
type SortDir = "asc" | "desc";
type TabFilter = "all" | "favorites" | "gainers" | "losers";

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XRP: "Ripple",
  SBK: "SBK Token",
  G99: "G99 Token",
  USDT: "Tether",
};

/* ─── Utilities ─────────────────────────────────────────── */

function toTickerRows(payload: unknown): TickerRow[] {
  return Array.isArray(payload) ? (payload as TickerRow[]) : [];
}

function parseTickerStreamEvent(raw: string): TickerStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TickerStreamEvent>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.eventType !== "market.ticker.snapshot" && parsed.eventType !== "market.ticker.error") return null;
    return parsed as TickerStreamEvent;
  } catch {
    return null;
  }
}

function formatPrice(input: string | null, maxDigits = 6): string {
  if (!input) return "--";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  if (num >= 1000) return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDigits });
}

function formatVolume(input: string | null): string {
  if (!input) return "--";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(input: string | null): string {
  if (!input) return "--";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  const fixed = num.toFixed(2);
  return `${num >= 0 ? "+" : ""}${fixed}%`;
}

function toNumber(input: string | null): number | null {
  if (!input) return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function parseApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as { error?: string; message?: string };
  return e.message ?? e.error ?? fallback;
}

function coinBase(symbol: string): string {
  return symbol.split("-")[0];
}

function coinName(symbol: string): string {
  const base = coinBase(symbol);
  return COIN_NAMES[base] ?? base;
}

const FAVORITES_KEY = "gnndex.market.favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(set: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
  } catch {
    /* noop */
  }
}

const siteUrl = getSiteUrl();

/* ─── Sort Arrow SVG ────────────────────────────────────── */

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      className={`ml-1 inline-block shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground/30"}`}
      fill="currentColor"
    >
      <path
        d="M5 0L9.33 5.5H0.67L5 0Z"
        className={active && dir === "asc" ? "text-primary" : "text-muted-foreground/20"}
        fill="currentColor"
      />
      <path
        d="M5 14L0.67 8.5H9.33L5 14Z"
        className={active && dir === "desc" ? "text-primary" : "text-muted-foreground/20"}
        fill="currentColor"
      />
    </svg>
  );
}

/* ─── Star Icon ─────────────────────────────────────────── */

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

/* ─── Search Icon ───────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ─── Mini Sparkline (change indicator) ─────────────────── */

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">--</span>;
  const isUp = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${isUp ? "text-up" : "text-down"}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={isUp ? "" : "rotate-180"}>
        <path d="M6 2L10 8H2L6 2Z" />
      </svg>
      {formatPercent(String(value))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Markets Page
   ═══════════════════════════════════════════════════════════ */

export default function MarketsPage() {
  const { t } = useTranslation();

  /* ── State ── */
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamRetryInfo, setStreamRetryInfo] = useState<SseRetryInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Data loading ── */
  const loadTickers = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) setLoading(true);
    setError("");

    const { data, error: apiError } = await api.GET("/market/tickers", {
      params: { query: { symbols: LISTED_MARKET_SYMBOLS_CSV, limit: LISTED_MARKET_SYMBOLS.length } }
    });

    if (apiError || !data) {
      setRows([]);
      setError(parseApiError(apiError, t("markets.loadFailed")));
      if (!options?.background) setLoading(false);
      return;
    }

    setRows(toTickerRows(data));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    loadTickers().catch(() => {
      setLoading(false);
      setError(t("markets.loadFailed"));
    });
  }, [loadTickers]);

  /* ── SSE streaming ── */
  useEffect(() => {
    if (typeof window === "undefined") {
      setStreamConnected(false);
      return;
    }

    const streamUrl = new URL(`${apiBaseUrl}/market/stream/tickers`, window.location.origin);
    streamUrl.searchParams.set("symbols", LISTED_MARKET_SYMBOLS_CSV);
    streamUrl.searchParams.set("limit", String(LISTED_MARKET_SYMBOLS.length));
    streamUrl.searchParams.set("intervalMs", "3000");

    const controller = new AbortController();
    let isActive = true;

    async function startStream() {
      try {
        await streamSseWithBackoff({
          url: streamUrl.toString(),
          signal: controller.signal,
          onOpen: () => {
            if (!isActive) return;
            setStreamConnected(true);
            setStreamRetryInfo(null);
            setError("");
          },
          onData: (rawData) => {
            if (!isActive) return;
            const payload = parseTickerStreamEvent(rawData);
            if (!payload) return;
            if (payload.eventType === "market.ticker.error") {
              const detail = payload.data && !Array.isArray(payload.data) && typeof payload.data.message === "string"
                ? payload.data.message
                : t("markets.streamError");
              setError(detail);
              return;
            }
            if (Array.isArray(payload.data)) {
              setRows(payload.data);
              setLoading(false);
            }
          },
          onRetry: (info) => {
            if (!isActive) return;
            setStreamConnected(false);
            setStreamRetryInfo(info);
          }
        });
      } catch {
        if (isActive) setStreamConnected(false);
      }
    }

    void startStream();
    return () => { isActive = false; controller.abort(); };
  }, []);

  /* ── Polling fallback ── */
  useEffect(() => {
    if (streamConnected) return;
    const id = window.setInterval(() => {
      loadTickers({ background: true }).catch(() => setError(t("markets.refreshFailed")));
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadTickers, streamConnected]);

  /* ── Favorites toggle ── */
  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      saveFavorites(next);
      return next;
    });
  }, []);

  /* ── Sort handler ── */
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("desc");
      }
      return key;
    });
  }, []);

  /* ── Derived: top movers ── */
  const { gainers, losers } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (toNumber(b.changePercent24h) ?? -999) - (toNumber(a.changePercent24h) ?? -999));
    return {
      gainers: sorted.filter((r) => (toNumber(r.changePercent24h) ?? 0) > 0).slice(0, 3),
      losers: sorted.filter((r) => (toNumber(r.changePercent24h) ?? 0) < 0).slice(0, 3).reverse()
    };
  }, [rows]);

  /* ── Derived: filtered & sorted rows ── */
  const displayRows = useMemo(() => {
    let filtered = [...rows];

    // tab filter
    if (activeTab === "favorites") {
      filtered = filtered.filter((r) => favorites.has(r.symbol));
    } else if (activeTab === "gainers") {
      filtered = filtered.filter((r) => (toNumber(r.changePercent24h) ?? 0) > 0);
    } else if (activeTab === "losers") {
      filtered = filtered.filter((r) => (toNumber(r.changePercent24h) ?? 0) < 0);
    }

    // search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          coinName(r.symbol).toLowerCase().includes(q) ||
          coinBase(r.symbol).toLowerCase().includes(q)
      );
    }

    // sort
    filtered.sort((a, b) => {
      let av: number;
      let bv: number;
      switch (sortKey) {
        case "symbol":
          return sortDir === "asc" ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
        case "lastPrice":
          av = toNumber(a.lastPrice) ?? 0;
          bv = toNumber(b.lastPrice) ?? 0;
          break;
        case "changePercent24h":
          av = toNumber(a.changePercent24h) ?? 0;
          bv = toNumber(b.changePercent24h) ?? 0;
          break;
        case "highPrice24h":
          av = toNumber(a.highPrice24h) ?? 0;
          bv = toNumber(b.highPrice24h) ?? 0;
          break;
        case "lowPrice24h":
          av = toNumber(a.lowPrice24h) ?? 0;
          bv = toNumber(b.lowPrice24h) ?? 0;
          break;
        case "volume24h":
          av = toNumber(a.volume24h) ?? 0;
          bv = toNumber(b.volume24h) ?? 0;
          break;
        default:
          return 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return filtered;
  }, [rows, activeTab, favorites, searchQuery, sortKey, sortDir]);

  /* ── JSON-LD ── */
  const marketsJsonLd = useMemo(() => {
    const itemList = rows.slice(0, 20).map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: row.symbol,
      url: `${siteUrl}/trade?symbol=${encodeURIComponent(row.symbol)}`
    }));
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${siteUrl}/markets#webpage`,
          url: `${siteUrl}/markets`,
          name: "Markets | GnnDEX",
          description: "Real-time cryptocurrency prices, 24h changes, and trading volumes.",
          inLanguage: "en"
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Markets", item: `${siteUrl}/markets` }
          ]
        },
        { "@type": "ItemList", name: "GnnDEX Market List", itemListOrder: "https://schema.org/ItemListOrderDescending", numberOfItems: itemList.length, itemListElement: itemList }
      ]
    };
  }, [rows]);

  const hasRows = rows.length > 0;

  /* ── Column header helper ── */
  const ColHeader = ({ label, sortKeyValue, align = "right" }: { label: string; sortKeyValue: SortKey; align?: "left" | "right" }) => (
    <th
      className={`cursor-pointer select-none px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground ${align === "left" ? "text-left" : "text-right"}`}
      onClick={() => handleSort(sortKeyValue)}
    >
      <span className="inline-flex items-center gap-0.5">
        {align === "right" && <SortArrow active={sortKey === sortKeyValue} dir={sortDir} />}
        {label}
        {align === "left" && <SortArrow active={sortKey === sortKeyValue} dir={sortDir} />}
      </span>
    </th>
  );

  /* ── Tab definition ── */
  const TABS: Array<{ key: TabFilter; label: string; icon?: string }> = [
    { key: "all", label: t("markets.allMarkets") },
    { key: "favorites", label: t("markets.favorites") },
    { key: "gainers", label: t("markets.gainers") },
    { key: "losers", label: t("markets.losers") }
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-8 lg:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketsJsonLd) }} />

      {/* ── Page Header ──────────────────────────────────── */}
      <section className="animate-fade-up">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {t("markets.title")}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
              {t("markets.description")}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <SearchIcon />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("markets.searchPlaceholder")}
              className="input-field pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Stream status */}
        <div className="mt-3 flex items-center gap-3">
          <StreamStatusBadge connected={streamConnected} />
          <StreamReconnectNotice retryInfo={streamRetryInfo} />
        </div>
      </section>

      {/* ── Top Movers ───────────────────────────────────── */}
      {hasRows && !loading && (
        <section className="animate-fade-up grid gap-4 md:grid-cols-2" style={{ animationDelay: "80ms" }}>
          {/* Gainers */}
          <div className="panel-glass">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15">
                <svg width="14" height="14" viewBox="0 0 12 12" fill="hsl(var(--exchange-up))"><path d="M6 1L11 8H1L6 1Z" /></svg>
              </span>
              <h2 className="text-sm font-semibold text-foreground">{t("markets.topGainers")}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {gainers.length === 0 && <p className="text-xs text-muted-foreground">{t("markets.noGainers")}</p>}
              {gainers.map((row) => {
                const change = toNumber(row.changePercent24h);
                return (
                  <Link
                    key={row.symbol}
                    href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
                    className="group flex min-w-[160px] flex-1 items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <CoinIcon symbol={coinBase(row.symbol)} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{coinBase(row.symbol)}</p>
                      <p className="font-[var(--font-mono)] text-xs text-muted-foreground">${formatPrice(row.lastPrice, 4)}</p>
                    </div>
                    <span className="rounded-md bg-emerald-500/12 px-2 py-1 font-[var(--font-mono)] text-xs font-semibold text-up">
                      {formatPercent(row.changePercent24h)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Losers */}
          <div className="panel-glass">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/15">
                <svg width="14" height="14" viewBox="0 0 12 12" fill="hsl(var(--exchange-sell))" className="rotate-180"><path d="M6 1L11 8H1L6 1Z" /></svg>
              </span>
              <h2 className="text-sm font-semibold text-foreground">{t("markets.topLosers")}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {losers.length === 0 && <p className="text-xs text-muted-foreground">{t("markets.noLosers")}</p>}
              {losers.map((row) => (
                <Link
                  key={row.symbol}
                  href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
                  className="group flex min-w-[160px] flex-1 items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <CoinIcon symbol={coinBase(row.symbol)} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{coinBase(row.symbol)}</p>
                    <p className="font-[var(--font-mono)] text-xs text-muted-foreground">${formatPrice(row.lastPrice, 4)}</p>
                  </div>
                  <span className="rounded-md bg-rose-500/12 px-2 py-1 font-[var(--font-mono)] text-xs font-semibold text-down">
                    {formatPercent(row.changePercent24h)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Error Banner ─────────────────────────────────── */}
      {error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </section>
      )}

      {/* ── Category Tabs + Table ────────────────────────── */}
      <section className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "160ms" }}>
        {/* Tab Bar */}
        <div className="flex items-center justify-between border-b border-border px-4">
          <nav className="flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.key === "favorites" && <StarIcon filled={activeTab === "favorites"} className="h-3.5 w-3.5 text-gold" />}
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </nav>
          <span className="hidden text-xs text-muted-foreground lg:block">
            {displayRows.length} {displayRows.length !== 1 ? t("markets.assetsCount") : t("markets.assetCount")}
          </span>
        </div>

        {/* Loading skeleton */}
        {loading && !hasRows && (
          <div className="space-y-0 divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="hidden h-4 w-16 animate-pulse rounded bg-muted md:block" />
                <div className="hidden h-4 w-16 animate-pulse rounded bg-muted md:block" />
                <div className="hidden h-4 w-20 animate-pulse rounded bg-muted lg:block" />
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {(!loading || hasRows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <ColHeader label={t("markets.asset")} sortKeyValue="symbol" align="left" />
                  <ColHeader label={t("markets.price")} sortKeyValue="lastPrice" />
                  <ColHeader label={t("markets.24hChange")} sortKeyValue="changePercent24h" />
                  <th className="hidden px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    <span className="cursor-pointer transition-colors hover:text-foreground" onClick={() => handleSort("highPrice24h")}>
                      {t("markets.24hHigh")} <SortArrow active={sortKey === "highPrice24h"} dir={sortDir} />
                    </span>
                  </th>
                  <th className="hidden px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    <span className="cursor-pointer transition-colors hover:text-foreground" onClick={() => handleSort("lowPrice24h")}>
                      {t("markets.24hLow")} <SortArrow active={sortKey === "lowPrice24h"} dir={sortDir} />
                    </span>
                  </th>
                  <ColHeader label={t("markets.volume")} sortKeyValue="volume24h" />
                  <th className="hidden px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                    {t("markets.action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="mx-auto max-w-xs">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted-foreground/40">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p className="mt-3 text-sm font-medium text-muted-foreground">
                          {activeTab === "favorites" ? t("markets.noFavorites") : t("markets.noMatching")}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {displayRows.map((row, index) => {
                  const change = toNumber(row.changePercent24h);
                  const isFav = favorites.has(row.symbol);
                  return (
                    <tr
                      key={row.symbol}
                      className="group transition-colors hover:bg-muted/40"
                    >
                      {/* # */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(row.symbol)}
                          className="transition-transform hover:scale-110"
                          aria-label={isFav ? `Remove ${row.symbol} from favorites` : `Add ${row.symbol} to favorites`}
                        >
                          <StarIcon filled={isFav} className={`h-4 w-4 ${isFav ? "text-gold" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"}`} />
                        </button>
                      </td>

                      {/* Asset */}
                      <td className="px-4 py-3.5">
                        <Link href={`/trade?symbol=${encodeURIComponent(row.symbol)}`} className="flex items-center gap-3">
                          <CoinIcon symbol={coinBase(row.symbol)} size="lg" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{coinName(row.symbol)}</p>
                            <p className="text-xs text-muted-foreground">{row.symbol}</p>
                          </div>
                        </Link>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-medium text-foreground">
                        ${formatPrice(row.lastPrice)}
                      </td>

                      {/* 24h Change */}
                      <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm">
                        <ChangeIndicator value={change} />
                      </td>

                      {/* 24h High */}
                      <td className="hidden px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-muted-foreground md:table-cell">
                        ${formatPrice(row.highPrice24h)}
                      </td>

                      {/* 24h Low */}
                      <td className="hidden px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-muted-foreground md:table-cell">
                        ${formatPrice(row.lowPrice24h)}
                      </td>

                      {/* Volume */}
                      <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-muted-foreground">
                        ${formatVolume(row.volume24h)}
                      </td>

                      {/* Trade button */}
                      <td className="hidden px-4 py-3.5 text-center lg:table-cell">
                        <Link
                          href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
                          className="btn-primary !px-4 !py-1.5 !text-xs !shadow-none"
                        >
                          {t("markets.trade")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
