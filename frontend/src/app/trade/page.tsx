"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { StreamReconnectNotice } from "@/components/stream-reconnect-notice";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { TradingViewChart } from "@/components/tradingview-chart";
import { getStoredAccessToken } from "@/features/auth/auth-storage";
import { useAuth } from "@/features/auth/auth-context";
import { useTranslation } from "@/i18n/locale-context";
import { LISTED_MARKET_SYMBOLS, LISTED_MARKET_SYMBOLS_CSV } from "@/lib/listed-markets";
import { api, apiBaseUrl } from "@/lib/api";
import { getSiteUrl } from "@/lib/site-url";
import { streamSseWithBackoff, type SseRetryInfo } from "@/lib/sse-stream";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type OrderbookLevel = { price: string; quantity: string };
type OrderbookPayload = {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  updatedAt: string;
};

type CandleRow = {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

type MyOrderRow = {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  price: string | null;
  quantity: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "NOT_FOUND";
  createdAt?: string;
};

type OrdersListPayload = {
  items?: MyOrderRow[];
  page?: number;
  limit?: number;
  total?: number;
};

type OrdersStreamEvent = {
  eventId: string;
  eventType: "user.orders.snapshot" | "user.orders.error";
  eventVersion: number;
  occurredAt: string;
  data: OrdersListPayload | { message?: string };
};

type MarketTickerRow = {
  symbol: string;
  lastPrice: string | null;
  changePercent24h: string | null;
  volume24h: string;
};

type BalanceRow = {
  asset: string;
  available: string;
  locked: string;
};

type TradingRules = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  minOrderNotional: string;
  makerFeeRatePct: string;
  takerFeeRatePct: string;
  vatRatePct: string;
  makerFeeRatePctInclVat: string;
  takerFeeRatePctInclVat: string;
};

type OrderHistoryTab = "OPEN" | "COMPLETED" | "ALL";
type OrderType = "LIMIT" | "MARKET" | "STOP_LIMIT";

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

const ORDER_LIMIT_OPTIONS = [10, 20, 50] as const;
const ORDER_STATUS_OPTIONS = [
  "ALL", "NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED"
] as const;
const ORDER_SIDE_OPTIONS = ["ALL", "BUY", "SELL"] as const;
const ORDER_TYPE_OPTIONS = ["ALL", "MARKET", "LIMIT", "STOP_LIMIT"] as const;
const ORDER_SORT_BY_OPTIONS = ["CREATED_AT", "PRICE", "QUANTITY"] as const;
const ORDER_SORT_ORDER_OPTIONS = ["DESC", "ASC"] as const;
const PERCENT_PRESETS = [10, 25, 50, 100] as const;
const ORDERBOOK_LEVEL_LIMIT = 13;
const siteUrl = getSiteUrl();

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function fmt(input: string | null | undefined, maxFrac = 8): string {
  if (!input) return "-";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxFrac });
}

function fmtFixed(input: string | null | undefined, frac = 2): string {
  if (!input) return "-";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  return num.toLocaleString(undefined, { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fmtCompact(input: string | null | undefined): string {
  if (!input) return "-";
  const num = Number(input);
  if (!Number.isFinite(num)) return input;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

function toNum(input: string | null | undefined): number | null {
  if (!input) return null;
  const v = Number(input);
  return Number.isFinite(v) ? v : null;
}

function signPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function parseErr(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object") return fallback;
  const p = input as { message?: string | string[]; error?: string };
  if (Array.isArray(p.message) && p.message.length > 0) return p.message.join(", ");
  if (typeof p.message === "string" && p.message.length > 0) return p.message;
  return p.error ?? fallback;
}

function toIso(raw: string): string | undefined {
  if (!raw.trim()) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parseOrdersEvent(raw: string): OrdersStreamEvent | null {
  try {
    const p = JSON.parse(raw) as Partial<OrdersStreamEvent>;
    if (!p || typeof p !== "object") return null;
    if (p.eventType !== "user.orders.snapshot" && p.eventType !== "user.orders.error") return null;
    return p as OrdersStreamEvent;
  } catch { return null; }
}

function isSupported(v: string): v is (typeof LISTED_MARKET_SYMBOLS)[number] {
  return LISTED_MARKET_SYMBOLS.some((s) => s === v);
}

function split(v: string): { base: string; quote: string } {
  const [base, quote] = v.split("-");
  return { base: base || v, quote: quote || "" };
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════════ */

export default function TradePage() {
  const { isReady, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  /* ─── Market state ─── */
  const [symbol, setSymbol] = useState<string>(LISTED_MARKET_SYMBOLS[0]);
  const [orderbook, setOrderbook] = useState<OrderbookPayload | null>(null);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketRows, setMarketRows] = useState<MarketTickerRow[]>([]);
  const [marketListLoading, setMarketListLoading] = useState(false);
  const [marketListError, setMarketListError] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [marketTab, setMarketTab] = useState<"FAVORITES" | "ALL">("ALL");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  /* ─── Order form state ─── */
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [buyPctSelected, setBuyPctSelected] = useState<number | null>(null);
  const [sellPctSelected, setSellPctSelected] = useState<number | null>(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [tradingRules, setTradingRules] = useState<TradingRules | null>(null);
  const [tradingRulesLoading, setTradingRulesLoading] = useState(false);

  /* ─── Orders state ─── */
  const [myOrders, setMyOrders] = useState<MyOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersStreamConnected, setOrdersStreamConnected] = useState(false);
  const [ordersStreamRetryInfo, setOrdersStreamRetryInfo] = useState<SseRetryInfo | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState<(typeof ORDER_LIMIT_OPTIONS)[number]>(10);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState<(typeof ORDER_STATUS_OPTIONS)[number]>("ALL");
  const [orderSideFilter, setOrderSideFilter] = useState<(typeof ORDER_SIDE_OPTIONS)[number]>("ALL");
  const [orderTypeFilter, setOrderTypeFilter] = useState<(typeof ORDER_TYPE_OPTIONS)[number]>("ALL");
  const [orderSortBy, setOrderSortBy] = useState<(typeof ORDER_SORT_BY_OPTIONS)[number]>("CREATED_AT");
  const [orderSortOrder, setOrderSortOrder] = useState<(typeof ORDER_SORT_ORDER_OPTIONS)[number]>("DESC");
  const [orderFromCreatedAt, setOrderFromCreatedAt] = useState("");
  const [orderToCreatedAt, setOrderToCreatedAt] = useState("");
  const [historyTab, setHistoryTab] = useState<OrderHistoryTab>("OPEN");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const orderHistoryRef = useRef<HTMLDivElement>(null);
  const buyQuantityInputRef = useRef<HTMLInputElement>(null);
  const sellQuantityInputRef = useRef<HTMLInputElement>(null);

  /* ═══════════════════════════════════════════════════════════════
     Data Loading
     ═══════════════════════════════════════════════════════════════ */

  const loadMarketData = useCallback(async () => {
    setMarketLoading(true);
    setMarketError("");
    const [obRes, cdRes] = await Promise.all([
      api.GET("/market/orderbook/{symbol}", { params: { path: { symbol }, query: { limit: ORDERBOOK_LEVEL_LIMIT } } }),
      api.GET("/market/candles", { params: { query: { symbol, interval: "1m", limit: 24 } } }),
    ]);
    if (obRes.error || !obRes.data || cdRes.error || !cdRes.data) {
      setOrderbook(null);
      setCandles([]);
      setMarketError(parseErr(obRes.error ?? cdRes.error, t("trade.loadFailed")));
      setMarketLoading(false);
      return;
    }
    setOrderbook(obRes.data as OrderbookPayload);
    setCandles(Array.isArray(cdRes.data) ? (cdRes.data as CandleRow[]) : []);
    setMarketLoading(false);
  }, [symbol, t]);

  const loadMarketList = useCallback(async () => {
    setMarketListLoading(true);
    setMarketListError("");
    const { data, error } = await api.GET("/market/tickers", {
      params: { query: { symbols: LISTED_MARKET_SYMBOLS_CSV, limit: LISTED_MARKET_SYMBOLS.length } },
    });
    setMarketListLoading(false);
    if (error || !data) {
      setMarketRows([]);
      setMarketListError(parseErr(error, t("trade.tickerFailed")));
      return;
    }
    setMarketRows(Array.isArray(data) ? (data as MarketTickerRow[]) : []);
  }, [t]);

  const buildOrdersQuery = useCallback(
    (page: number) => ({
      page,
      limit: ordersLimit,
      symbol,
      status: orderStatusFilter !== "ALL" ? orderStatusFilter : undefined,
      side: orderSideFilter !== "ALL" ? orderSideFilter : undefined,
      type: orderTypeFilter !== "ALL" ? orderTypeFilter : undefined,
      fromCreatedAt: toIso(orderFromCreatedAt),
      toCreatedAt: toIso(orderToCreatedAt),
      sortBy: orderSortBy,
      sortOrder: orderSortOrder,
    }),
    [orderFromCreatedAt, orderSideFilter, orderStatusFilter, orderSortBy, orderSortOrder, orderToCreatedAt, orderTypeFilter, ordersLimit, symbol]
  );

  const applyOrdersPayload = useCallback(
    (payload: OrdersListPayload | MyOrderRow[], fallbackPage: number) => {
      const rows = Array.isArray(payload)
        ? (payload as MyOrderRow[])
        : Array.isArray(payload.items) ? payload.items : [];
      setMyOrders(rows);
      setOrdersPage(Array.isArray(payload) ? fallbackPage : (payload.page ?? fallbackPage));
      setOrdersTotal(Array.isArray(payload) ? rows.length : (payload.total ?? rows.length));
    },
    []
  );

  const loadMyOrders = useCallback(async (page: number) => {
    if (!isAuthenticated) {
      setMyOrders([]);
      setOrdersTotal(0);
      setOrdersPage(1);
      return;
    }
    if (page < 1) return;
    setOrdersLoading(true);
    const { data, error } = await api.GET("/orders", { params: { query: buildOrdersQuery(page) } });
    setOrdersLoading(false);
    if (error || !data) {
      setOrderMessage(parseErr(error, t("trade.ordersFailed")));
      return;
    }
    applyOrdersPayload(data as OrdersListPayload | MyOrderRow[], page);
  }, [applyOrdersPayload, buildOrdersQuery, isAuthenticated, t]);

  const loadBalances = useCallback(async () => {
    if (!isAuthenticated) {
      setBalances([]);
      return;
    }
    setBalancesLoading(true);
    const { data, error } = await api.GET("/wallet/balances");
    setBalancesLoading(false);
    if (error || !data) return;
    setBalances(Array.isArray(data) ? (data as BalanceRow[]) : []);
  }, [isAuthenticated]);

  const loadTradingRules = useCallback(async () => {
    setTradingRulesLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/market/trading-rules/${encodeURIComponent(symbol)}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        setTradingRules(null);
        setTradingRulesLoading(false);
        return;
      }
      const payload = (await response.json()) as TradingRules;
      setTradingRules(payload);
      setTradingRulesLoading(false);
    } catch {
      setTradingRules(null);
      setTradingRulesLoading(false);
    }
  }, [symbol]);

  /* ─── Effects ─── */

  useEffect(() => {
    loadMarketData().catch(() => { setMarketLoading(false); setMarketError(t("trade.loadFailed")); });
  }, [loadMarketData]);

  useEffect(() => {
    loadTradingRules().catch(() => {
      setTradingRules(null);
      setTradingRulesLoading(false);
    });
  }, [loadTradingRules]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadMarketData().catch(() => setMarketError(t("trade.refreshFailed")));
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadMarketData]);

  useEffect(() => {
    loadMarketList().catch(() => setMarketListError(t("trade.tickerFailed")));
  }, [loadMarketList]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadMarketList().catch(() => setMarketListError(t("trade.tickerRefreshFailed")));
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadMarketList]);

  useEffect(() => {
    loadMyOrders(1).catch(() => setOrderMessage(t("trade.ordersFailed")));
  }, [loadMyOrders]);

  useEffect(() => {
    loadBalances().catch(() => {
      setBalances([]);
      setBalancesLoading(false);
    });
  }, [loadBalances]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      loadBalances().catch(() => {
        setBalances([]);
        setBalancesLoading(false);
      });
    }, 15000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadBalances]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search).get("symbol");
    if (qs && isSupported(qs)) setSymbol(qs);
  }, []);

  /* ─── Favorites persistence ─── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gnndex_favorites");
      if (stored) setFavorites(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, []);

  /* ─── Orders SSE stream ─── */
  useEffect(() => {
    if (!isAuthenticated) {
      setOrdersStreamConnected(false);
      setOrdersStreamRetryInfo(null);
      return;
    }
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setOrdersStreamConnected(false);
      setOrdersStreamRetryInfo(null);
      return;
    }
    const query = buildOrdersQuery(ordersPage);
    const url = new URL(`${apiBaseUrl}/orders/stream`, window.location.origin);
    for (const [k, v] of Object.entries({ ...query, intervalMs: 5000 })) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
    const ctrl = new AbortController();
    let active = true;
    async function go() {
      try {
        await streamSseWithBackoff({
          url: url.toString(),
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: ctrl.signal,
          onOpen: () => { if (active) { setOrdersStreamConnected(true); setOrdersStreamRetryInfo(null); } },
          onData: (raw) => {
            if (!active) return;
            const ev = parseOrdersEvent(raw);
            if (!ev) return;
            if (ev.eventType === "user.orders.error") {
              const d = ev.data as { message?: string };
              setOrderMessage(typeof d.message === "string" ? d.message : t("trade.streamError"));
              return;
            }
            const snap = ev.data as OrdersListPayload;
            if (Array.isArray(snap.items)) { applyOrdersPayload(snap, query.page); setOrdersLoading(false); }
          },
          onRetry: (info) => { if (active) { setOrdersStreamConnected(false); setOrdersStreamRetryInfo(info); } },
        });
      } catch { if (active) setOrdersStreamConnected(false); }
      finally { if (active) setOrdersStreamConnected(false); }
    }
    void go();
    return () => { active = false; ctrl.abort(); setOrdersStreamConnected(false); setOrdersStreamRetryInfo(null); };
  }, [applyOrdersPayload, buildOrdersQuery, isAuthenticated, ordersPage]);

  useEffect(() => {
    if (!isAuthenticated || ordersStreamConnected) return;
    const id = window.setInterval(() => {
      loadMyOrders(ordersPage).catch(() => setOrderMessage(t("trade.orderRefreshFailed")));
    }, 15000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadMyOrders, ordersPage, ordersStreamConnected]);

  /* ─── Click outside to close dropdown ─── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     Derived Data
     ═══════════════════════════════════════════════════════════════ */

  const pair = useMemo(() => split(symbol), [symbol]);
  const latestCandle = useMemo(() => candles[candles.length - 1] ?? null, [candles]);
  const selectedTicker = useMemo(
    () => marketRows.find((r) => r.symbol === symbol) ?? null,
    [marketRows, symbol]
  );

  const currentPrice = useMemo(() => {
    return selectedTicker?.lastPrice ?? latestCandle?.close ?? null;
  }, [selectedTicker, latestCandle]);

  const change24h = useMemo(() => toNum(selectedTicker?.changePercent24h), [selectedTicker]);
  const isPositive = (change24h ?? 0) >= 0;

  /* Orderbook computations */
  const askLevels = useMemo(() => {
    return (orderbook?.asks ?? []).slice(0, ORDERBOOK_LEVEL_LIMIT).map((l) => ({
      price: toNum(l.price),
      qty: toNum(l.quantity) ?? 0,
    }));
  }, [orderbook?.asks]);

  const bidLevels = useMemo(() => {
    return (orderbook?.bids ?? []).slice(0, ORDERBOOK_LEVEL_LIMIT).map((l) => ({
      price: toNum(l.price),
      qty: toNum(l.quantity) ?? 0,
    }));
  }, [orderbook?.bids]);

  const maxAskQty = useMemo(() => Math.max(1, ...askLevels.map((l) => l.qty)), [askLevels]);
  const maxBidQty = useMemo(() => Math.max(1, ...bidLevels.map((l) => l.qty)), [bidLevels]);
  const askDisplayLevels = useMemo(() => {
    const levels = [...askLevels].reverse();
    if (levels.length >= ORDERBOOK_LEVEL_LIMIT) return levels;
    return [...levels, ...Array.from({ length: ORDERBOOK_LEVEL_LIMIT - levels.length }, () => null)];
  }, [askLevels]);
  const bidDisplayLevels = useMemo(() => {
    if (bidLevels.length >= ORDERBOOK_LEVEL_LIMIT) return bidLevels;
    return [...bidLevels, ...Array.from({ length: ORDERBOOK_LEVEL_LIMIT - bidLevels.length }, () => null)];
  }, [bidLevels]);

  const totalBidDepth = useMemo(
    () => bidLevels.reduce((s, l) => s + l.qty, 0), [bidLevels]
  );
  const totalAskDepth = useMemo(
    () => askLevels.reduce((s, l) => s + l.qty, 0), [askLevels]
  );
  const spreadValue = useMemo(() => {
    const b = bidLevels[0]?.price;
    const a = askLevels[0]?.price;
    if (b === null || a === null || b === undefined || a === undefined) return null;
    return a - b;
  }, [askLevels, bidLevels]);

  const spreadPct = useMemo(() => {
    if (spreadValue === null) return null;
    const mid = askLevels[0]?.price;
    if (!mid || mid === 0) return null;
    return (spreadValue / mid) * 100;
  }, [spreadValue, askLevels]);
  const depthTotal = useMemo(() => totalBidDepth + totalAskDepth, [totalAskDepth, totalBidDepth]);
  const bidDepthPct = useMemo(
    () => (depthTotal > 0 ? (totalBidDepth / depthTotal) * 100 : 50),
    [depthTotal, totalBidDepth]
  );
  const askDepthPct = useMemo(
    () => (depthTotal > 0 ? (totalAskDepth / depthTotal) * 100 : 50),
    [depthTotal, totalAskDepth]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Math.max(ordersTotal, 0) / ordersLimit)),
    [ordersLimit, ordersTotal]
  );

  const filteredMarkets = useMemo(() => {
    const q = marketSearch.trim().toUpperCase();
    return marketRows.filter((r) => {
      const p = split(r.symbol);
      if (p.quote !== "USDT") return false;
      if (!q) return true;
      return r.symbol.includes(q) || p.base.includes(q);
    });
  }, [marketRows, marketSearch]);

  const favoriteMarkets = useMemo(() => {
    return filteredMarkets.filter((r) => favorites.has(r.symbol));
  }, [favorites, filteredMarkets]);

  /* Filter orders by tab */
  const filteredOrders = useMemo(() => {
    if (historyTab === "OPEN") return myOrders.filter((o) => o.status === "NEW" || o.status === "PARTIALLY_FILLED");
    if (historyTab === "COMPLETED") return myOrders.filter((o) => o.status === "FILLED" || o.status === "CANCELED" || o.status === "REJECTED");
    return myOrders;
  }, [myOrders, historyTab]);

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of balances) {
      map.set(row.asset.toUpperCase(), toNum(row.available) ?? 0);
    }
    return map;
  }, [balances]);

  const availableQuote = useMemo(
    () => balanceMap.get((pair.quote || "").toUpperCase()) ?? 0,
    [balanceMap, pair.quote]
  );
  const availableBase = useMemo(
    () => balanceMap.get(pair.base.toUpperCase()) ?? 0,
    [balanceMap, pair.base]
  );

  const effectivePrice = useMemo(() => {
    if (orderType === "MARKET") {
      const current = toNum(currentPrice);
      return current && current > 0 ? current : null;
    }
    const p = toNum(price);
    if (p && p > 0) return p;
    const current = toNum(currentPrice);
    return current && current > 0 ? current : null;
  }, [currentPrice, orderType, price]);

  const buyQuantityNum = useMemo(() => {
    const q = toNum(buyQuantity);
    return q && q > 0 ? q : 0;
  }, [buyQuantity]);

  const sellQuantityNum = useMemo(() => {
    const q = toNum(sellQuantity);
    return q && q > 0 ? q : 0;
  }, [sellQuantity]);

  const buyEstimatedTotal = useMemo(() => {
    if (!effectivePrice || !buyQuantityNum) return 0;
    return effectivePrice * buyQuantityNum;
  }, [effectivePrice, buyQuantityNum]);

  const sellEstimatedTotal = useMemo(() => {
    if (!effectivePrice || !sellQuantityNum) return 0;
    return effectivePrice * sellQuantityNum;
  }, [effectivePrice, sellQuantityNum]);

  const priceTick = useMemo(() => {
    const p = effectivePrice ?? 0;
    if (p >= 100000) return 10;
    if (p >= 10000) return 1;
    if (p >= 1000) return 0.1;
    if (p >= 100) return 0.01;
    return 0.001;
  }, [effectivePrice]);

  const minimumOrderDisplay = useMemo(() => {
    if (!tradingRules) return `-${pair.quote || "USDT"}`;
    return `${fmt(tradingRules.minOrderNotional, 8)} ${tradingRules.quoteAsset}`;
  }, [pair.quote, tradingRules]);

  const feeRateInclVatDisplay = useMemo(() => {
    if (!tradingRules) return "-%";
    const feeRateRaw = orderType === "LIMIT"
      ? tradingRules.makerFeeRatePctInclVat
      : tradingRules.takerFeeRatePctInclVat;
    const feeRate = toNum(feeRateRaw);
    if (feeRate === null) return "-%";
    return `${feeRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
  }, [orderType, tradingRules]);

  /* ─── Sync price & URL on symbol change ─── */
  useEffect(() => {
    setPrice("");
    setStopPrice("");
    setBuyQuantity("");
    setSellQuantity("");
    setBuyPctSelected(null);
    setSellPctSelected(null);
    setOrderMessage("");
    const url = new URL(window.location.href);
    if (url.searchParams.get("symbol") !== symbol) {
      url.searchParams.set("symbol", symbol);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [symbol]);
  useEffect(() => { if (!price && currentPrice) setPrice(currentPrice); }, [currentPrice, price]);

  /* ═══════════════════════════════════════════════════════════════
     Handlers
     ═══════════════════════════════════════════════════════════════ */

  const onAdjustPrice = (direction: -1 | 1) => {
    const base = effectivePrice ?? 0;
    const next = Math.max(0, base + direction * priceTick);
    const precision = priceTick >= 1 ? 0 : (String(priceTick).split(".")[1]?.length ?? 3);
    setPrice(next.toFixed(precision));
  };

  const onAdjustStopPrice = (direction: -1 | 1) => {
    const sp = toNum(stopPrice) ?? effectivePrice ?? 0;
    const next = Math.max(0, sp + direction * priceTick);
    const precision = priceTick >= 1 ? 0 : (String(priceTick).split(".")[1]?.length ?? 3);
    setStopPrice(next.toFixed(precision));
  };

  const applyPercentPreset = (formSide: "BUY" | "SELL", pct: (typeof PERCENT_PRESETS)[number]) => {
    const ratio = pct / 100;
    if (formSide === "BUY") {
      setBuyPctSelected(pct);
      if (!effectivePrice || effectivePrice <= 0) return;
      const spendableQuote = availableQuote * ratio;
      const qty = spendableQuote / effectivePrice;
      setBuyQuantity(qty > 0 ? qty.toFixed(6) : "0");
      return;
    }
    setSellPctSelected(pct);
    const qty = availableBase * ratio;
    setSellQuantity(qty > 0 ? qty.toFixed(6) : "0");
  };

  const onSubmitOrder = async (formSide: "BUY" | "SELL", e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAuthenticated) { setOrderMessage(t("trade.loginRequired")); return; }
    const tq = (formSide === "BUY" ? buyQuantity : sellQuantity).trim();
    if (!tq) { setOrderMessage(t("trade.enterQuantity")); return; }

    let submitPrice: string | undefined;
    if (orderType === "MARKET") {
      submitPrice = currentPrice ?? undefined;
    } else if (orderType === "STOP_LIMIT") {
      const sp = stopPrice.trim();
      const lp = price.trim();
      if (!sp) { setOrderMessage("감시가격을 입력하세요."); return; }
      if (!lp) { setOrderMessage("지정가를 입력하세요."); return; }
      submitPrice = lp;
    } else {
      const tp = price.trim();
      if (!tp) { setOrderMessage(t("trade.priceRequired")); return; }
      submitPrice = tp;
    }

    setOrderSubmitting(true);
    setOrderMessage("");
    const { data, error } = await api.POST("/orders", {
      body: { symbol, side: formSide, type: orderType, quantity: tq, price: submitPrice },
    });
    setOrderSubmitting(false);
    if (error || !data) { setOrderMessage(parseErr(error, t("trade.orderFailed"))); return; }
    const c = data as { orderId?: string; status?: string };
    setOrderMessage(`${t("trade.orderPlaced")}: ${c.orderId ?? "unknown"} (${c.status ?? "NEW"})`);
    await Promise.all([loadMyOrders(1), loadMarketData(), loadBalances()]);
  };

  const onCancelOrder = async (orderId: string) => {
    setOrderMessage("");
    const { data, error } = await api.DELETE("/orders/{orderId}", { params: { path: { orderId } } });
    if (error || !data) { setOrderMessage(parseErr(error, t("trade.cancelFailed"))); return; }
    const c = data as { orderId?: string; status?: string };
    setOrderMessage(`Order ${c.orderId ?? orderId}: ${c.status ?? "CANCELED"}`);
    await Promise.all([loadMyOrders(1), loadMarketData(), loadBalances()]);
  };

  const selectMarket = (sym: string) => {
    setSymbol(sym);
    setMarketDropdownOpen(false);
  };

  const toggleFavorite = (sym: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      try { localStorage.setItem("gnndex_favorites", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const clickOrderbookPrice = (p: number | null) => {
    if (p !== null) setPrice(String(p));
  };

  /* ═══════════════════════════════════════════════════════════════
     JSON-LD SEO
     ═══════════════════════════════════════════════════════════════ */

  const jsonLd = useMemo(() => {
    const cp = currentPrice ? Number(currentPrice) : null;
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${siteUrl}/trade#webpage`,
          url: `${siteUrl}/trade`,
          name: `Trade ${symbol} | GnnDEX`,
          description: `${symbol} real-time chart, orderbook, and trading`,
          inLanguage: "ko-KR",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Trade", item: `${siteUrl}/trade` },
            { "@type": "ListItem", position: 3, name: symbol, item: `${siteUrl}/trade?symbol=${encodeURIComponent(symbol)}` },
          ],
        },
        {
          "@type": "Product",
          name: `${pair.base}/${pair.quote || "USDT"}`,
          sku: symbol,
          offers: {
            "@type": "Offer",
            priceCurrency: pair.quote || "USDT",
            price: cp !== null && Number.isFinite(cp) ? cp.toString() : "0",
          },
        },
      ],
    };
  }, [currentPrice, pair, symbol]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ════════════ TOP MARKET SELECTOR BAR ════════════ */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
          {/* Favorite star + Market selector */}
          <div className="flex items-center gap-0 border-r border-border">
            <button
              type="button"
              className="pl-4 pr-1 py-3"
              onClick={() => toggleFavorite(symbol)}
            >
              <svg className={`w-4 h-4 transition ${favorites.has(symbol) ? "text-gold" : "text-muted-foreground/40 hover:text-gold/60"}`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
              </svg>
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-3 transition hover:bg-secondary"
                onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
              >
                <CoinIcon symbol={pair.base} size="lg" />
                <div className="text-left">
                  <span className="text-lg font-bold text-foreground">{pair.base}</span>
                  <span className="text-sm text-muted-foreground ml-1">/ {pair.quote || "USDT"}</span>
                </div>
              </button>

              {/* Dropdown */}
              {marketDropdownOpen && (
                <div className="absolute left-0 top-full z-50 w-[380px] border border-border bg-card shadow-2xl shadow-black/20 rounded-b-xl animate-fade-in">
                  <div className="grid grid-cols-[20px_1fr_auto_auto_auto] gap-1 border-b border-border text-[11px] font-semibold text-muted-foreground px-3 py-2">
                    <span />
                    <span>{t("trade.markets")}</span>
                    <span className="text-right min-w-[72px]">{t("trade.price")}</span>
                    <span className="text-right min-w-[56px]">{t("trade.24hChange")}</span>
                    <span className="text-right min-w-[52px]">{t("trade.volume")}</span>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    {filteredMarkets.length === 0 ? (
                      <p className="px-3 py-6 text-sm text-muted-foreground text-center">{t("trade.noMarkets")}</p>
                    ) : (
                      [...filteredMarkets].sort((a, b) => {
                        const af = favorites.has(a.symbol) ? 0 : 1;
                        const bf = favorites.has(b.symbol) ? 0 : 1;
                        return af - bf;
                      }).map((row) => {
                        const rp = split(row.symbol);
                        const ch = toNum(row.changePercent24h);
                        const active = row.symbol === symbol;
                        const isFav = favorites.has(row.symbol);
                        return (
                          <div
                            key={row.symbol}
                            className={`grid grid-cols-[20px_1fr_auto_auto_auto] gap-1 items-center px-3 py-2.5 transition ${
                              active ? "bg-primary/8" : "hover:bg-secondary"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex items-center justify-center"
                              onClick={() => toggleFavorite(row.symbol)}
                            >
                              <svg className={`w-3.5 h-3.5 transition ${isFav ? "text-gold" : "text-muted-foreground/30 hover:text-gold/60"}`} viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left"
                              onClick={() => selectMarket(row.symbol)}
                            >
                              <CoinIcon symbol={rp.base} size="sm" />
                              <div>
                                <span className="text-sm font-semibold text-foreground">{rp.base}</span>
                                <span className="text-[11px] text-muted-foreground">/{rp.quote}</span>
                              </div>
                            </button>
                            <button type="button" className="text-right text-sm font-mono text-foreground min-w-[72px]" onClick={() => selectMarket(row.symbol)}>{fmt(row.lastPrice, 2)}</button>
                            <button type="button" className={`text-right text-sm font-semibold min-w-[56px] ${(ch ?? 0) >= 0 ? "text-up" : "text-down"}`} onClick={() => selectMarket(row.symbol)}>{signPct(ch)}</button>
                            <button type="button" className="text-right text-xs text-muted-foreground font-mono min-w-[52px]" onClick={() => selectMarket(row.symbol)}>{fmtCompact(row.volume24h)}</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="flex items-center gap-6 px-5 py-3 min-w-0">
            <div>
              <span className={`text-xl font-bold font-mono ${isPositive ? "text-up" : "text-down"}`}>
                {fmt(currentPrice, 2)}
              </span>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hChange")}</div>
              <div className={`text-sm font-semibold ${isPositive ? "text-up" : "text-down"}`}>
                {signPct(change24h)}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hHigh")}</div>
              <div className="text-sm font-mono text-foreground">
                {candles.length > 0 ? fmt(Math.max(...candles.map((c) => Number(c.high))).toString(), 2) : "-"}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hLow")}</div>
              <div className="text-sm font-mono text-foreground">
                {candles.length > 0 ? fmt(Math.min(...candles.map((c) => Number(c.low))).toString(), 2) : "-"}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hVolume")}</div>
              <div className="text-sm font-mono text-foreground">{fmtCompact(selectedTicker?.volume24h)}</div>
            </div>
            <div className="hidden lg:block">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.spread")}</div>
              <div className="text-sm font-mono text-foreground">
                {spreadValue !== null ? fmt(String(spreadValue), 6) : "-"}
                {spreadPct !== null && <span className="ml-1 text-xs text-muted-foreground">({spreadPct.toFixed(3)}%)</span>}
              </div>
            </div>
          </div>

          {/* Stream status */}
          <div className="ml-auto px-4 hidden xl:flex items-center gap-2">
            <StreamStatusBadge connected={ordersStreamConnected} />
            <StreamReconnectNotice retryInfo={ordersStreamRetryInfo} />
          </div>
        </div>
      </div>

      {/* ════════════ MAIN TRADING GRID ════════════ */}
      <div
        className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] xl:grid-cols-[300px_1fr_340px] gap-0 overflow-hidden"
        style={{ height: "calc(100vh - 105px)" }}
      >

        {/* ════════════ LEFT: ORDERBOOK ════════════ */}
        <div className="border-r border-border bg-card flex flex-col overflow-hidden order-2 lg:order-1">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{t("trade.orderbook")}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{t("trade.spread")}: </span>
              <span className="text-[10px] font-mono text-foreground">{spreadValue !== null ? fmt(String(spreadValue), 6) : "-"}</span>
            </div>
          </div>

          {/* Top depth balance */}
          <div className="px-3 py-2 border-b border-border/70 bg-secondary/30 shrink-0">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold font-mono">
              <span className="text-up">{bidDepthPct.toFixed(2)}%</span>
              <span className="text-down">{askDepthPct.toFixed(2)}%</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-secondary/70">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${bidDepthPct}%`,
                  background: "linear-gradient(90deg, hsl(var(--exchange-buy) / 0.32), hsl(var(--exchange-buy) / 0.12))"
                }}
              />
              <div
                className="absolute inset-y-0 right-0 transition-all duration-500"
                style={{
                  width: `${askDepthPct}%`,
                  background: "linear-gradient(90deg, hsl(var(--exchange-sell) / 0.12), hsl(var(--exchange-sell) / 0.32))"
                }}
              />
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border shrink-0">
            <span className="text-right">{t("trade.price")} ({pair.quote})</span>
            <span className="text-right">{t("trade.amount")} ({pair.base})</span>
            <span className="text-right">{t("trade.total")}</span>
          </div>

          {/* Asks (reversed - highest at top) */}
          <div className="flex-1 overflow-hidden min-h-0 p-0">
            <div
              className="grid h-full content-stretch"
              style={{ gridTemplateRows: `repeat(${ORDERBOOK_LEVEL_LIMIT}, minmax(0, 1fr))` }}
            >
              {askDisplayLevels.map((level, i) => {
                const isEmpty = level === null;
                const depthPct = isEmpty ? 0 : Math.min(100, (level.qty / maxAskQty) * 100);
                const total = isEmpty ? 0 : (level.price ?? 0) * level.qty;
                return (
                  <button
                    key={`ask-${i}`}
                    type="button"
                    className={`relative grid h-full grid-cols-3 items-center px-3 text-[10px] leading-none transition ${
                      isEmpty ? "cursor-default" : "hover:bg-secondary/50 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!isEmpty) clickOrderbookPrice(level.price);
                    }}
                    disabled={isEmpty}
                  >
                    {!isEmpty && (
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 orderbook-depth-bar orderbook-depth-sell"
                        style={{
                          width: `${depthPct}%`,
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    )}
                    <span className="relative text-right font-mono tabular-nums font-medium text-down">
                      {isEmpty ? "" : level.price !== null ? fmtFixed(String(level.price), 2) : ""}
                    </span>
                    <span className="relative text-right font-mono tabular-nums text-foreground">
                      {isEmpty ? "" : fmt(String(level.qty), 4)}
                    </span>
                    <span className="relative text-right font-mono tabular-nums text-muted-foreground">
                      {isEmpty ? "" : fmtFixed(String(total), 2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center price indicator */}
          <div className="px-3 py-2 border-y border-border bg-secondary/50 shrink-0">
            <div className="flex items-center justify-between">
              <span className={`text-base font-bold font-mono ${isPositive ? "text-up" : "text-down"}`}>
                {fmt(currentPrice, 2)}
              </span>
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <svg className="h-3.5 w-3.5 text-up" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5 text-down" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
                <span className={`text-xs font-semibold ${isPositive ? "text-up" : "text-down"}`}>{signPct(change24h)}</span>
              </div>
            </div>
          </div>

          {/* Bids */}
          <div className="flex-1 overflow-hidden min-h-0 p-0">
            <div
              className="grid h-full content-stretch"
              style={{ gridTemplateRows: `repeat(${ORDERBOOK_LEVEL_LIMIT}, minmax(0, 1fr))` }}
            >
              {bidDisplayLevels.map((level, i) => {
                const isEmpty = level === null;
                const depthPct = isEmpty ? 0 : Math.min(100, (level.qty / maxBidQty) * 100);
                const total = isEmpty ? 0 : (level.price ?? 0) * level.qty;
                return (
                  <button
                    key={`bid-${i}`}
                    type="button"
                    className={`relative grid h-full grid-cols-3 items-center px-3 text-[10px] leading-none transition ${
                      isEmpty ? "cursor-default" : "hover:bg-secondary/50 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!isEmpty) clickOrderbookPrice(level.price);
                    }}
                    disabled={isEmpty}
                  >
                    {!isEmpty && (
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 orderbook-depth-bar orderbook-depth-buy"
                        style={{
                          width: `${depthPct}%`,
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    )}
                    <span className="relative text-right font-mono tabular-nums font-medium text-up">
                      {isEmpty ? "" : level.price !== null ? fmtFixed(String(level.price), 2) : ""}
                    </span>
                    <span className="relative text-right font-mono tabular-nums text-foreground">
                      {isEmpty ? "" : fmt(String(level.qty), 4)}
                    </span>
                    <span className="relative text-right font-mono tabular-nums text-muted-foreground">
                      {isEmpty ? "" : fmtFixed(String(total), 2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ════════════ CENTER: CHART + ORDER FORM ════════════ */}
        <div className="flex flex-col overflow-y-auto order-1 lg:order-2 min-h-0">
          {/* Chart — fixed height so it doesn't shrink when the order form grows */}
          <div className="h-[420px] shrink-0 border-b border-border overflow-hidden">
            {marketError ? (
              <div className="flex items-center justify-center h-full">
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{marketError}</p>
              </div>
            ) : (
              <TradingViewChart symbol={symbol} />
            )}
          </div>

          {/* Order Form — side-by-side Buy / Sell */}
          <div className="shrink-0 bg-card border-b border-border">
            {/* Shared header: order type + message */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/20">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">주문유형</span>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
                {(["LIMIT", "MARKET", "STOP_LIMIT"] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    className={`px-3 py-1.5 text-[11px] font-semibold transition ${
                      orderType === ot
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    } ${ot !== "STOP_LIMIT" ? "border-r border-border" : ""}`}
                    onClick={() => setOrderType(ot)}
                  >
                    {ot === "STOP_LIMIT" ? "스톱" : ot === "LIMIT" ? "지정가" : "시장가"}
                  </button>
                ))}
              </div>
              {orderMessage && (
                <div className={`ml-auto max-w-[50%] truncate rounded px-2 py-1 text-[11px] ${
                  orderMessage.includes("placed") || orderMessage.includes("CANCELED")
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                }`}>
                  {orderMessage}
                </div>
              )}
            </div>

            {!isReady ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">{t("trade.loadingSession")}</div>
            ) : (
              <div className="grid grid-cols-2 divide-x divide-border">
                {/* ── BUY form ── */}
                <form className="px-3 py-3 flex flex-col gap-2.5" onSubmit={(e) => onSubmitOrder("BUY", e)}>
                  {/* 주문가능 */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                    <span className="text-[11px] text-muted-foreground">주문가능</span>
                    <span className="text-right font-mono text-[11px] font-semibold text-foreground">
                      {isAuthenticated ? `${fmt(String(availableQuote), 2)} ${pair.quote || "USDT"}` : `- ${pair.quote || "USDT"}`}
                    </span>
                  </div>

                  {/* ─ STOP_LIMIT: 감시가격 ─ */}
                  {orderType === "STOP_LIMIT" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">감시가격</span>
                      <div className="grid grid-cols-[1fr_auto_auto] overflow-hidden rounded border border-border bg-secondary/20">
                        <input
                          className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none"
                          placeholder="0.00"
                          value={stopPrice}
                          onChange={(e) => setStopPrice(e.target.value)}
                        />
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustStopPrice(-1)}>-</button>
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustStopPrice(1)}>+</button>
                      </div>
                    </div>
                  )}

                  {/* ─ LIMIT / STOP_LIMIT: 가격 ─ */}
                  {orderType !== "MARKET" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">{orderType === "STOP_LIMIT" ? "지정가" : "가격"}</span>
                      <div className="grid grid-cols-[1fr_auto_auto] overflow-hidden rounded border border-border bg-secondary/20">
                        <input
                          className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none"
                          placeholder="0.00"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustPrice(-1)}>-</button>
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustPrice(1)}>+</button>
                      </div>
                    </div>
                  )}

                  {/* ─ MARKET: 시장가 안내 ─ */}
                  {orderType === "MARKET" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">가격</span>
                      <div className="flex items-center justify-between rounded border border-border bg-secondary/10 px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">시장가 즉시체결</span>
                        <span className="font-mono text-xs font-semibold text-foreground">{currentPrice ? fmt(currentPrice, 2) : "-"}</span>
                      </div>
                    </div>
                  )}

                  {/* 수량 + % buttons */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-start">
                    <span className="text-[11px] text-muted-foreground pt-[7px]">수량</span>
                    <div className="space-y-1.5">
                      <input
                        ref={buyQuantityInputRef}
                        className="w-full rounded border border-border bg-secondary/20 px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        placeholder="0"
                        value={buyQuantity}
                        onChange={(e) => { setBuyQuantity(e.target.value); setBuyPctSelected(null); }}
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {PERCENT_PRESETS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`rounded border py-0.5 text-[10px] font-semibold transition ${
                              buyPctSelected === p
                                ? "border-up/50 bg-up/10 text-up"
                                : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            }`}
                            onClick={() => applyPercentPreset("BUY", p)}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* 총액 */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                    <span className="text-[11px] text-muted-foreground">총액</span>
                    <input
                      className="w-full rounded border border-border bg-secondary/20 px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground"
                      value={buyEstimatedTotal > 0 ? fmt(String(buyEstimatedTotal), 2) : "0"}
                      readOnly
                    />
                  </div>
                  {/* Fee info */}
                  <div className="grid grid-cols-[52px_1fr] gap-3">
                    <span />
                    <div className="text-[10px] text-muted-foreground text-right">
                      최소 {minimumOrderDisplay} | 수수료 {feeRateInclVatDisplay}
                    </div>
                  </div>
                  {/* STOP_LIMIT 안내 */}
                  {orderType === "STOP_LIMIT" && (
                    <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      감시가격에 도달하면 지정가로 주문이 자동 등록됩니다.
                    </div>
                  )}
                  {/* Submit */}
                  {isAuthenticated ? (
                    <button
                      type="submit"
                      disabled={orderSubmitting}
                      className="w-full py-2 rounded-md text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 btn-buy"
                    >
                      {orderSubmitting ? t("trade.submitting") : `매수 ${pair.base}`}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/auth/register" className="btn-secondary !py-2 !text-xs !font-bold text-center">회원가입</Link>
                      <Link href="/auth/login" className="btn-primary !py-2 !text-xs !font-bold text-center">로그인</Link>
                    </div>
                  )}
                </form>

                {/* ── SELL form ── */}
                <form className="px-3 py-3 flex flex-col gap-2.5" onSubmit={(e) => onSubmitOrder("SELL", e)}>
                  {/* 주문가능 */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                    <span className="text-[11px] text-muted-foreground">주문가능</span>
                    <span className="text-right font-mono text-[11px] font-semibold text-foreground">
                      {isAuthenticated ? `${fmt(String(availableBase), 8)} ${pair.base}` : `- ${pair.base}`}
                    </span>
                  </div>

                  {/* ─ STOP_LIMIT: 감시가격 ─ */}
                  {orderType === "STOP_LIMIT" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">감시가격</span>
                      <div className="grid grid-cols-[1fr_auto_auto] overflow-hidden rounded border border-border bg-secondary/20">
                        <input
                          className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none"
                          placeholder="0.00"
                          value={stopPrice}
                          onChange={(e) => setStopPrice(e.target.value)}
                        />
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustStopPrice(-1)}>-</button>
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustStopPrice(1)}>+</button>
                      </div>
                    </div>
                  )}

                  {/* ─ LIMIT / STOP_LIMIT: 가격 ─ */}
                  {orderType !== "MARKET" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">{orderType === "STOP_LIMIT" ? "지정가" : "가격"}</span>
                      <div className="grid grid-cols-[1fr_auto_auto] overflow-hidden rounded border border-border bg-secondary/20">
                        <input
                          className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none"
                          placeholder="0.00"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustPrice(-1)}>-</button>
                        <button type="button" className="w-7 border-l border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40" onClick={() => onAdjustPrice(1)}>+</button>
                      </div>
                    </div>
                  )}

                  {/* ─ MARKET: 시장가 안내 ─ */}
                  {orderType === "MARKET" && (
                    <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                      <span className="text-[11px] text-muted-foreground">가격</span>
                      <div className="flex items-center justify-between rounded border border-border bg-secondary/10 px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">시장가 즉시체결</span>
                        <span className="font-mono text-xs font-semibold text-foreground">{currentPrice ? fmt(currentPrice, 2) : "-"}</span>
                      </div>
                    </div>
                  )}

                  {/* 수량 + % buttons */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-start">
                    <span className="text-[11px] text-muted-foreground pt-[7px]">수량</span>
                    <div className="space-y-1.5">
                      <input
                        ref={sellQuantityInputRef}
                        className="w-full rounded border border-border bg-secondary/20 px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        placeholder="0"
                        value={sellQuantity}
                        onChange={(e) => { setSellQuantity(e.target.value); setSellPctSelected(null); }}
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {PERCENT_PRESETS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`rounded border py-0.5 text-[10px] font-semibold transition ${
                              sellPctSelected === p
                                ? "border-down/50 bg-down/10 text-down"
                                : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            }`}
                            onClick={() => applyPercentPreset("SELL", p)}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* 총액 */}
                  <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
                    <span className="text-[11px] text-muted-foreground">총액</span>
                    <input
                      className="w-full rounded border border-border bg-secondary/20 px-2 py-1.5 text-right font-mono text-xs font-semibold text-foreground"
                      value={sellEstimatedTotal > 0 ? fmt(String(sellEstimatedTotal), 2) : "0"}
                      readOnly
                    />
                  </div>
                  {/* Fee info */}
                  <div className="grid grid-cols-[52px_1fr] gap-3">
                    <span />
                    <div className="text-[10px] text-muted-foreground text-right">
                      최소 {minimumOrderDisplay} | 수수료 {feeRateInclVatDisplay}
                    </div>
                  </div>
                  {/* STOP_LIMIT 안내 */}
                  {orderType === "STOP_LIMIT" && (
                    <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      감시가격에 도달하면 지정가로 주문이 자동 등록됩니다.
                    </div>
                  )}
                  {/* Submit */}
                  {isAuthenticated ? (
                    <button
                      type="submit"
                      disabled={orderSubmitting}
                      className="w-full py-2 rounded-md text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 btn-sell"
                    >
                      {orderSubmitting ? t("trade.submitting") : `매도 ${pair.base}`}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/auth/register" className="btn-secondary !py-2 !text-xs !font-bold text-center">회원가입</Link>
                      <Link href="/auth/login" className="btn-primary !py-2 !text-xs !font-bold text-center">로그인</Link>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>

        {/* ════════════ RIGHT: MARKET INFO PANEL ════════════ */}
        <div className="border-l border-border bg-card flex flex-col overflow-hidden order-3">
          {/* Market info header */}
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <CoinIcon symbol={pair.base} size="xl" />
              <div>
                <div className="text-lg font-bold text-foreground">{pair.base}<span className="text-muted-foreground font-normal">/{pair.quote}</span></div>
                <div className="text-xs text-muted-foreground">{symbol}</div>
              </div>
            </div>

            <div className={`text-3xl font-bold font-mono mb-1 ${isPositive ? "text-up" : "text-down"}`}>
              {fmt(currentPrice, 2)}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-sm font-semibold ${isPositive ? "text-up" : "text-down"}`}>
                {signPct(change24h)}
              </span>
              <span className={`badge text-[10px] ${isPositive ? "badge-success" : "badge-danger"}`}>
                {isPositive ? t("trade.bullish") : t("trade.bearish")}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hHigh")}</div>
                <div className="text-sm font-mono text-foreground">
                  {candles.length > 0 ? fmt(Math.max(...candles.map((c) => Number(c.high))).toString(), 2) : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hLow")}</div>
                <div className="text-sm font-mono text-foreground">
                  {candles.length > 0 ? fmt(Math.min(...candles.map((c) => Number(c.low))).toString(), 2) : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.24hVolume")}</div>
                <div className="text-sm font-mono text-foreground">{fmtCompact(selectedTicker?.volume24h)} {pair.base}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.spread")}</div>
                <div className="text-sm font-mono text-foreground">
                  {spreadValue !== null ? fmt(String(spreadValue), 6) : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.bestBid")}</div>
                <div className="text-sm font-mono text-up">{bidLevels[0]?.price !== null && bidLevels[0]?.price !== undefined ? fmt(String(bidLevels[0].price), 2) : "-"}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("trade.bestAsk")}</div>
                <div className="text-sm font-mono text-down">{askLevels[0]?.price !== null && askLevels[0]?.price !== undefined ? fmt(String(askLevels[0].price), 2) : "-"}</div>
              </div>
            </div>
          </div>

          {/* Markets list — tabs + search */}
          <div className="px-3 py-2 border-b border-border shrink-0 space-y-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  marketTab === "FAVORITES"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
                onClick={() => setMarketTab("FAVORITES")}
              >
                <svg className="inline-block w-3 h-3 mr-0.5 -mt-px" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                즐겨찾기
                {favorites.size > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({favorites.size})</span>}
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  marketTab === "ALL"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
                onClick={() => setMarketTab("ALL")}
              >
                전체
              </button>
            </div>
            <input
              className="input-field text-xs !py-1.5"
              placeholder={t("trade.searchSymbol")}
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
            />
          </div>

          {/* Market list header */}
          <div className="grid grid-cols-[16px_1fr_auto_auto] gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border shrink-0">
            <span />
            <span>{t("trade.pair")}</span>
            <span className="text-right">{t("trade.price")}</span>
            <span className="text-right min-w-[52px]">{t("trade.24hChange")}</span>
          </div>

          {/* Market list scrollable */}
          <div className="flex-1 overflow-auto">
            {(() => {
              const displayList = marketTab === "FAVORITES" ? favoriteMarkets : filteredMarkets;
              if (marketListError) return <p className="px-3 py-4 text-xs text-destructive">{marketListError}</p>;
              if (marketListLoading && displayList.length === 0) return (
                <div className="px-3 py-6 space-y-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 rounded bg-secondary animate-pulse" />)}
                </div>
              );
              if (displayList.length === 0) return (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                  {marketTab === "FAVORITES" ? "즐겨찾기한 마켓이 없습니다." : t("trade.noResults")}
                </p>
              );
              return displayList.map((row) => {
                const rp = split(row.symbol);
                const ch = toNum(row.changePercent24h);
                const active = row.symbol === symbol;
                const isFav = favorites.has(row.symbol);
                return (
                  <div
                    key={row.symbol}
                    className={`grid grid-cols-[16px_1fr_auto_auto] gap-1 items-center px-3 py-2 transition ${
                      active ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-secondary border-l-2 border-l-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex items-center justify-center"
                      onClick={() => toggleFavorite(row.symbol)}
                    >
                      <svg className={`w-3 h-3 transition ${isFav ? "text-gold" : "text-muted-foreground/40 hover:text-gold/60"}`} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 min-w-0 text-left"
                      onClick={() => selectMarket(row.symbol)}
                    >
                      <CoinIcon symbol={rp.base} size="xs" />
                      <span className="text-xs font-semibold text-foreground truncate">{rp.base}</span>
                      <span className="text-[10px] text-muted-foreground">/{rp.quote}</span>
                    </button>
                    <button type="button" className="text-right text-xs font-mono text-foreground" onClick={() => selectMarket(row.symbol)}>
                      {fmt(row.lastPrice, 2)}
                    </button>
                    <button type="button" className={`text-right text-xs font-semibold min-w-[52px] ${(ch ?? 0) >= 0 ? "text-up" : "text-down"}`} onClick={() => selectMarket(row.symbol)}>
                      {signPct(ch)}
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ════════════ BOTTOM: ORDER HISTORY ════════════ */}
      <div ref={orderHistoryRef} id="trade-order-history" className="border-t border-border bg-card">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-border px-4">
          <div className="flex gap-0">
            {(
              [
                { key: "OPEN" as const, label: t("trade.openOrders") },
                { key: "COMPLETED" as const, label: t("trade.orderHistory") },
                { key: "ALL" as const, label: t("trade.allOrders") },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`px-4 py-2.5 text-xs font-semibold transition border-b-2 ${
                  historyTab === tab.key
                    ? "text-foreground border-b-primary"
                    : "text-muted-foreground border-b-transparent hover:text-foreground"
                }`}
                onClick={() => setHistoryTab(tab.key)}
              >
                {tab.label}
                {tab.key === "OPEN" && myOrders.filter((o) => o.status === "NEW" || o.status === "PARTIALLY_FILLED").length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {myOrders.filter((o) => o.status === "NEW" || o.status === "PARTIALLY_FILLED").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Filters */}
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as typeof orderStatusFilter)}
            >
              {ORDER_STATUS_OPTIONS.map((v) => <option key={v} value={v}>{t("trade.status")}: {v}</option>)}
            </select>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hidden sm:block"
              value={orderSideFilter}
              onChange={(e) => setOrderSideFilter(e.target.value as typeof orderSideFilter)}
            >
              {ORDER_SIDE_OPTIONS.map((v) => <option key={v} value={v}>{t("trade.side")}: {v}</option>)}
            </select>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hidden sm:block"
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value as typeof orderTypeFilter)}
            >
              {ORDER_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{t("trade.type")}: {v}</option>)}
            </select>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hidden md:block"
              value={ordersLimit}
              onChange={(e) => setOrdersLimit(Number(e.target.value) as typeof ordersLimit)}
            >
              {ORDER_LIMIT_OPTIONS.map((v) => <option key={v} value={v}>{v} {t("trade.rows")}</option>)}
            </select>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hidden md:block"
              value={orderSortBy}
              onChange={(e) => setOrderSortBy(e.target.value as typeof orderSortBy)}
            >
              {ORDER_SORT_BY_OPTIONS.map((v) => <option key={v} value={v}>{t("trade.sort")}: {v}</option>)}
            </select>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hidden md:block"
              value={orderSortOrder}
              onChange={(e) => setOrderSortOrder(e.target.value as typeof orderSortOrder)}
            >
              {ORDER_SORT_ORDER_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              onClick={() => void loadMyOrders(ordersPage)}
            >
              {t("trade.refresh")}
            </button>
          </div>
        </div>

        {/* Order table */}
        <div className="overflow-auto max-h-[260px]">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{t("trade.date")}</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{t("trade.pair")}</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{t("trade.type")}</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{t("trade.side")}</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{t("trade.price")}</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{t("trade.amount")}</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{t("trade.total")}</th>
                <th className="px-4 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap">{t("trade.status")}</th>
                <th className="px-4 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap">{t("trade.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!isAuthenticated ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">{t("trade.logIn")}</Link> {t("trade.loginToView")}
                  </td>
                </tr>
              ) : ordersLoading && filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{t("trade.loadingOrders")}</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    {historyTab === "OPEN" ? t("trade.noOpenOrders") : historyTab === "COMPLETED" ? t("trade.noCompletedOrders") : t("trade.noOrders")}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((row) => {
                  const rp = split(row.symbol);
                  const canCancel = row.status === "NEW" || row.status === "PARTIALLY_FILLED";
                  const total = row.price ? (Number(row.price) * Number(row.quantity)).toFixed(2) : "-";
                  return (
                    <tr key={row.orderId} className="transition hover:bg-secondary/30">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.createdAt ? (
                          <div>
                            <div className="text-foreground">{formatDate(row.createdAt)}</div>
                            <div className="text-[10px] text-muted-foreground">{formatTime(row.createdAt)}</div>
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CoinIcon symbol={rp.base} size="xs" />
                          <span className="font-semibold text-foreground">{rp.base}</span>
                          <span className="text-muted-foreground">/{rp.quote}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="badge-muted">{row.type}</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`font-semibold ${row.side === "BUY" ? "text-up" : "text-down"}`}>{row.side}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                        {row.price ? fmt(row.price, 2) : t("trade.market")}
                      </td>
                      <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{fmt(row.quantity, 4)}</td>
                      <td className="px-4 py-2 text-right font-mono whitespace-nowrap text-muted-foreground">{total}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {row.status === "NEW" && <span className="badge-info">{t("trade.statusNew")}</span>}
                        {row.status === "PARTIALLY_FILLED" && <span className="badge-warning">{t("trade.statusPartial")}</span>}
                        {row.status === "FILLED" && <span className="badge-success">{t("trade.statusFilled")}</span>}
                        {row.status === "CANCELED" && <span className="badge-muted">{t("trade.statusCanceled")}</span>}
                        {row.status === "REJECTED" && <span className="badge-danger">{t("trade.statusRejected")}</span>}
                        {row.status === "NOT_FOUND" && <span className="badge-muted">{t("trade.statusNotFound")}</span>}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {canCancel ? (
                          <button
                            type="button"
                            className="rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition"
                            onClick={() => void onCancelOrder(row.orderId)}
                          >
                            {t("trade.cancel")}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {isAuthenticated && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {t("trade.page")} {ordersPage} {t("trade.of")} {totalPages} ({ordersTotal} {t("trade.total_count")})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary transition disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={ordersLoading || ordersPage <= 1}
                onClick={() => void loadMyOrders(ordersPage - 1)}
              >
                {t("trade.previous")}
              </button>
              <button
                type="button"
                className="rounded border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary transition disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={ordersLoading || ordersPage >= totalPages}
                onClick={() => void loadMyOrders(ordersPage + 1)}
              >
                {t("trade.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
