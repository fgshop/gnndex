"use client";

import { useCallback, useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type BalanceRow,
  AVAILABLE_ASSETS,
  COIN_NAMES,
  ChevronDown,
  coinName,
  formatAmount,
  toNumber,
} from "./wallet-shared";

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

type SwapSubTab = "swap" | "bridge";

/** Mock USDT prices for each asset */
const MOCK_PRICES: Record<string, number> = {
  BTC: 42350,
  ETH: 2650,
  SOL: 98,
  BNB: 310,
  XRP: 0.62,
  SBK: 0.45,
  G99: 0.12,
  USDT: 1,
};

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0];

type Chain = {
  id: string;
  name: string;
  icon: string;
  color: string;
  estimatedTime: string;
};

const CHAINS: Chain[] = [
  { id: "ethereum", name: "Ethereum", icon: "\u039E", color: "#627EEA", estimatedTime: "~15 min" },
  { id: "bsc", name: "BNB Smart Chain", icon: "B", color: "#F3BA2F", estimatedTime: "~5 min" },
  { id: "polygon", name: "Polygon", icon: "M", color: "#8247E5", estimatedTime: "~7 min" },
  { id: "avalanche", name: "Avalanche", icon: "A", color: "#E84142", estimatedTime: "~3 min" },
  { id: "solana", name: "Solana", icon: "\u25CE", color: "#9945FF", estimatedTime: "~2 min" },
];

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function getRate(from: string, to: string): number {
  const fromPrice = MOCK_PRICES[from] ?? 0;
  const toPrice = MOCK_PRICES[to] ?? 0;
  if (toPrice === 0) return 0;
  return fromPrice / toPrice;
}

function formatRate(value: number): string {
  if (value >= 1000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function getPriceImpact(amount: number, fromAsset: string): number {
  // Mock: bigger amounts relative to asset price have higher impact
  const price = MOCK_PRICES[fromAsset] ?? 1;
  const usdValue = amount * price;
  if (usdValue < 1000) return 0.01;
  if (usdValue < 10000) return 0.15;
  if (usdValue < 50000) return 0.8;
  if (usdValue < 200000) return 2.1;
  return 4.5;
}

function priceImpactColor(impact: number): string {
  if (impact < 1) return "text-up";
  if (impact < 3) return "text-amber-500";
  return "text-down";
}

/* ═══════════════════════════════════════════════════════════
   Icons
   ═══════════════════════════════════════════════════════════ */

function SwapArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Asset Selector Dropdown
   ═══════════════════════════════════════════════════════════ */

function AssetSelector({
  value,
  onChange,
  exclude,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const assets = AVAILABLE_ASSETS.filter((a) => a !== exclude);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
      >
        <CoinIcon symbol={value} size="sm" />
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-xl">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            {assets.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { onChange(a); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${a === value ? "bg-primary/10 text-primary" : "text-foreground"}`}
              >
                <CoinIcon symbol={a} size="sm" />
                <div>
                  <span className="font-medium">{a}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{coinName(a)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Chain Selector
   ═══════════════════════════════════════════════════════════ */

function ChainSelector({
  value,
  onChange,
  exclude,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const chains = CHAINS.filter((c) => c.id !== exclude);
  const selected = CHAINS.find((c) => c.id === value);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60"
        >
          {selected && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: selected.color }}
            >
              {selected.icon}
            </span>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{selected?.name ?? "Select"}</p>
            <p className="text-xs text-muted-foreground">{selected?.estimatedTime ?? ""}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-card p-1 shadow-xl">
              {chains.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted ${c.id === value ? "bg-primary/10" : ""}`}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: c.color }}
                  >
                    {c.icon}
                  </span>
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.estimatedTime}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Swap Sub-Tab
   ═══════════════════════════════════════════════════════════ */

function SwapPanel({ balances }: { balances: BalanceRow[] }) {
  const { t } = useTranslation();

  const [fromAsset, setFromAsset] = useState("BTC");
  const [toAsset, setToAsset] = useState("USDT");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [rotated, setRotated] = useState(false);

  const fromBalance = useMemo(() => {
    const found = balances.find((b) => b.asset === fromAsset);
    return found ? toNumber(found.available) : 0;
  }, [balances, fromAsset]);

  const rate = useMemo(() => getRate(fromAsset, toAsset), [fromAsset, toAsset]);
  const fromNum = toNumber(fromAmount);
  const toAmount = fromNum * rate;
  const priceImpact = fromNum > 0 ? getPriceImpact(fromNum, fromAsset) : 0;

  const tradingFee = fromNum * 0.003; // 0.3%
  const networkFee = 0.0005;

  const isDisabled = swapping || fromNum <= 0 || fromNum > fromBalance;

  const handleSwapDirection = useCallback(() => {
    setRotated((r) => !r);
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount("");
  }, [fromAsset, toAsset]);

  const handleSwap = useCallback(async () => {
    setSwapping(true);
    // Mock swap execution
    await new Promise((r) => setTimeout(r, 2000));
    setSwapping(false);
    setFromAmount("");
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 animate-fade-in">
      {/* Header with settings */}
      <div className="flex items-center justify-between">
        <h3 className="font-[var(--font-display)] text-lg font-bold text-foreground">
          {t("wallet.swap.title")}
        </h3>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`rounded-lg p-2 transition-colors ${showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Slippage settings */}
      {showSettings && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 animate-fade-in">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("wallet.swap.slippageTolerance")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {SLIPPAGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setSlippage(opt); setCustomSlippage(""); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  slippage === opt && !customSlippage
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt}%
              </button>
            ))}
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={customSlippage}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                    setCustomSlippage(val);
                    const num = Number(val);
                    if (num > 0 && num <= 50) setSlippage(num);
                  }
                }}
                placeholder={t("wallet.swap.custom")}
                className="input-field !py-1.5 pr-6 text-center text-sm"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      )}

      {/* From panel */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("wallet.swap.from")}</span>
          <span className="text-xs text-muted-foreground">
            {t("wallet.swap.balance")}:{" "}
            <span className="font-[var(--font-mono)] font-medium text-foreground">
              {formatAmount(String(fromBalance), 6)}
            </span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <AssetSelector
            value={fromAsset}
            onChange={setFromAsset}
            exclude={toAsset}
            label={t("wallet.swap.selectToken")}
          />
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="decimal"
              value={fromAmount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*\.?[0-9]*$/.test(val)) setFromAmount(val);
              }}
              placeholder="0.0"
              className="w-full bg-transparent text-right font-[var(--font-mono)] text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFromAmount(String(fromBalance))}
            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            MAX
          </button>
          <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
            ~${fromNum > 0 ? (fromNum * (MOCK_PRICES[fromAsset] ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
          </span>
        </div>
      </div>

      {/* Swap direction button */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 border-t border-border/50" />
        <button
          type="button"
          onClick={handleSwapDirection}
          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-card bg-muted text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground ${
            rotated ? "[transform:rotate(180deg)]" : "[transform:rotate(0deg)]"
          }`}
          style={{ transition: "transform 0.3s ease, background-color 0.2s, color 0.2s" }}
        >
          <SwapArrowIcon className="h-5 w-5" />
        </button>
      </div>

      {/* To panel */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("wallet.swap.to")}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <AssetSelector
            value={toAsset}
            onChange={setToAsset}
            exclude={fromAsset}
            label={t("wallet.swap.selectToken")}
          />
          <div className="flex-1 text-right">
            <p className="font-[var(--font-mono)] text-2xl font-bold text-foreground">
              {fromNum > 0 ? formatRate(toAmount) : "0.0"}
            </p>
          </div>
        </div>
        <div className="mt-2 text-right">
          <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
            ~${toAmount > 0 ? (toAmount * (MOCK_PRICES[toAsset] ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
          </span>
        </div>
      </div>

      {/* Rate & details */}
      {fromNum > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 animate-fade-in">
          {/* Exchange rate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.swap.rate")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              1 {fromAsset} = {formatRate(rate)} {toAsset}
            </span>
          </div>

          {/* Price impact */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              {t("wallet.swap.priceImpact")}
              <InfoIcon className="h-3.5 w-3.5" />
            </span>
            <span className={`font-[var(--font-mono)] font-medium ${priceImpactColor(priceImpact)}`}>
              {priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2)}%
            </span>
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.swap.slippageTolerance")}</span>
            <span className="font-[var(--font-mono)] text-foreground">{slippage}%</span>
          </div>

          {/* Route */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.swap.route")}</span>
            <span className="flex items-center gap-1 text-foreground">
              <CoinIcon symbol={fromAsset} size="xs" />
              {fromAsset}
              <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
              <CoinIcon symbol={toAsset} size="xs" />
              {toAsset}
              <span className="ml-1 text-xs text-muted-foreground">via GnnDEX</span>
            </span>
          </div>

          <div className="border-t border-border/50" />

          {/* Fee breakdown */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.swap.tradingFee")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              {formatAmount(String(tradingFee), 6)} {fromAsset}
              <span className="ml-1 text-xs text-muted-foreground">(0.3%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.swap.networkFee")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              ~{networkFee} {fromAsset}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-foreground">{t("wallet.swap.totalFee")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              {formatAmount(String(tradingFee + networkFee), 6)} {fromAsset}
            </span>
          </div>
        </div>
      )}

      {/* Minimum received */}
      {fromNum > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{t("wallet.swap.minimumReceived")}</span>
          <span className="font-[var(--font-mono)] font-medium text-foreground">
            {formatRate(toAmount * (1 - slippage / 100))} {toAsset}
          </span>
        </div>
      )}

      {/* Swap button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleSwap()}
        className="btn-primary w-full !py-4 text-base font-bold"
      >
        {swapping ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {t("wallet.swap.swapping")}
          </span>
        ) : fromNum <= 0 ? (
          t("wallet.swap.enterAmount")
        ) : fromNum > fromBalance ? (
          t("wallet.swap.insufficientBalance")
        ) : (
          t("wallet.swap.swapButton")
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Bridge Sub-Tab
   ═══════════════════════════════════════════════════════════ */

function BridgePanel({ balances }: { balances: BalanceRow[] }) {
  const { t } = useTranslation();

  const [sourceChain, setSourceChain] = useState("ethereum");
  const [destChain, setDestChain] = useState("bsc");
  const [bridgeAsset, setBridgeAsset] = useState("USDT");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [bridging, setBridging] = useState(false);

  const assetBalance = useMemo(() => {
    const found = balances.find((b) => b.asset === bridgeAsset);
    return found ? toNumber(found.available) : 0;
  }, [balances, bridgeAsset]);

  const sourceChainData = CHAINS.find((c) => c.id === sourceChain);
  const destChainData = CHAINS.find((c) => c.id === destChain);

  const bridgeNum = toNumber(bridgeAmount);
  const bridgeFee = bridgeNum * 0.001; // 0.1% bridge fee
  const bridgeReceive = Math.max(0, bridgeNum - bridgeFee);
  const isDisabled = bridging || bridgeNum <= 0 || bridgeNum > assetBalance;

  const handleBridge = useCallback(async () => {
    setBridging(true);
    await new Promise((r) => setTimeout(r, 2500));
    setBridging(false);
    setBridgeAmount("");
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 animate-fade-in">
      <h3 className="font-[var(--font-display)] text-lg font-bold text-foreground">
        {t("wallet.bridge.title")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("wallet.bridge.description")}
      </p>

      {/* Chain selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChainSelector
          value={sourceChain}
          onChange={setSourceChain}
          exclude={destChain}
          label={t("wallet.bridge.sourceChain")}
        />
        <ChainSelector
          value={destChain}
          onChange={setDestChain}
          exclude={sourceChain}
          label={t("wallet.bridge.destChain")}
        />
      </div>

      {/* Bridge route visualization */}
      {sourceChainData && destChainData && (
        <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-muted/20 py-4">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: sourceChainData.color }}
            >
              {sourceChainData.icon}
            </span>
            <span className="text-xs font-medium text-foreground">{sourceChainData.name}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="h-px w-8 bg-border" />
              <ArrowRightIcon className="h-4 w-4" />
              <div className="h-px w-8 bg-border" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ClockIcon className="h-3 w-3" />
              {destChainData.estimatedTime}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: destChainData.color }}
            >
              {destChainData.icon}
            </span>
            <span className="text-xs font-medium text-foreground">{destChainData.name}</span>
          </div>
        </div>
      )}

      {/* Asset & amount */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("wallet.bridge.asset")}</span>
          <span className="text-xs text-muted-foreground">
            {t("wallet.swap.balance")}:{" "}
            <span className="font-[var(--font-mono)] font-medium text-foreground">
              {formatAmount(String(assetBalance), 6)}
            </span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <AssetSelector
            value={bridgeAsset}
            onChange={setBridgeAsset}
            label={t("wallet.swap.selectToken")}
          />
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="decimal"
              value={bridgeAmount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*\.?[0-9]*$/.test(val)) setBridgeAmount(val);
              }}
              placeholder="0.0"
              className="w-full bg-transparent text-right font-[var(--font-mono)] text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setBridgeAmount(String(assetBalance))}
            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            MAX
          </button>
          <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
            ~${bridgeNum > 0 ? (bridgeNum * (MOCK_PRICES[bridgeAsset] ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
          </span>
        </div>
      </div>

      {/* Fee & receive breakdown */}
      {bridgeNum > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 animate-fade-in">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.bridge.bridgeFee")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              {formatAmount(String(bridgeFee), 6)} {bridgeAsset}
              <span className="ml-1 text-xs text-muted-foreground">(0.1%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.bridge.estimatedTime")}</span>
            <span className="flex items-center gap-1 text-foreground">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {destChainData?.estimatedTime ?? "~15 min"}
            </span>
          </div>
          <div className="border-t border-border/50" />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-foreground">{t("wallet.bridge.youWillReceive")}</span>
            <span className="font-[var(--font-mono)] text-foreground">
              {formatAmount(String(bridgeReceive), 6)} {bridgeAsset}
            </span>
          </div>
        </div>
      )}

      {/* Security warning */}
      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-amber-500">{t("wallet.bridge.securityTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("wallet.bridge.securityWarning")}
          </p>
        </div>
      </div>

      {/* Bridge button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleBridge()}
        className="btn-primary w-full !py-4 text-base font-bold"
      >
        {bridging ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {t("wallet.bridge.bridging")}
          </span>
        ) : bridgeNum <= 0 ? (
          t("wallet.swap.enterAmount")
        ) : bridgeNum > assetBalance ? (
          t("wallet.swap.insufficientBalance")
        ) : (
          t("wallet.bridge.bridgeButton")
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Export
   ═══════════════════════════════════════════════════════════ */

export function WalletSwapTab({ balances }: { balances: BalanceRow[] }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SwapSubTab>("swap");

  return (
    <section className="panel animate-fade-in">
      {/* Sub-tab navigation */}
      <nav className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setSubTab("swap")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            subTab === "swap"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {t("wallet.swap.tabSwap")}
        </button>
        <button
          type="button"
          onClick={() => setSubTab("bridge")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            subTab === "bridge"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9h4v12H2z" /><path d="M18 9h4v12h-4z" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M6 9l4-5h4l4 5" />
          </svg>
          {t("wallet.bridge.tabBridge")}
        </button>
      </nav>

      {subTab === "swap" ? (
        <SwapPanel balances={balances} />
      ) : (
        <BridgePanel balances={balances} />
      )}
    </section>
  );
}
