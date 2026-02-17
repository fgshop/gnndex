"use client";

import { useMemo } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type BalanceRow,
  type PortfolioItem,
  type WalletTab,
  PORTFOLIO_COLORS,
  coinName,
  toNumber,
  formatAmount,
  formatUsd,
  TabIcon,
  SectionEmptyState,
} from "@/features/wallet/wallet-shared";

/* ═══════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════ */

type WalletOverviewTabProps = {
  balances: BalanceRow[];
  navigateToTab: (tab: WalletTab) => void;
};

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export function WalletOverviewTab({ balances, navigateToTab }: WalletOverviewTabProps) {
  const { t } = useTranslation();

  /* ── Derived data ── */
  const totalAvailable = useMemo(
    () => balances.reduce((acc, row) => acc + toNumber(row.available), 0),
    [balances],
  );
  const totalLocked = useMemo(
    () => balances.reduce((acc, row) => acc + toNumber(row.locked), 0),
    [balances],
  );
  const totalPortfolio = totalAvailable + totalLocked;

  const portfolioBreakdown: PortfolioItem[] = useMemo(() => {
    return balances
      .map((b) => {
        const total = toNumber(b.available) + toNumber(b.locked);
        const pct = totalPortfolio > 0 ? (total / totalPortfolio) * 100 : 0;
        return { asset: b.asset, available: toNumber(b.available), locked: toNumber(b.locked), total, pct };
      })
      .filter((b) => b.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [balances, totalPortfolio]);

  const pendingCount = useMemo(
    () => balances.filter((b) => toNumber(b.locked) > 0).length,
    [balances],
  );

  /* ── Quick stats ── */
  const stats = [
    { labelKey: "wallet.totalBalance", value: formatUsd(totalPortfolio), color: "text-foreground" },
    { labelKey: "wallet.available", value: formatUsd(totalAvailable), color: "text-foreground" },
    { labelKey: "wallet.inOrders", value: formatUsd(totalLocked), color: "text-foreground" },
    { labelKey: "wallet.pending", value: String(pendingCount), color: "text-amber-500" },
  ];

  /* ── Quick actions ── */
  const quickActions = [
    { labelKey: "wallet.quickDeposit", tab: "deposit" as WalletTab, icon: "download" },
    { labelKey: "wallet.quickWithdraw", tab: "withdraw" as WalletTab, icon: "send" },
    { labelKey: "wallet.quickSwap", tab: "swap" as WalletTab, icon: "swap" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Quick Stats Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.labelKey}
            className="panel p-4"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t(stat.labelKey)}
            </p>
            <p className={`mt-1.5 font-[var(--font-mono)] text-lg font-bold ${stat.color} animate-count-up`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Portfolio Allocation Bar ── */}
      {portfolioBreakdown.length > 0 && (
        <section className="panel p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("wallet.portfolioAllocation")}
          </h3>

          {/* Bar */}
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {portfolioBreakdown.map((item, i) => (
              <div
                key={item.asset}
                className={`${PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${Math.max(item.pct, 1)}%` }}
                title={`${item.asset}: ${item.pct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {portfolioBreakdown.slice(0, 6).map((item, i) => (
              <span key={item.asset} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]}`} />
                <CoinIcon symbol={item.asset} size="xs" />
                <span className="font-medium text-foreground">{item.asset}</span>
                <span className="font-[var(--font-mono)]">{item.pct.toFixed(1)}%</span>
              </span>
            ))}
            {portfolioBreakdown.length > 6 && (
              <span className="text-xs text-muted-foreground">
                {t("wallet.more", { count: String(portfolioBreakdown.length - 6) })}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Asset Cards Grid ── */}
      {portfolioBreakdown.length === 0 ? (
        <section className="panel">
          <SectionEmptyState
            icon={
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M22 10H2" />
              </svg>
            }
            title={t("wallet.noAssetsTitle")}
            description={t("wallet.noAssetsDesc")}
            action={
              <button type="button" className="btn-primary !text-sm" onClick={() => navigateToTab("deposit")}>
                {t("wallet.quickDeposit")}
              </button>
            }
          />
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portfolioBreakdown.map((item, i) => (
            <div
              key={item.asset}
              className="panel panel-hover flex items-center gap-4 p-4 transition-all"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CoinIcon symbol={item.asset} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.asset}</p>
                  <span className="truncate text-xs text-muted-foreground">{coinName(item.asset)}</span>
                </div>
                <p className="mt-0.5 font-[var(--font-mono)] text-base font-bold text-foreground">
                  {formatAmount(String(item.total), 6)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-[var(--font-mono)] text-sm font-semibold text-foreground">
                  {formatUsd(item.total)}
                </p>
                <span
                  className={`mt-0.5 inline-block rounded-md px-2 py-0.5 font-[var(--font-mono)] text-xs font-medium ${PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} bg-opacity-15 text-foreground`}
                >
                  {item.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick Actions Row ── */}
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.labelKey}
            type="button"
            onClick={() => navigateToTab(action.tab)}
            className="panel panel-hover flex flex-col items-center gap-2 py-5 text-center transition-all hover:border-primary/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TabIcon type={action.icon} className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-foreground">{t(action.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* ── Recent Transactions Summary ── */}
      {portfolioBreakdown.length > 0 && (
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.recentActivity")}
            </h3>
            <button
              type="button"
              onClick={() => navigateToTab("history")}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              {t("wallet.viewAll")}
            </button>
          </div>

          <div className="mt-3 divide-y divide-border/50">
            {portfolioBreakdown.slice(0, 5).map((item) => (
              <div key={item.asset} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CoinIcon symbol={item.asset} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.asset}</p>
                  <p className="text-xs text-muted-foreground">{coinName(item.asset)}</p>
                </div>
                <div className="text-right">
                  <p className="font-[var(--font-mono)] text-sm font-semibold text-foreground">
                    {formatAmount(String(item.available), 6)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("wallet.available")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-[var(--font-mono)] text-sm text-muted-foreground">
                    {formatAmount(String(item.locked), 6)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("wallet.inOrders")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
