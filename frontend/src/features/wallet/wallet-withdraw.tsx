"use client";

import { FormEvent, useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { useTranslation } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import {
  type BalanceRow,
  type MessageState,
  AVAILABLE_ASSETS,
  AVAILABLE_NETWORKS,
  ChevronDown,
  coinName,
  formatAmount,
  parseApiError,
  toNumber,
} from "@/features/wallet/wallet-shared";

/* ─── Component ─────────────────────────────────────────── */

type WalletWithdrawTabProps = {
  balances: BalanceRow[];
  onWithdraw: () => void;
  setMessage: (msg: MessageState) => void;
};

export function WalletWithdrawTab({ balances, onWithdraw, setMessage }: WalletWithdrawTabProps) {
  const { t } = useTranslation();

  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETH-ERC20");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [fee] = useState("0.1");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const selectedAssetBalance = useMemo(() => {
    const found = balances.find((b) => b.asset === asset);
    return found ? toNumber(found.available) : 0;
  }, [balances, asset]);

  const receiveAmount = useMemo(() => {
    if (!amount) return 0;
    return Math.max(0, toNumber(amount) - toNumber(fee));
  }, [amount, fee]);

  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    if (!amount || !address) {
      setMessage({ text: t("wallet.fillAllFields"), type: "error" });
      return;
    }

    const parsedAmount = toNumber(amount);
    if (parsedAmount <= 0) {
      setMessage({ text: t("wallet.invalidAmount"), type: "error" });
      return;
    }

    if (parsedAmount > selectedAssetBalance) {
      setMessage({ text: t("wallet.insufficientBalance"), type: "error" });
      return;
    }

    setWithdrawLoading(true);
    setMessage({ text: "", type: "info" });

    const { error } = await api.POST("/wallet/withdrawals", {
      body: { asset, network, address, memo: memo || undefined, amount, fee },
    });

    setWithdrawLoading(false);

    if (error) {
      setMessage({ text: parseApiError(error, t("wallet.withdrawalFailed")), type: "error" });
      return;
    }

    setMessage({ text: t("wallet.withdrawalSuccess"), type: "success" });
    setAmount("");
    setAddress("");
    setMemo("");
    onWithdraw();
  };

  return (
    <section className="panel animate-fade-in">
      <h2 className="font-[var(--font-display)] text-lg font-bold text-foreground">
        {t("wallet.withdrawFunds")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("wallet.withdrawDesc")}</p>

      <form className="mt-6 space-y-5" onSubmit={requestWithdrawal}>
        {/* Currency & Network row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Currency selector */}
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

        {/* Withdrawal address */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("wallet.withdrawalAddress")}
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("wallet.enterWalletAddress")}
            className="input-field font-[var(--font-mono)] text-sm"
            required
          />
        </div>

        {/* Memo (optional) */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("wallet.memo")}{" "}
            <span className="normal-case tracking-normal text-muted-foreground/60">
              {t("wallet.memoOptional")}
            </span>
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t("wallet.memoPlaceholder")}
            className="input-field text-sm"
          />
        </div>

        {/* Amount */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wallet.amount")}
            </label>
            <span className="text-xs text-muted-foreground">
              {t("wallet.available")}:{" "}
              <span className="font-[var(--font-mono)] font-semibold text-foreground">
                {formatAmount(String(selectedAssetBalance), 6)} {asset}
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
              required
            />
            <button
              type="button"
              onClick={() => setAmount(String(selectedAssetBalance))}
              className="absolute inset-y-0 right-1.5 my-1.5 flex items-center rounded-md bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Fee & total summary */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.networkFee")}</span>
            <span className="font-[var(--font-mono)] font-semibold text-foreground">
              {fee} {asset}
            </span>
          </div>
          <div className="my-2 border-t border-border/50" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("wallet.youWillReceive")}</span>
            <span className="font-[var(--font-mono)] font-semibold text-foreground">
              {formatAmount(String(receiveAmount), 6)} {asset}
            </span>
          </div>
        </div>

        {/* Balance warning */}
        {amount && toNumber(amount) > selectedAssetBalance && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-medium text-destructive">{t("wallet.insufficientBalance")}</p>
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-primary w-full"
          disabled={withdrawLoading || !amount || !address || toNumber(amount) > selectedAssetBalance}
          type="submit"
        >
          {withdrawLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {t("wallet.processing")}
            </span>
          ) : (
            t("wallet.submitWithdrawal")
          )}
        </button>
      </form>

      {/* ── Security Notice ── */}
      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-3.5 w-3.5 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("wallet.securityReminder")}</p>
            <ul className="mt-2 space-y-1.5">
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.withdrawWarning1")}
              </li>
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.withdrawWarning2")}
              </li>
              <li className="text-xs leading-relaxed text-muted-foreground">
                {t("wallet.withdrawWarning3")}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
