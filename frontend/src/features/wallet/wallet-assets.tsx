"use client";

import { useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type BalanceRow,
  type WalletTab,
  type CoinNetworkInfo,
  coinName,
  toNumber,
  formatAmount,
  formatUsd,
  TabIcon,
  SectionEmptyState,
} from "@/features/wallet/wallet-shared";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type ListedCoin = { symbol: string; baseAsset: string; quoteAsset: string; chartSource: string; isActive: boolean };

type WalletAssetsTabProps = {
  balances: BalanceRow[];
  listedCoins: ListedCoin[];
  navigateToTab: (tab: WalletTab, opts?: { asset?: string }) => void;
  createWallet: (asset: string, network?: string) => Promise<void>;
  networkConfig: CoinNetworkInfo[];
};

type MergedRow = {
  asset: string;
  available: string;
  locked: string;
  hasWallet: boolean;
  depositAddress?: string | null;
};

/* ═══════════════════════════════════════════════════════════
   Sort helpers
   ═══════════════════════════════════════════════════════════ */

type SortKey = "asset" | "available" | "locked" | "total" | "value";
type SortDir = "asc" | "desc";

function compareMergedRows(a: MergedRow, b: MergedRow, key: SortKey, dir: SortDir): number {
  let result = 0;
  switch (key) {
    case "asset":
      result = a.asset.localeCompare(b.asset);
      break;
    case "available":
      result = toNumber(a.available) - toNumber(b.available);
      break;
    case "locked":
      result = toNumber(a.locked) - toNumber(b.locked);
      break;
    case "total":
    case "value": {
      const totalA = toNumber(a.available) + toNumber(a.locked);
      const totalB = toNumber(b.available) + toNumber(b.locked);
      result = totalA - totalB;
      break;
    }
  }
  return dir === "desc" ? -result : result;
}

/* ═══════════════════════════════════════════════════════════
   Sort Header Icon
   ═══════════════════════════════════════════════════════════ */

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 inline-block h-3 w-3 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline-block h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {dir === "asc" ? <path d="M8 15l4-4 4 4" /> : <path d="M8 9l4 4 4-4" />}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export function WalletAssetsTab({ balances, listedCoins, navigateToTab, createWallet, networkConfig }: WalletAssetsTabProps) {
  const { t } = useTranslation();

  /* ── Local state ── */
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [creatingAsset, setCreatingAsset] = useState<string | null>(null);

  /* ── Sort toggle handler ── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  /* ── Merge listed coins with balances ── */
  const mergedRows = useMemo<MergedRow[]>(() => {
    const balanceMap = new Map(balances.map((b) => [b.asset, b]));

    // Collect unique base assets from listed coins + quote assets
    const assetSet = new Set<string>();
    for (const coin of listedCoins) {
      assetSet.add(coin.baseAsset);
      assetSet.add(coin.quoteAsset);
    }
    // Also include any assets from balances that may not be in listed coins
    for (const b of balances) {
      assetSet.add(b.asset);
    }

    return Array.from(assetSet).map((asset) => {
      const balance = balanceMap.get(asset);
      return {
        asset,
        available: balance?.available ?? "0",
        locked: balance?.locked ?? "0",
        hasWallet: !!balance,
        depositAddress: balance?.depositAddress,
      };
    });
  }, [balances, listedCoins]);

  /* ── Filtered & sorted rows ── */
  const filteredRows = useMemo(() => {
    let result = [...mergedRows];
    if (hideZero) {
      result = result.filter((b) => toNumber(b.available) > 0 || toNumber(b.locked) > 0);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (b) => b.asset.toLowerCase().includes(q) || coinName(b.asset).toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => compareMergedRows(a, b, sortKey, sortDir));
    return result;
  }, [mergedRows, hideZero, search, sortKey, sortDir]);

  /* ── Create wallet handler ── */
  const handleCreateWallet = async (asset: string) => {
    const coinCfg = networkConfig.find(c => c.asset === asset);
    setCreatingAsset(asset);
    if (coinCfg?.type === "token") {
      await createWallet(asset, coinCfg.networks[0]?.network);
    } else {
      await createWallet(asset);
    }
    setCreatingAsset(null);
  };

  /* ── Column definitions ── */
  const columns: Array<{ key: SortKey; labelKey: string; align: string; hideOn?: string }> = [
    { key: "asset", labelKey: "wallet.colAsset", align: "text-left" },
    { key: "available", labelKey: "wallet.colAvailable", align: "text-right" },
    { key: "locked", labelKey: "wallet.colInOrders", align: "text-right", hideOn: "hidden sm:table-cell" },
    { key: "total", labelKey: "wallet.colTotal", align: "text-right" },
    { key: "value", labelKey: "wallet.colUsdtValue", align: "text-right", hideOn: "hidden md:table-cell" },
  ];

  return (
    <section className="panel animate-fade-in">
      {/* ── Controls Bar ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("wallet.searchAssets")}
            className="input-field !py-2 pl-9 text-sm"
          />
        </div>

        {/* Hide zero toggle */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary accent-primary"
          />
          {t("wallet.hideZeroBalances")}
        </label>
      </div>

      {/* ── Asset Table ── */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* Header */}
            <thead className="border-b border-border bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground ${col.align} ${col.hideOn ?? ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {t(col.labelKey)}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </th>
                ))}
                {/* Actions column */}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("wallet.colActions")}
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-border/50">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10">
                    <SectionEmptyState
                      icon={
                        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      }
                      title={hideZero ? t("wallet.noNonZeroBalances") : t("wallet.noBalanceData")}
                      description={search.trim() ? t("wallet.noSearchResults") : t("wallet.noAssetsDesc")}
                    />
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => {
                  const total = toNumber(item.available) + toNumber(item.locked);
                  const isCreating = creatingAsset === item.asset;
                  return (
                    <tr key={item.asset} className="group transition-colors hover:bg-muted/30">
                      {/* Asset */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <CoinIcon symbol={item.asset} size="md" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.asset}</p>
                            <p className="text-xs text-muted-foreground">{coinName(item.asset)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-foreground">
                        {item.hasWallet ? formatAmount(item.available, 6) : <span className="text-muted-foreground">--</span>}
                      </td>

                      {/* In Orders */}
                      <td className="hidden px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-muted-foreground sm:table-cell">
                        {item.hasWallet ? formatAmount(item.locked, 6) : <span>--</span>}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-foreground">
                        {item.hasWallet ? formatAmount(String(total), 6) : <span className="text-muted-foreground">--</span>}
                      </td>

                      {/* USDT Value */}
                      <td className="hidden px-4 py-3.5 text-right font-[var(--font-mono)] text-sm text-muted-foreground md:table-cell">
                        {item.hasWallet ? formatUsd(total) : "--"}
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3.5 text-right">
                        {item.hasWallet ? (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigateToTab("deposit", { asset: item.asset })}
                              className="btn-ghost !px-2.5 !py-1 !text-xs"
                              title={t("wallet.quickDeposit")}
                            >
                              <TabIcon type="download" className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden sm:inline">{t("wallet.tab.deposit")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateToTab("withdraw", { asset: item.asset })}
                              className="btn-ghost !px-2.5 !py-1 !text-xs"
                              title={t("wallet.quickWithdraw")}
                            >
                              <TabIcon type="send" className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden sm:inline">{t("wallet.tab.withdraw")}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCreateWallet(item.asset)}
                            disabled={isCreating}
                            className="btn-primary !px-3 !py-1 !text-xs"
                          >
                            {isCreating ? (
                              <span className="flex items-center gap-1.5">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <TabIcon type="wallet" className="h-3.5 w-3.5" />
                                <span>{t("wallet.createWallet")}</span>
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary Footer ── */}
      {filteredRows.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("wallet.showingAssets", { count: String(filteredRows.length), total: String(mergedRows.length) })}
          </span>
          <span className="font-[var(--font-mono)] font-medium text-foreground">
            {t("wallet.colTotal")}: {formatUsd(filteredRows.reduce((acc, b) => acc + toNumber(b.available) + toNumber(b.locked), 0))}
          </span>
        </div>
      )}
    </section>
  );
}
