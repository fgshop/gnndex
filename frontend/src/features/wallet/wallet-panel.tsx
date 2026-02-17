"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { StreamReconnectNotice } from "@/components/stream-reconnect-notice";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { getStoredAccessToken, getStoredRefreshToken, updateStoredTokens } from "@/features/auth/auth-storage";
import { useAuth } from "@/features/auth/auth-context";
import { useTranslation } from "@/i18n/locale-context";
import { api, apiBaseUrl } from "@/lib/api";
import { streamSseWithBackoff, type SseRetryInfo, type HeadersOrFactory } from "@/lib/sse-stream";

import {
  type BalanceRow,
  type WithdrawalRow,
  type BalancesStreamEvent,
  type WalletTab,
  type PortfolioItem,
  type MessageState,
  WALLET_TABS,
  PORTFOLIO_COLORS,
  resolveWalletTab,
  parseApiError,
  toNumber,
  formatUsd,
  toBalanceRows,
  toWithdrawalRows,
  parseBalancesStreamEvent,
  TabIcon,
} from "./wallet-shared";

import { WalletOverviewTab } from "./wallet-overview";
import { WalletAssetsTab } from "./wallet-assets";
import { WalletDepositTab } from "./wallet-deposit";
import { WalletWithdrawTab } from "./wallet-withdraw";
import { WalletSwapTab } from "./wallet-swap";
import { WalletHistoryTab } from "./wallet-history";
import { WalletEarningsTab } from "./wallet-earnings";

/* ═══════════════════════════════════════════════════════════
   Wallet Panel — Main Shell
   ═══════════════════════════════════════════════════════════ */

export function WalletPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  /* ── Core state ── */
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [balancesStreamConnected, setBalancesStreamConnected] = useState(false);
  const [balancesStreamRetryInfo, setBalancesStreamRetryInfo] = useState<SseRetryInfo | null>(null);
  const [message, setMessage] = useState<MessageState>({ text: "", type: "info" });

  /* ── Tab navigation ── */
  const activeTab = resolveWalletTab(searchParams.get("tab"));

  const navigateToTab = useCallback((tab: WalletTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  /* ── Data loading ── */
  const loadWallet = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) setLoading(true);
    setMessage({ text: "", type: "info" });

    const [balancesRes, withdrawalsRes] = await Promise.all([
      api.GET("/wallet/balances"),
      api.GET("/wallet/withdrawals", { params: { query: { limit: 50 } } }),
    ]);

    if (!options?.background) setLoading(false);

    if (balancesRes.error || withdrawalsRes.error) {
      setMessage({ text: parseApiError(balancesRes.error ?? withdrawalsRes.error, t("wallet.loadFailed")), type: "error" });
      return;
    }

    setBalances(toBalanceRows(balancesRes.data));
    setWithdrawals(toWithdrawalRows(withdrawalsRes.data));
  }, [t]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBalances([]);
      setWithdrawals([]);
      setBalancesStreamConnected(false);
      setBalancesStreamRetryInfo(null);
      return;
    }
    loadWallet().catch(() => setMessage({ text: t("wallet.loadFailed"), type: "error" }));
  }, [isAuthenticated, loadWallet, t]);

  /* ── SSE Balance Stream ── */
  useEffect(() => {
    if (!isAuthenticated) {
      setBalancesStreamConnected(false);
      setBalancesStreamRetryInfo(null);
      return;
    }

    if (!getStoredAccessToken()) {
      setBalancesStreamConnected(false);
      setBalancesStreamRetryInfo(null);
      return;
    }

    const streamUrl = new URL(`${apiBaseUrl}/wallet/stream/balances`, window.location.origin);
    streamUrl.searchParams.set("intervalMs", "5000");

    const controller = new AbortController();
    let isActive = true;

    /* Resolve fresh auth headers on every (re)connection attempt.
       If the stored access token has expired, try a refresh first. */
    const getHeaders: HeadersOrFactory = async (): Promise<Record<string, string>> => {
      let token = getStoredAccessToken();
      if (!token) {
        /* Attempt token refresh before giving up */
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          try {
            const res = await fetch(`${apiBaseUrl}/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            if (res.ok) {
              const payload = (await res.json()) as { tokens?: { accessToken?: string; refreshToken?: string; refreshTokenJwt?: string; accessTokenTtl?: string; refreshTokenExpiresAt?: string } };
              if (payload.tokens?.accessToken) {
                updateStoredTokens(payload.tokens);
                token = payload.tokens.accessToken;
              }
            }
          } catch { /* refresh failed, will connect without token */ }
        }
      }
      if (token) return { Authorization: `Bearer ${token}` };
      return {};
    };

    async function startStream() {
      try {
        await streamSseWithBackoff({
          url: streamUrl.toString(),
          headers: getHeaders,
          signal: controller.signal,
          maxRetries: 5,
          onOpen: () => {
            if (!isActive) return;
            setBalancesStreamConnected(true);
            setBalancesStreamRetryInfo(null);
          },
          onData: (rawData) => {
            if (!isActive) return;
            const payload = parseBalancesStreamEvent(rawData);
            if (!payload) return;
            if (payload.eventType === "user.balances.error") {
              const errorData = payload.data as { message?: string };
              setMessage({ text: typeof errorData.message === "string" ? errorData.message : t("wallet.loadFailed"), type: "error" });
              return;
            }
            const balancesData = payload.data as BalanceRow[];
            if (Array.isArray(balancesData)) {
              setBalances(balancesData);
              setLoading(false);
            }
          },
          onRetry: (info) => {
            if (!isActive) return;
            setBalancesStreamConnected(false);
            setBalancesStreamRetryInfo(info);
          },
          onGiveUp: () => {
            if (!isActive) return;
            setBalancesStreamConnected(false);
            setBalancesStreamRetryInfo(null);
          },
        });
      } catch {
        if (isActive) setBalancesStreamConnected(false);
      } finally {
        if (isActive) setBalancesStreamConnected(false);
      }
    }

    void startStream();
    return () => { isActive = false; controller.abort(); setBalancesStreamConnected(false); setBalancesStreamRetryInfo(null); };
  }, [isAuthenticated, t]);

  /* ── Polling fallback ── */
  useEffect(() => {
    if (!isAuthenticated || balancesStreamConnected) return;
    const timerId = window.setInterval(() => {
      loadWallet({ background: true }).catch(() => setMessage({ text: t("wallet.refreshFailed"), type: "error" }));
    }, 15000);
    return () => window.clearInterval(timerId);
  }, [balancesStreamConnected, isAuthenticated, loadWallet, t]);

  /* ── Derived data ── */
  const totalAvailable = useMemo(() => balances.reduce((acc, row) => acc + toNumber(row.available), 0), [balances]);
  const totalLocked = useMemo(() => balances.reduce((acc, row) => acc + toNumber(row.locked), 0), [balances]);
  const totalPortfolio = totalAvailable + totalLocked;
  const pendingWithdrawals = useMemo(() => withdrawals.filter((r) => r.status === "REQUESTED" || r.status === "REVIEW_PENDING").length, [withdrawals]);

  const portfolioBreakdown = useMemo<PortfolioItem[]>(() => {
    return balances
      .map((b) => {
        const total = toNumber(b.available) + toNumber(b.locked);
        const pct = totalPortfolio > 0 ? (total / totalPortfolio) * 100 : 0;
        return { asset: b.asset, available: toNumber(b.available), locked: toNumber(b.locked), total, pct };
      })
      .filter((b) => b.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [balances, totalPortfolio]);

  /* ─── Auth gate ─── */
  if (!isReady) {
    return (
      <section className="panel animate-fade-in">
        <div className="flex items-center gap-3 py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("wallet.loadingSession")}</p>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="panel animate-fade-up">
        <div className="flex flex-col items-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M22 10H2" /><path d="M6 14h.01" /><path d="M10 14h.01" />
            </svg>
          </div>
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-foreground">{t("wallet.authGateTitle")}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {t("wallet.authGateDesc")}
          </p>
          <Link className="btn-primary mt-6" href="/auth/login">
            {t("wallet.signIn")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Portfolio Overview Card ──────────────────────── */}
      <section className="panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("wallet.estimatedPortfolioValue")}</p>
              <p className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight text-foreground md:text-4xl animate-count-up">
                {formatUsd(totalPortfolio)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StreamStatusBadge connected={balancesStreamConnected} />
              <button
                className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => void loadWallet()}
                type="button"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
          </div>

          <StreamReconnectNotice className="mt-2" retryInfo={balancesStreamRetryInfo} />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("wallet.available")}</p>
              <p className="mt-1 font-[var(--font-mono)] text-sm font-semibold text-foreground">{formatUsd(totalAvailable)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("wallet.inOrders")}</p>
              <p className="mt-1 font-[var(--font-mono)] text-sm font-semibold text-foreground">{formatUsd(totalLocked)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-500">{t("wallet.pending")}</p>
              <p className="mt-1 font-[var(--font-mono)] text-sm font-semibold text-amber-500">{pendingWithdrawals}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("wallet.assets")}</p>
              <p className="mt-1 font-[var(--font-mono)] text-sm font-semibold text-foreground">{portfolioBreakdown.length}</p>
            </div>
          </div>

          {portfolioBreakdown.length > 0 && (
            <div className="mt-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {portfolioBreakdown.map((item, i) => (
                  <div
                    key={item.asset}
                    className={`${PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${Math.max(item.pct, 1)}%` }}
                    title={`${item.asset}: ${item.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {portfolioBreakdown.slice(0, 6).map((item, i) => (
                  <span key={item.asset} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`inline-block h-2 w-2 rounded-full ${PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]}`} />
                    <CoinIcon symbol={item.asset} size="xs" />
                    {item.asset}
                    <span className="font-[var(--font-mono)]">{item.pct.toFixed(1)}%</span>
                  </span>
                ))}
                {portfolioBreakdown.length > 6 && (
                  <span className="text-xs text-muted-foreground">{t("wallet.more", { count: String(portfolioBreakdown.length - 6) })}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Message Banner ─────────────────────────────── */}
      {message.text && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm animate-fade-in ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : message.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage({ text: "", type: "info" })} className="ml-3 opacity-60 hover:opacity-100 transition-opacity">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Navigation ──────────────────────────────── */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {WALLET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigateToTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <TabIcon type={tab.icon} className="h-4 w-4" />
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* ── Tab Content ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <WalletOverviewTab balances={balances} navigateToTab={navigateToTab} />
      )}

      {activeTab === "assets" && (
        <WalletAssetsTab balances={balances} navigateToTab={navigateToTab} />
      )}

      {activeTab === "deposit" && (
        <WalletDepositTab balances={balances} />
      )}

      {activeTab === "withdraw" && (
        <WalletWithdrawTab
          balances={balances}
          onWithdraw={() => void loadWallet()}
          setMessage={setMessage}
        />
      )}

      {activeTab === "swap" && (
        <WalletSwapTab balances={balances} />
      )}

      {activeTab === "history" && (
        <WalletHistoryTab withdrawals={withdrawals} />
      )}

      {activeTab === "earnings" && (
        <WalletEarningsTab balances={balances} />
      )}
    </div>
  );
}
