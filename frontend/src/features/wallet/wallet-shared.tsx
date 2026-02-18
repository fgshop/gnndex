"use client";

import { useState } from "react";

/* ═══════════════════════════════════════════════════════════
   Shared Types
   ═══════════════════════════════════════════════════════════ */

export type BalanceRow = {
  asset: string;
  available: string;
  locked: string;
  depositAddress?: string | null;
};

export type WithdrawalRow = {
  withdrawalId: string;
  asset: string;
  network: string;
  amount: string;
  fee: string;
  status: string;
  requestedAt: string;
  rejectReason?: string | null;
  txHash?: string | null;
  address?: string | null;
};

export type BalancesStreamEvent = {
  eventId: string;
  eventType: "user.balances.snapshot" | "user.balances.error";
  eventVersion: number;
  occurredAt: string;
  data: BalanceRow[] | { message?: string };
};

export type WalletTab = "overview" | "assets" | "deposit" | "withdraw" | "swap" | "history" | "earnings";

export type PortfolioItem = {
  asset: string;
  available: number;
  locked: number;
  total: number;
  pct: number;
};

export type MessageState = {
  text: string;
  type: "success" | "error" | "info";
};

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

export const WALLET_TABS: Array<{ key: WalletTab; labelKey: string; icon: string }> = [
  { key: "overview", labelKey: "wallet.tab.overview", icon: "grid" },
  { key: "assets", labelKey: "wallet.tab.assets", icon: "wallet" },
  { key: "deposit", labelKey: "wallet.tab.deposit", icon: "download" },
  { key: "withdraw", labelKey: "wallet.tab.withdraw", icon: "send" },
  { key: "swap", labelKey: "wallet.tab.swap", icon: "swap" },
  { key: "history", labelKey: "wallet.tab.history", icon: "clock" },
  { key: "earnings", labelKey: "wallet.tab.earnings", icon: "trending" },
];

export const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XRP: "Ripple",
  SBK: "SBK Token",
  G99: "G99 Token",
  USDT: "Tether",
  BNB: "BNB",
  MATIC: "Polygon",
  AVAX: "Avalanche",
  DOT: "Polkadot",
  ADA: "Cardano",
};

export type CoinNetworkInfo = {
  asset: string;
  name: string;
  type: "native" | "token";
  networks: Array<{
    network: string;
    displayName: string;
    confirmations: number;
    minDeposit: string;
    withdrawFee: string;
  }>;
};

export const STATUS_MAP: Record<string, { labelKey: string; className: string }> = {
  REQUESTED: { labelKey: "wallet.statusPending", className: "badge-warning" },
  REVIEW_PENDING: { labelKey: "wallet.statusReviewing", className: "badge-warning" },
  APPROVED: { labelKey: "wallet.statusApproved", className: "badge-info" },
  BROADCASTING: { labelKey: "wallet.statusBroadcasting", className: "bg-purple-500/10 text-purple-500" },
  CONFIRMED: { labelKey: "wallet.statusConfirmed", className: "badge-success" },
  REJECTED: { labelKey: "wallet.statusRejected", className: "badge-danger" },
  FAILED: { labelKey: "wallet.statusFailed", className: "badge-danger" },
  COMPLETED: { labelKey: "wallet.statusConfirmed", className: "badge-success" },
  PENDING: { labelKey: "wallet.statusPending", className: "badge-warning" },
};

export const PORTFOLIO_COLORS = [
  "bg-primary", "bg-accent", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-indigo-500",
];

/* ═══════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════ */

export function resolveWalletTab(raw: string | null): WalletTab {
  const valid: WalletTab[] = ["overview", "assets", "deposit", "withdraw", "swap", "history", "earnings"];
  if (raw && valid.includes(raw as WalletTab)) return raw as WalletTab;
  return "overview";
}

export function parseApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const payload = error as { message?: string | string[]; error?: string };
  if (Array.isArray(payload.message) && payload.message.length > 0) return payload.message.join(", ");
  if (typeof payload.message === "string" && payload.message.length > 0) return payload.message;
  if (typeof payload.error === "string" && payload.error.length > 0) return payload.error;
  return fallback;
}

export function toNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function formatAmount(raw: string, digits = 6): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

export function toBalanceRows(data: unknown): BalanceRow[] {
  return Array.isArray(data) ? (data as BalanceRow[]) : [];
}

export function toWithdrawalRows(data: unknown): WithdrawalRow[] {
  return Array.isArray(data) ? (data as WithdrawalRow[]) : [];
}

export function parseBalancesStreamEvent(raw: string): BalancesStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BalancesStreamEvent>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.eventType !== "user.balances.snapshot" && parsed.eventType !== "user.balances.error") return null;
    return parsed as BalancesStreamEvent;
  } catch {
    return null;
  }
}

export function truncateAddress(address: string | null | undefined, chars = 6): string {
  if (!address) return "--";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function coinName(asset: string): string {
  return COIN_NAMES[asset] ?? asset;
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════════
   Shared Icon Components
   ═══════════════════════════════════════════════════════════ */

export function TabIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "h-4 w-4";
  switch (type) {
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "wallet":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
        </svg>
      );
    case "download":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "send":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case "swap":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "trending":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
        </svg>
      );
    default:
      return null;
  }
}

export function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export function SectionEmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground/40">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
