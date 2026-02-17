"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import {
  type BalanceRow,
  type MessageState,
  SectionEmptyState,
  formatAmount,
  formatDateTime,
  formatDate,
  toNumber,
  coinName,
} from "./wallet-shared";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type EarningsSubTab = "pools" | "my-stakes" | "rewards";

type StakingPool = {
  id: string;
  asset: string;
  name: string;
  apy: number;
  lockDays: number;
  minStake: string;
  tvl: string;
};

type MyStake = {
  id: string;
  asset: string;
  amount: string;
  apy: number;
  startDate: string;
  lockUntil: string;
  earned: string;
  status: "active" | "unlocking" | "completed";
};

type RewardEntry = {
  id: string;
  date: string;
  asset: string;
  type: "staking" | "referral" | "airdrop";
  amount: string;
  status: "credited" | "pending";
};

type StakeModalState = { open: boolean; pool: StakingPool | null };
type UnstakeModalState = { open: boolean; stake: MyStake | null };
type ClaimModalState = { open: boolean; stake: MyStake | null };

/* ═══════════════════════════════════════════════════════════
   Mock Data
   ═══════════════════════════════════════════════════════════ */

const STAKING_POOLS: StakingPool[] = [
  { id: "pool-usdt", asset: "USDT", name: "USDT Flexible Earn", apy: 5.2, lockDays: 30, minStake: "100", tvl: "24,500,000" },
  { id: "pool-btc", asset: "BTC", name: "BTC Staking", apy: 3.8, lockDays: 60, minStake: "0.001", tvl: "1,250" },
  { id: "pool-eth", asset: "ETH", name: "ETH 2.0 Staking", apy: 4.5, lockDays: 90, minStake: "0.01", tvl: "18,200" },
  { id: "pool-sbk", asset: "SBK", name: "SBK Super Stake", apy: 12.0, lockDays: 14, minStake: "500", tvl: "8,750,000" },
  { id: "pool-g99", asset: "G99", name: "G99 Premium Pool", apy: 15.0, lockDays: 7, minStake: "1000", tvl: "12,300,000" },
];

const INITIAL_STAKES: MyStake[] = [
  { id: "stk-1", asset: "USDT", amount: "2,500.00", apy: 5.2, startDate: "2026-01-15T00:00:00Z", lockUntil: "2026-02-14T00:00:00Z", earned: "10.68", status: "completed" },
  { id: "stk-2", asset: "ETH", amount: "1.500000", apy: 4.5, startDate: "2026-02-01T00:00:00Z", lockUntil: "2026-05-01T00:00:00Z", earned: "0.002812", status: "active" },
  { id: "stk-3", asset: "SBK", amount: "5,000.00", apy: 12.0, startDate: "2026-02-10T00:00:00Z", lockUntil: "2026-02-24T00:00:00Z", earned: "11.51", status: "active" },
];

const INITIAL_REWARDS: RewardEntry[] = [
  { id: "rwd-1", date: "2026-02-16T08:00:00Z", asset: "USDT", type: "staking", amount: "1.42", status: "credited" },
  { id: "rwd-2", date: "2026-02-15T08:00:00Z", asset: "ETH", type: "staking", amount: "0.000094", status: "credited" },
  { id: "rwd-3", date: "2026-02-15T08:00:00Z", asset: "SBK", type: "staking", amount: "1.64", status: "credited" },
  { id: "rwd-4", date: "2026-02-14T12:00:00Z", asset: "USDT", type: "referral", amount: "25.00", status: "credited" },
  { id: "rwd-5", date: "2026-02-12T00:00:00Z", asset: "G99", type: "airdrop", amount: "500.00", status: "credited" },
  { id: "rwd-6", date: "2026-02-17T08:00:00Z", asset: "SBK", type: "staking", amount: "1.64", status: "pending" },
];

const REWARD_TYPE_BADGE: Record<string, { labelKey: string; className: string }> = {
  staking: { labelKey: "wallet.earnings.staking", className: "badge-success" },
  referral: { labelKey: "wallet.earnings.referral", className: "badge-info" },
  airdrop: { labelKey: "wallet.earnings.airdrop", className: "bg-purple-500/10 text-purple-500" },
};

const STAKE_STATUS_BADGE: Record<string, { labelKey: string; className: string }> = {
  active: { labelKey: "wallet.earnings.active", className: "badge-success" },
  unlocking: { labelKey: "wallet.earnings.unlocking", className: "badge-warning" },
  completed: { labelKey: "wallet.earnings.completed", className: "badge-muted" },
};

/* ═══════════════════════════════════════════════════════════
   Sub-Tab Buttons
   ═══════════════════════════════════════════════════════════ */

const EARNINGS_TABS: Array<{ key: EarningsSubTab; labelKey: string }> = [
  { key: "pools", labelKey: "wallet.earnings.stakingPools" },
  { key: "my-stakes", labelKey: "wallet.earnings.myStakes" },
  { key: "rewards", labelKey: "wallet.earnings.rewardsHistory" },
];

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

let stakeCounter = 4;
let rewardCounter = 7;

function nextStakeId() {
  return `stk-${stakeCounter++}`;
}
function nextRewardId() {
  return `rwd-${rewardCounter++}`;
}

function parseNumeric(val: string): number {
  const raw = val.replace(/,/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/* ═══════════════════════════════════════════════════════════
   ModalBackdrop — shared overlay
   ═══════════════════════════════════════════════════════════ */

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   StakeModal — 4-step flow
   ═══════════════════════════════════════════════════════════ */

type StakeStep = "input" | "confirm" | "processing" | "success";

function StakeModal({
  pool,
  availableBalance,
  t,
  onClose,
  onSuccess,
}: {
  pool: StakingPool;
  availableBalance: number;
  t: (key: string, params?: Record<string, string>) => string;
  onClose: () => void;
  onSuccess: (stake: MyStake) => void;
}) {
  const [step, setStep] = useState<StakeStep>("input");
  const [amount, setAmount] = useState("");

  const numAmount = parseNumeric(amount);
  const minStake = parseNumeric(pool.minStake);
  const dailyEarning = numAmount * (pool.apy / 100) / 365;
  const totalEstEarning = dailyEarning * pool.lockDays;
  const unlockDate = new Date(Date.now() + pool.lockDays * 86_400_000);

  const isValid = numAmount >= minStake && numAmount <= availableBalance && numAmount > 0;
  const isBelowMin = numAmount > 0 && numAmount < minStake;
  const isOverBalance = numAmount > availableBalance;

  const handleConfirm = useCallback(() => {
    setStep("processing");
    setTimeout(() => {
      const newStake: MyStake = {
        id: nextStakeId(),
        asset: pool.asset,
        amount: numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        apy: pool.apy,
        startDate: new Date().toISOString(),
        lockUntil: unlockDate.toISOString(),
        earned: "0.00",
        status: "active",
      };
      onSuccess(newStake);
      setStep("success");
    }, 2000);
  }, [numAmount, pool, unlockDate, onSuccess]);

  return (
    <ModalBackdrop onClose={step === "processing" ? () => {} : onClose}>
      {/* ── INPUT STEP ── */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={pool.asset} size="lg" />
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {t("wallet.earnings.stakeModalTitle", { asset: pool.asset })}
              </h3>
              <p className="text-sm text-up font-semibold">{pool.apy}% APY</p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("wallet.earnings.stakeAmount")}
              </label>
              <span className="text-xs text-muted-foreground">
                {t("wallet.earnings.availableBalance")}:{" "}
                <span className="font-[var(--font-mono)] font-semibold text-foreground">
                  {formatAmount(String(availableBalance), 6)} {pool.asset}
                </span>
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9]*\.?[0-9]*$/.test(val)) setAmount(val);
                }}
                placeholder="0.00"
                className="input-field pr-16 font-[var(--font-mono)] text-sm"
              />
              <button
                type="button"
                onClick={() => setAmount(String(availableBalance))}
                className="absolute inset-y-0 right-1.5 my-1.5 flex items-center rounded-md bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {t("wallet.earnings.max")}
              </button>
            </div>
          </div>

          {/* Validation messages */}
          {isBelowMin && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-xs font-medium text-destructive">
                {t("wallet.earnings.belowMinimum", { min: pool.minStake, asset: pool.asset })}
              </p>
            </div>
          )}
          {isOverBalance && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-xs font-medium text-destructive">{t("wallet.earnings.insufficientBalance")}</p>
            </div>
          )}

          {/* Summary card */}
          {numAmount > 0 && !isBelowMin && !isOverBalance && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("wallet.earnings.lockPeriod")}</span>
                <span className="font-semibold text-foreground">{pool.lockDays} {t("wallet.earnings.days")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("wallet.earnings.estimatedEarnings")}</span>
                <span className="font-[var(--font-mono)] font-semibold text-up">
                  +{totalEstEarning.toFixed(6)} {pool.asset}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span />
                <span>~{dailyEarning.toFixed(6)} {pool.asset} {t("wallet.earnings.perDay")}</span>
              </div>
              <div className="my-1 border-t border-border/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("wallet.earnings.unlockDate")}</span>
                <span className="font-semibold text-foreground">{formatDate(unlockDate.toISOString())}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!isValid}
            onClick={() => setStep("confirm")}
            className="btn-primary w-full"
          >
            {t("wallet.earnings.continue")}
          </button>
        </div>
      )}

      {/* ── CONFIRM STEP ── */}
      {step === "confirm" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">{t("wallet.earnings.confirmStake")}</h3>
          <p className="text-sm text-muted-foreground">{t("wallet.earnings.confirmStakeDesc")}</p>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.stakeAmount")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-foreground">{amount} {pool.asset}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">APY</span>
              <span className="font-semibold text-up">{pool.apy}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.lockPeriod")}</span>
              <span className="font-semibold text-foreground">{pool.lockDays} {t("wallet.earnings.days")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.estimatedEarnings")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-up">+{totalEstEarning.toFixed(6)} {pool.asset}</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {t("wallet.earnings.lockWarning", { days: String(pool.lockDays) })}
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("input")} className="btn-ghost flex-1">
              {t("wallet.earnings.back")}
            </button>
            <button type="button" onClick={handleConfirm} className="btn-primary flex-1">
              {t("wallet.earnings.confirmStake")}
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING STEP ── */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">{t("wallet.earnings.processingStake")}</p>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">{t("wallet.earnings.stakeSuccess")}</h3>
          <p className="text-sm text-center text-muted-foreground">
            {t("wallet.earnings.stakeSuccessDesc", { amount, asset: pool.asset })}
          </p>
          <div className="flex w-full gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              {t("wallet.earnings.stakeMore")}
            </button>
            <button type="button" onClick={onClose} className="btn-primary flex-1">
              {t("wallet.earnings.viewMyStakes")}
            </button>
          </div>
        </div>
      )}
    </ModalBackdrop>
  );
}

/* ═══════════════════════════════════════════════════════════
   UnstakeModal — 3-step flow
   ═══════════════════════════════════════════════════════════ */

type UnstakeStep = "confirm" | "processing" | "success";

function UnstakeModal({
  stake,
  t,
  onClose,
  onSuccess,
}: {
  stake: MyStake;
  t: (key: string, params?: Record<string, string>) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<UnstakeStep>("confirm");

  const stakeAmount = parseNumeric(stake.amount);
  const earned = parseNumeric(stake.earned);
  const isEarly = new Date(stake.lockUntil) > new Date();
  const penalty = isEarly ? stakeAmount * 0.1 : 0;
  const receiveAmount = stakeAmount - penalty + earned;

  const handleConfirm = useCallback(() => {
    setStep("processing");
    setTimeout(() => {
      onSuccess();
      setStep("success");
    }, 1500);
  }, [onSuccess]);

  return (
    <ModalBackdrop onClose={step === "processing" ? () => {} : onClose}>
      {/* ── CONFIRM STEP ── */}
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={stake.asset} size="lg" />
            <h3 className="text-lg font-bold text-foreground">
              {t("wallet.earnings.unstakeModalTitle", { asset: stake.asset })}
            </h3>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.unstakeAmount")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-foreground">{stake.amount} {stake.asset}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.earnedRewards")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-up">+{stake.earned} {stake.asset}</span>
            </div>
            {isEarly && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("wallet.earnings.earlyPenalty")}</span>
                <span className="font-[var(--font-mono)] font-semibold text-down">-{penalty.toFixed(6)} {stake.asset}</span>
              </div>
            )}
            <div className="my-1 border-t border-border/50" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">{t("wallet.earnings.youWillReceive")}</span>
              <span className="font-[var(--font-mono)] font-bold text-foreground">{receiveAmount.toFixed(6)} {stake.asset}</span>
            </div>
          </div>

          {isEarly ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-xs font-medium text-destructive">{t("wallet.earnings.earlyPenaltyWarning")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("wallet.earnings.noPenalty")}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              {t("wallet.earnings.cancel")}
            </button>
            <button type="button" onClick={handleConfirm} className="btn-primary flex-1">
              {t("wallet.earnings.confirmUnstake")}
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING STEP ── */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">{t("wallet.earnings.processingUnstake")}</p>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">{t("wallet.earnings.unstakeSuccess")}</h3>
          <p className="text-sm text-center text-muted-foreground">
            {t("wallet.earnings.unstakeSuccessDesc", { amount: receiveAmount.toFixed(6), asset: stake.asset })}
          </p>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            {t("wallet.earnings.close")}
          </button>
        </div>
      )}
    </ModalBackdrop>
  );
}

/* ═══════════════════════════════════════════════════════════
   ClaimModal — 3-step flow
   ═══════════════════════════════════════════════════════════ */

type ClaimStep = "confirm" | "processing" | "success";

function ClaimModal({
  stake,
  t,
  onClose,
  onSuccess,
}: {
  stake: MyStake;
  t: (key: string, params?: Record<string, string>) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<ClaimStep>("confirm");

  const stakeAmount = parseNumeric(stake.amount);
  const earned = parseNumeric(stake.earned);
  const totalClaim = stakeAmount + earned;

  const handleConfirm = useCallback(() => {
    setStep("processing");
    setTimeout(() => {
      onSuccess();
      setStep("success");
    }, 1500);
  }, [onSuccess]);

  return (
    <ModalBackdrop onClose={step === "processing" ? () => {} : onClose}>
      {/* ── CONFIRM STEP ── */}
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={stake.asset} size="lg" />
            <h3 className="text-lg font-bold text-foreground">{t("wallet.earnings.claimModalTitle")}</h3>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.originalStake")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-foreground">{stake.amount} {stake.asset}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("wallet.earnings.earnedRewards")}</span>
              <span className="font-[var(--font-mono)] font-semibold text-up">+{stake.earned} {stake.asset}</span>
            </div>
            <div className="my-1 border-t border-border/50" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">{t("wallet.earnings.totalClaim")}</span>
              <span className="font-[var(--font-mono)] font-bold text-foreground">{totalClaim.toFixed(6)} {stake.asset}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              {t("wallet.earnings.cancel")}
            </button>
            <button type="button" onClick={handleConfirm} className="btn-primary flex-1">
              {t("wallet.earnings.confirmClaim")}
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING STEP ── */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">{t("wallet.earnings.processingClaim")}</p>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">{t("wallet.earnings.claimSuccess")}</h3>
          <p className="text-sm text-center text-muted-foreground">
            {t("wallet.earnings.claimSuccessDesc", { amount: totalClaim.toFixed(6), asset: stake.asset })}
          </p>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            {t("wallet.earnings.close")}
          </button>
        </div>
      )}
    </ModalBackdrop>
  );
}

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export function WalletEarningsTab({ balances }: { balances: BalanceRow[] }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<EarningsSubTab>("pools");
  const [stakes, setStakes] = useState<MyStake[]>(INITIAL_STAKES);
  const [rewards, setRewards] = useState<RewardEntry[]>(INITIAL_REWARDS);
  const [message, setMessage] = useState<MessageState | null>(null);

  /* ── Modal state ── */
  const [stakeModal, setStakeModal] = useState<StakeModalState>({ open: false, pool: null });
  const [unstakeModal, setUnstakeModal] = useState<UnstakeModalState>({ open: false, stake: null });
  const [claimModal, setClaimModal] = useState<ClaimModalState>({ open: false, stake: null });

  /* ── Auto-dismiss message ── */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  /* ── Summary calculations ── */
  const totalStaked = useMemo(() => {
    return stakes.filter((s) => s.status === "active").reduce((acc, s) => acc + parseNumeric(s.amount), 0);
  }, [stakes]);

  const totalRewards = useMemo(() => {
    return rewards.filter((r) => r.status === "credited").reduce((acc, r) => acc + parseNumeric(r.amount), 0);
  }, [rewards]);

  const avgApy = useMemo(() => {
    const active = stakes.filter((s) => s.status === "active");
    if (active.length === 0) return 0;
    return active.reduce((sum, s) => sum + s.apy, 0) / active.length;
  }, [stakes]);

  /* ── Available balance lookup ── */
  const getAvailable = (asset: string): string => {
    const row = balances.find((b) => b.asset === asset);
    return row ? formatAmount(row.available, 6) : "0.00";
  };

  const getAvailableNum = (asset: string): number => {
    const row = balances.find((b) => b.asset === asset);
    return row ? toNumber(row.available) : 0;
  };

  /* ── Modal handlers ── */
  const handleStakeSuccess = useCallback((newStake: MyStake) => {
    setStakes((prev) => [newStake, ...prev]);
    setMessage({ text: t("wallet.earnings.stakeSuccess"), type: "success" });
  }, [t]);

  const handleStakeModalClose = useCallback(() => {
    setStakeModal({ open: false, pool: null });
    setSubTab("my-stakes");
  }, []);

  const handleUnstakeSuccess = useCallback((stakeToRemove: MyStake) => {
    setStakes((prev) => prev.filter((s) => s.id !== stakeToRemove.id));
    const earned = parseNumeric(stakeToRemove.earned);
    if (earned > 0) {
      setRewards((prev) => [{
        id: nextRewardId(),
        date: new Date().toISOString(),
        asset: stakeToRemove.asset,
        type: "staking",
        amount: stakeToRemove.earned,
        status: "credited",
      }, ...prev]);
    }
    setMessage({ text: t("wallet.earnings.unstakeSuccess"), type: "success" });
  }, [t]);

  const handleClaimSuccess = useCallback((stakeToRemove: MyStake) => {
    setStakes((prev) => prev.filter((s) => s.id !== stakeToRemove.id));
    const earned = parseNumeric(stakeToRemove.earned);
    const total = parseNumeric(stakeToRemove.amount) + earned;
    setRewards((prev) => [{
      id: nextRewardId(),
      date: new Date().toISOString(),
      asset: stakeToRemove.asset,
      type: "staking",
      amount: total.toFixed(6),
      status: "credited",
    }, ...prev]);
    setMessage({ text: t("wallet.earnings.claimSuccess"), type: "success" });
  }, [t]);

  return (
    <section className="space-y-4 animate-fade-in">
      {/* ── Feedback Message ── */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium animate-fade-in ${
          message.type === "success"
            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            : message.type === "error"
              ? "border-destructive/20 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/5 text-primary"
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.earnings.totalStaked")}
            </p>
            <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
              ${totalStaked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.earnings.totalRewards")}
            </p>
            <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-up">
              +${totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.earnings.avgApy")}
            </p>
            <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-up">
              {avgApy.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* ── Sub-Tab Navigation ── */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {EARNINGS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            className={`flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              subTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ═══ STAKING POOLS ═══ */}
      {subTab === "pools" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
          {STAKING_POOLS.map((pool) => (
            <div key={pool.id} className="panel panel-hover flex flex-col transition-all">
              {/* Pool header */}
              <div className="flex items-center gap-3">
                <CoinIcon symbol={pool.asset} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{pool.name}</p>
                  <p className="text-xs text-muted-foreground">{coinName(pool.asset)}</p>
                </div>
              </div>

              {/* APY highlight */}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-[var(--font-display)] text-3xl font-bold text-up">
                  {pool.apy}%
                </span>
                <span className="text-xs font-medium text-muted-foreground">APY</span>
              </div>

              {/* Details */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("wallet.earnings.lockPeriod")}</span>
                  <span className="font-medium text-foreground">
                    {pool.lockDays} {t("wallet.earnings.days")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("wallet.earnings.minStake")}</span>
                  <span className="font-[var(--font-mono)] font-medium text-foreground">
                    {pool.minStake} {pool.asset}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("wallet.earnings.tvl")}</span>
                  <span className="font-[var(--font-mono)] font-medium text-foreground">
                    {pool.tvl} {pool.asset}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("wallet.earnings.yourBalance")}</span>
                  <span className="font-[var(--font-mono)] font-medium text-foreground">
                    {getAvailable(pool.asset)} {pool.asset}
                  </span>
                </div>
              </div>

              {/* Stake button */}
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setStakeModal({ open: true, pool })}
                  className="btn-primary w-full !py-2 text-sm"
                >
                  {t("wallet.earnings.stake")} {pool.asset}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MY STAKES ═══ */}
      {subTab === "my-stakes" && (
        <div className="panel !p-0 animate-fade-in">
          {stakes.length === 0 ? (
            <SectionEmptyState
              icon={
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                </svg>
              }
              title={t("wallet.earnings.noStakes")}
              description={t("wallet.earnings.noStakesDesc")}
              action={
                <button type="button" onClick={() => setSubTab("pools")} className="btn-primary !py-2 !text-xs">
                  {t("wallet.earnings.browsePools")}
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colAsset")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colStaked")}
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      {t("wallet.earnings.colApy")}
                    </th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      {t("wallet.earnings.colLockPeriod")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colEarned")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colStatus")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colAction")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {stakes.map((stake) => {
                    const statusBadge = STAKE_STATUS_BADGE[stake.status] ?? { labelKey: stake.status, className: "badge-muted" };
                    return (
                      <tr key={stake.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={stake.asset} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{stake.asset}</p>
                              <p className="text-[11px] text-muted-foreground">{coinName(stake.asset)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-foreground">
                          {stake.amount}
                        </td>
                        <td className="hidden px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-up sm:table-cell">
                          {stake.apy}%
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <p className="text-xs text-muted-foreground">{formatDate(stake.startDate)}</p>
                          <p className="text-xs text-muted-foreground">- {formatDate(stake.lockUntil)}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-up">
                          +{stake.earned}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`badge ${statusBadge.className}`}>
                            {t(statusBadge.labelKey)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {stake.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => setUnstakeModal({ open: true, stake })}
                              className="btn-ghost !px-3 !py-1.5 !text-xs text-down"
                            >
                              {t("wallet.earnings.unstake")}
                            </button>
                          ) : stake.status === "completed" ? (
                            <button
                              type="button"
                              onClick={() => setClaimModal({ open: true, stake })}
                              className="btn-ghost !px-3 !py-1.5 !text-xs"
                            >
                              {t("wallet.earnings.claim")}
                            </button>
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
          )}
        </div>
      )}

      {/* ═══ REWARDS HISTORY ═══ */}
      {subTab === "rewards" && (
        <div className="panel !p-0 animate-fade-in">
          {rewards.length === 0 ? (
            <SectionEmptyState
              icon={
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                </svg>
              }
              title={t("wallet.earnings.noRewards")}
              description={t("wallet.earnings.noRewardsDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colDate")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colAsset")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colType")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colAmount")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("wallet.earnings.colStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rewards.map((reward) => {
                    const typeBadge = REWARD_TYPE_BADGE[reward.type] ?? { labelKey: reward.type, className: "badge-muted" };
                    return (
                      <tr key={reward.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                          {formatDateTime(reward.date)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={reward.asset} size="sm" />
                            <span className="text-sm font-semibold text-foreground">{reward.asset}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`badge ${typeBadge.className}`}>
                            {t(typeBadge.labelKey)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-[var(--font-mono)] text-sm font-semibold text-up">
                          +{reward.amount}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`badge ${reward.status === "credited" ? "badge-success" : "badge-warning"}`}>
                            {t(reward.status === "credited" ? "wallet.earnings.credited" : "wallet.earnings.pendingReward")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      {stakeModal.open && stakeModal.pool && (
        <StakeModal
          pool={stakeModal.pool}
          availableBalance={getAvailableNum(stakeModal.pool.asset)}
          t={t}
          onClose={handleStakeModalClose}
          onSuccess={handleStakeSuccess}
        />
      )}

      {unstakeModal.open && unstakeModal.stake && (
        <UnstakeModal
          stake={unstakeModal.stake}
          t={t}
          onClose={() => setUnstakeModal({ open: false, stake: null })}
          onSuccess={() => {
            handleUnstakeSuccess(unstakeModal.stake!);
            setUnstakeModal({ open: false, stake: null });
          }}
        />
      )}

      {claimModal.open && claimModal.stake && (
        <ClaimModal
          stake={claimModal.stake}
          t={t}
          onClose={() => setClaimModal({ open: false, stake: null })}
          onSuccess={() => {
            handleClaimSuccess(claimModal.stake!);
            setClaimModal({ open: false, stake: null });
          }}
        />
      )}
    </section>
  );
}
