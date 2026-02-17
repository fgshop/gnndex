"use client";

import { useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type BalanceRow,
  AVAILABLE_ASSETS,
  AVAILABLE_NETWORKS,
  STATUS_MAP,
  ChevronDown,
  CopyButton,
  SectionEmptyState,
  coinName,
  formatAmount,
  formatDateTime,
} from "@/features/wallet/wallet-shared";

/* ─── Mock address generators ─────────────────────────── */

const MOCK_ADDRESSES: Record<string, string> = {
  "ETH-ERC20": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "TRC20": "TJYs5Lq3aEYEFhR7Nru42N37w8sVFH2jYk",
  "BSC-BEP20": "0x1Ae3739CA28bF4837feF87C8c1fd91563f2bA217",
  "SOL": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
  "Polygon": "0x5aAe36B8B285eA58c3F17E3fBD06Da69A3e5D88F",
  "Avalanche-C": "0xC3A7d6b5F245Fe81b8Ea3D5b2c9E6f8a07D12C34",
};

const NETWORK_INFO: Record<string, { confirmations: number; minDeposit: string }> = {
  "ETH-ERC20": { confirmations: 12, minDeposit: "0.001" },
  "TRC20": { confirmations: 20, minDeposit: "1.00" },
  "BSC-BEP20": { confirmations: 15, minDeposit: "0.001" },
  "SOL": { confirmations: 32, minDeposit: "0.01" },
  "Polygon": { confirmations: 128, minDeposit: "0.01" },
  "Avalanche-C": { confirmations: 12, minDeposit: "0.01" },
};

type MockDeposit = {
  id: string;
  asset: string;
  network: string;
  amount: string;
  status: string;
  txHash: string;
  createdAt: string;
};

const MOCK_DEPOSITS: MockDeposit[] = [
  {
    id: "dep-001",
    asset: "USDT",
    network: "ETH-ERC20",
    amount: "500.00",
    status: "CONFIRMED",
    txHash: "0xa1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
    createdAt: "2026-02-16T14:23:00Z",
  },
  {
    id: "dep-002",
    asset: "ETH",
    network: "ETH-ERC20",
    amount: "0.25",
    status: "PENDING",
    txHash: "0xf9e8d7c6b5a43210fedcba9876543210fedcba9876543210fedcba9876543210",
    createdAt: "2026-02-17T09:05:00Z",
  },
  {
    id: "dep-003",
    asset: "SOL",
    network: "SOL",
    amount: "12.50",
    status: "CONFIRMED",
    txHash: "4sGjMW1sUnHzSxGspuhSqbXVKJUAm3RqWXY6TuDZ3u1h7kQxPkYeN5NhxS6aN38q",
    createdAt: "2026-02-15T20:41:00Z",
  },
  {
    id: "dep-004",
    asset: "BTC",
    network: "ETH-ERC20",
    amount: "0.015",
    status: "CONFIRMED",
    txHash: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
    createdAt: "2026-02-14T11:17:00Z",
  },
];

/* ─── Component ─────────────────────────────────────────── */

type WalletDepositTabProps = {
  balances: BalanceRow[];
};

export function WalletDepositTab({ balances }: WalletDepositTabProps) {
  const { t } = useTranslation();
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETH-ERC20");

  const depositAddress = MOCK_ADDRESSES[network] ?? MOCK_ADDRESSES["ETH-ERC20"];
  const networkInfo = NETWORK_INFO[network] ?? { confirmations: 12, minDeposit: "0.001" };

  const selectedBalance = useMemo(() => {
    const found = balances.find((b) => b.asset === asset);
    return found ? formatAmount(found.available, 6) : "0.00";
  }, [balances, asset]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Deposit Form Card ── */}
      <section className="panel">
        <h2 className="font-[var(--font-display)] text-lg font-bold text-foreground">
          {t("wallet.depositFunds")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("wallet.depositDesc")}
        </p>

        <div className="mt-6 space-y-5">
          {/* Asset & Network selectors */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Asset selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("wallet.currency")}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <CoinIcon symbol={asset} size="sm" />
                </div>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="input-field appearance-none pl-9 pr-10"
                >
                  {AVAILABLE_ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a} - {coinName(a)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("wallet.available")}:{" "}
                <span className="font-[var(--font-mono)] font-semibold text-foreground">
                  {selectedBalance} {asset}
                </span>
              </p>
            </div>

            {/* Network selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("wallet.network")}
              </label>
              <div className="relative">
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="input-field appearance-none pr-10"
                >
                  {AVAILABLE_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Deposit Address + QR */}
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            {/* Address display */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("wallet.depositAddress")}
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-4">
                <code className="min-w-0 flex-1 break-all font-[var(--font-mono)] text-sm font-medium text-foreground">
                  {depositAddress}
                </code>
                <CopyButton text={depositAddress} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("wallet.sendOnly")} <span className="font-semibold text-foreground">{asset}</span> {t("wallet.toThisAddress")} ({network})
              </p>
            </div>

            {/* QR Code placeholder */}
            <div className="flex flex-col items-center">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("wallet.qrCode")}
              </label>
              <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                <svg
                  className="h-10 w-10 text-muted-foreground/40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="8" height="8" rx="1" />
                  <rect x="14" y="2" width="8" height="8" rx="1" />
                  <rect x="2" y="14" width="8" height="8" rx="1" />
                  <rect x="14" y="14" width="4" height="4" rx="0.5" />
                  <rect x="20" y="14" width="2" height="2" rx="0.25" />
                  <rect x="14" y="20" width="2" height="2" rx="0.25" />
                  <rect x="20" y="20" width="2" height="2" rx="0.25" />
                </svg>
                <span className="mt-1.5 text-[11px] font-medium text-muted-foreground/60">
                  {t("wallet.qrCode")}
                </span>
              </div>
            </div>
          </div>

          {/* Network info card */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.minDeposit")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-foreground">
                {networkInfo.minDeposit} {asset}
              </span>
            </div>
            <div className="my-2 border-t border-border/50" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.confirmations")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-foreground">
                {networkInfo.confirmations}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Important Warnings ── */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <svg
              className="h-3.5 w-3.5 text-amber-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-500">{t("wallet.importantNotice")}</p>
            <ul className="mt-2 space-y-1.5">
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.depositWarning1")}
              </li>
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.depositWarning2")}
              </li>
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.depositWarning3")}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Recent Deposits ── */}
      <section className="panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-foreground">
            {t("wallet.recentDeposits")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {MOCK_DEPOSITS.length}{" "}
            {MOCK_DEPOSITS.length === 1
              ? t("wallet.transactionCount", { count: String(MOCK_DEPOSITS.length) })
              : t("wallet.transactionCountPlural", { count: String(MOCK_DEPOSITS.length) })}
          </span>
        </div>

        {MOCK_DEPOSITS.length === 0 ? (
          <SectionEmptyState
            icon={
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            }
            title={t("wallet.noRecentDeposits")}
            description={t("wallet.noRecentDepositsDesc")}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.colDate")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.colAsset")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.colAmount")}
                    </th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      {t("wallet.colTxHash")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.colStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {MOCK_DEPOSITS.map((dep) => {
                    const statusInfo = STATUS_MAP[dep.status] ?? {
                      labelKey: dep.status,
                      className: "badge-muted",
                    };
                    const truncatedHash =
                      dep.txHash.length > 18
                        ? `${dep.txHash.slice(0, 8)}...${dep.txHash.slice(-8)}`
                        : dep.txHash;
                    return (
                      <tr key={dep.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                          {formatDateTime(dep.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={dep.asset} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{dep.asset}</p>
                              <p className="text-[11px] text-muted-foreground">{dep.network}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-up">
                          +{formatAmount(dep.amount, 6)}
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <div className="flex items-center">
                            <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
                              {truncatedHash}
                            </span>
                            <CopyButton text={dep.txHash} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`badge ${statusInfo.className}`}>
                            {t(statusInfo.labelKey)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
