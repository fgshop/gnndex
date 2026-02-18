"use client";

import { useCallback, useMemo, useState } from "react";
import { utils, writeFileXLSX } from "xlsx";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type WithdrawalRow,
  STATUS_MAP,
  SectionEmptyState,
  CopyButton,
  formatAmount,
  formatDateTime,
  truncateAddress,
  coinName,
} from "./wallet-shared";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type TxType = "all" | "deposit" | "withdrawal" | "trade" | "swap" | "bridge";

type TransactionRow = {
  id: string;
  type: TxType;
  asset: string;
  amount: string;
  fee?: string;
  status: string;
  date: string;
  network?: string;
  address?: string | null;
  txHash?: string | null;
  detail?: string;
};

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const TX_FILTERS: Array<{ key: TxType; labelKey: string }> = [
  { key: "all", labelKey: "wallet.history.all" },
  { key: "deposit", labelKey: "wallet.history.deposits" },
  { key: "withdrawal", labelKey: "wallet.history.withdrawals" },
  { key: "trade", labelKey: "wallet.history.trades" },
  { key: "swap", labelKey: "wallet.history.swaps" },
  { key: "bridge", labelKey: "wallet.history.bridge" },
];

const TYPE_BADGE: Record<string, { labelKey: string; className: string }> = {
  deposit: { labelKey: "wallet.history.deposit", className: "badge-success" },
  withdrawal: { labelKey: "wallet.history.withdrawal", className: "badge-warning" },
  trade: { labelKey: "wallet.history.trade", className: "badge-info" },
  swap: { labelKey: "wallet.history.swap", className: "bg-purple-500/10 text-purple-500" },
  bridge: { labelKey: "wallet.history.bridgeTx", className: "bg-cyan-500/10 text-cyan-500" },
};

const ITEMS_PER_PAGE = 10;

/* ─── Mock data for non-withdrawal types ─── */

const MOCK_DEPOSITS: TransactionRow[] = [
  { id: "dep-1", type: "deposit", asset: "USDT", amount: "+5,000.00", status: "CONFIRMED", date: "2026-02-15T09:12:00Z", network: "TRC20", txHash: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" },
  { id: "dep-2", type: "deposit", asset: "BTC", amount: "+0.250000", status: "CONFIRMED", date: "2026-02-13T15:30:00Z", network: "BTC", txHash: "0xf9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8" },
  { id: "dep-3", type: "deposit", asset: "ETH", amount: "+2.500000", status: "CONFIRMED", date: "2026-02-10T22:45:00Z", network: "ETH-ERC20", txHash: "0x1234abcd5678ef901234abcd5678ef901234abcd5678ef901234abcd5678ef90" },
  { id: "dep-4", type: "deposit", asset: "SOL", amount: "+50.000000", status: "PENDING", date: "2026-02-16T14:20:00Z", network: "SOL", txHash: null },
];

const MOCK_TRADES: TransactionRow[] = [
  { id: "trd-1", type: "trade", asset: "BTC", amount: "+0.015000", status: "COMPLETED", date: "2026-02-16T11:05:00Z", detail: "BTC/USDT Buy @ 96,432.50" },
  { id: "trd-2", type: "trade", asset: "ETH", amount: "-1.200000", status: "COMPLETED", date: "2026-02-15T18:22:00Z", detail: "ETH/USDT Sell @ 2,745.80" },
  { id: "trd-3", type: "trade", asset: "SOL", amount: "+25.000000", status: "COMPLETED", date: "2026-02-14T09:15:00Z", detail: "SOL/USDT Buy @ 178.25" },
  { id: "trd-4", type: "trade", asset: "SBK", amount: "+1,000.00", status: "COMPLETED", date: "2026-02-12T07:40:00Z", detail: "SBK/USDT Buy @ 0.4520" },
];

const MOCK_SWAPS: TransactionRow[] = [
  { id: "swp-1", type: "swap", asset: "USDT", amount: "-500.00", status: "COMPLETED", date: "2026-02-15T20:10:00Z", detail: "500 USDT -> 0.00518 BTC" },
  { id: "swp-2", type: "swap", asset: "ETH", amount: "-0.500000", status: "COMPLETED", date: "2026-02-13T12:30:00Z", detail: "0.5 ETH -> 1,372.90 USDT" },
  { id: "swp-3", type: "swap", asset: "BTC", amount: "-0.010000", status: "COMPLETED", date: "2026-02-11T16:55:00Z", detail: "0.01 BTC -> 5.42 SOL" },
];

const MOCK_BRIDGES: TransactionRow[] = [
  { id: "brg-1", type: "bridge", asset: "USDT", amount: "-1,000.00", status: "CONFIRMED", date: "2026-02-14T10:05:00Z", detail: "ETH -> BSC", network: "ETH-ERC20", txHash: "0xbridge1abc2def3456789bridge1abc2def3456789bridge1abc2def34567890" },
  { id: "brg-2", type: "bridge", asset: "ETH", amount: "-0.300000", status: "CONFIRMED", date: "2026-02-12T08:30:00Z", detail: "ETH -> Polygon", network: "ETH-ERC20", txHash: "0xbridge2abc2def3456789bridge2abc2def3456789bridge2abc2def34567890" },
  { id: "brg-3", type: "bridge", asset: "USDT", amount: "-250.00", status: "PENDING", date: "2026-02-16T17:45:00Z", detail: "BSC -> SOL", network: "BSC-BEP20", txHash: null },
];

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export function WalletHistoryTab({ withdrawals }: { withdrawals: WithdrawalRow[] }) {
  const { t } = useTranslation();

  const [typeFilter, setTypeFilter] = useState<TxType>("all");
  const [assetFilter, setAssetFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  /* ── Convert real withdrawals to TransactionRow ── */
  const withdrawalRows: TransactionRow[] = useMemo(
    () =>
      withdrawals.map((w) => ({
        id: w.withdrawalId,
        type: "withdrawal" as TxType,
        asset: w.asset,
        amount: `-${w.amount}`,
        fee: w.fee,
        status: w.status,
        date: w.requestedAt,
        network: w.network,
        address: w.address,
        txHash: w.txHash,
      })),
    [withdrawals],
  );

  /* ── Merge all transactions ── */
  const allTransactions: TransactionRow[] = useMemo(() => {
    const merged = [
      ...MOCK_DEPOSITS,
      ...withdrawalRows,
      ...MOCK_TRADES,
      ...MOCK_SWAPS,
      ...MOCK_BRIDGES,
    ];
    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [withdrawalRows]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = allTransactions;

    if (typeFilter !== "all") {
      list = list.filter((tx) => tx.type === typeFilter);
    }

    if (assetFilter) {
      list = list.filter((tx) => tx.asset === assetFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((tx) => new Date(tx.date).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000; // end of day
      list = list.filter((tx) => new Date(tx.date).getTime() < to);
    }

    return list;
  }, [allTransactions, typeFilter, assetFilter, dateFrom, dateTo]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  /* ── Reset page on filter change ── */
  const setTypeAndReset = (v: TxType) => { setTypeFilter(v); setPage(1); };
  const setAssetAndReset = (v: string) => { setAssetFilter(v); setPage(1); };

  /* ── Unique assets in data ── */
  const assetsInData = useMemo(() => {
    return Array.from(new Set(allTransactions.map((tx) => tx.asset))).sort();
  }, [allTransactions]);

  /* ── Excel export ── */
  const handleExport = useCallback(() => {
    const rows = filtered.map((tx) => {
      const typeBadge = TYPE_BADGE[tx.type];
      const statusInfo = STATUS_MAP[tx.status];
      return {
        [t("wallet.history.colDate")]: formatDateTime(tx.date),
        [t("wallet.history.colType")]: typeBadge ? t(typeBadge.labelKey) : tx.type,
        [t("wallet.history.colAsset")]: tx.asset,
        [t("wallet.history.colAmount")]: tx.amount,
        [t("wallet.fee")]: tx.fee ?? "",
        [t("wallet.history.colStatus")]: statusInfo ? t(statusInfo.labelKey) : tx.status,
        [t("wallet.history.colDetails")]: tx.txHash ?? tx.detail ?? "",
      };
    });

    const ws = utils.json_to_sheet(rows);

    /* Auto-size columns */
    const headers = Object.keys(rows[0] ?? {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(h.length, ...rows.map((r) => String((r as Record<string, string>)[h] ?? "").length));
      return { wch: Math.min(maxLen + 2, 40) };
    });

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Transactions");

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    writeFileXLSX(wb, `GnnDEX_Transactions_${dateStr}.xlsx`);
  }, [filtered, t]);

  return (
    <section className="space-y-4 animate-fade-in">
      {/* ── Header ── */}
      <div className="panel">
        <div className="flex items-center justify-between">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-foreground">
            {t("wallet.history.title")}
          </h2>
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-ghost !px-2.5 !py-1.5 !text-xs inline-flex items-center gap-1.5 disabled:opacity-30"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t("wallet.history.export")}
          </button>
        </div>

        {/* ── Type filter pills ── */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TX_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeAndReset(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                typeFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {/* ── Date + asset filters ── */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.history.from")}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="input-field !py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.history.to")}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="input-field !py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.history.asset")}
            </label>
            <select
              value={assetFilter}
              onChange={(e) => setAssetAndReset(e.target.value)}
              className="input-field !py-1.5 text-xs"
            >
              <option value="">{t("wallet.history.allAssets")}</option>
              {assetsInData.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Transaction table ── */}
      <div className="panel !p-0">
        {filtered.length === 0 ? (
          <SectionEmptyState
            icon={
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            }
            title={t("wallet.history.noTransactions")}
            description={t("wallet.history.noTransactionsDesc")}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.history.colDate")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.history.colType")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.history.colAsset")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.history.colAmount")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.history.colStatus")}
                    </th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      {t("wallet.history.colDetails")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paged.map((tx) => {
                    const typeBadge = TYPE_BADGE[tx.type] ?? { labelKey: tx.type, className: "badge-muted" };
                    const statusInfo = STATUS_MAP[tx.status] ?? { labelKey: tx.status, className: "badge-muted" };
                    const isPositive = tx.amount.startsWith("+");

                    return (
                      <tr key={tx.id} className="transition-colors hover:bg-muted/30">
                        {/* Date */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                          {formatDateTime(tx.date)}
                        </td>

                        {/* Type badge */}
                        <td className="px-4 py-3.5">
                          <span className={`badge ${typeBadge.className}`}>
                            {t(typeBadge.labelKey)}
                          </span>
                        </td>

                        {/* Asset */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={tx.asset} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{tx.asset}</p>
                              {tx.network && (
                                <p className="text-[11px] text-muted-foreground">{tx.network}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={`px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold ${
                          isPositive ? "text-up" : "text-down"
                        }`}>
                          {tx.amount}
                          {tx.fee && (
                            <p className="font-normal text-[11px] text-muted-foreground">
                              {t("wallet.fee")}: {tx.fee}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`badge ${statusInfo.className}`}>
                            {t(statusInfo.labelKey)}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="hidden px-4 py-3.5 lg:table-cell">
                          {tx.txHash ? (
                            <div className="flex items-center">
                              <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
                                {truncateAddress(tx.txHash, 8)}
                              </span>
                              <CopyButton text={tx.txHash} />
                            </div>
                          ) : tx.detail ? (
                            <span className="text-xs text-muted-foreground">{tx.detail}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("wallet.history.showing", {
                  from: String((safePage - 1) * ITEMS_PER_PAGE + 1),
                  to: String(Math.min(safePage * ITEMS_PER_PAGE, filtered.length)),
                  total: String(filtered.length),
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-ghost !px-2 !py-1 !text-xs disabled:opacity-30"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item as number)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          safePage === item
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-ghost !px-2 !py-1 !text-xs disabled:opacity-30"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
