"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/features/auth/auth-context";
import { useTranslation } from "@/i18n/locale-context";
import { CoinIcon } from "@/components/coin-icon";
import { apiBaseUrl } from "@/lib/api";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

type BalanceRow = {
  asset: string;
  available: string;
  locked: string;
};

type LedgerRow = {
  id: string;
  asset: string;
  entryType: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

type OrderRow = {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  price: string | null;
  quantity: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
  createdAt?: string;
};

type OrdersListPayload = {
  items?: OrderRow[];
  page?: number;
  limit?: number;
  total?: number;
};

type TwoFactorSetupResponse = {
  email?: string;
  secret?: string;
  otpauthUrl?: string;
};

type MyPageTab = "overview" | "security" | "assets" | "activity";

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const TAB_ITEMS: Array<{ key: MyPageTab; labelKey: string; icon: string }> = [
  { key: "overview", labelKey: "mypage.tab.overview", icon: "grid" },
  { key: "security", labelKey: "mypage.tab.security", icon: "shield" },
  { key: "assets", labelKey: "mypage.tab.assets", icon: "wallet" },
  { key: "activity", labelKey: "mypage.tab.activity", icon: "list" },
];

/* ═══════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════ */

function resolveTab(raw: string | null): MyPageTab {
  if (raw === "security" || raw === "assets" || raw === "activity") return raw;
  return "overview";
}

function parseApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const payload = error as { message?: string | string[]; error?: string };
  if (Array.isArray(payload.message) && payload.message.length > 0) return payload.message.join(", ");
  if (typeof payload.message === "string" && payload.message.length > 0) return payload.message;
  if (typeof payload.error === "string" && payload.error.length > 0) return payload.error;
  return fallback;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(value: string, digits = 4): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractCoinFromSymbol(symbol: string): string {
  const parts = symbol.split("-");
  return parts[0] ?? symbol;
}

/* ═══════════════════════════════════════════════════════
   Icons
   ═══════════════════════════════════════════════════════ */

function TabIcon({ name }: { name: string }) {
  switch (name) {
    case "grid":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" />
        </svg>
      );
    case "shield":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "wallet":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      );
    case "list":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
      );
    default:
      return null;
  }
}

function RefreshIcon() {
  return (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ShieldOffIcon() {
  return (
    <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="9.5" x2="14.5" y1="9.5" y2="14.5" /><line x1="14.5" x2="9.5" y1="9.5" y2="14.5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   Status badges
   ═══════════════════════════════════════════════════════ */

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "badge-info",
    PARTIALLY_FILLED: "badge-warning",
    FILLED: "badge-success",
    CANCELED: "badge-muted",
    REJECTED: "badge-danger",
  };
  return <span className={map[status] ?? "badge-muted"}>{status}</span>;
}

function SideBadge({ side }: { side: "BUY" | "SELL" }) {
  return side === "BUY" ? (
    <span className="badge-success">BUY</span>
  ) : (
    <span className="badge-danger">SELL</span>
  );
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export function MyPagePanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isAuthenticated, session } = useAuth();
  const { t } = useTranslation();

  /* ── Data state ── */
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── 2FA state ── */
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorOtpAuthUrl, setTwoFactorOtpAuthUrl] = useState("");

  const activeTab = resolveTab(searchParams.get("tab"));

  /* ── Computed ── */
  const totalBalance = useMemo(
    () => balances.reduce((sum, r) => sum + toNumber(r.available) + toNumber(r.locked), 0),
    [balances]
  );
  const openOrdersCount = useMemo(
    () => orders.filter((r) => r.status === "NEW" || r.status === "PARTIALLY_FILLED").length,
    [orders]
  );
  const filledOrdersCount = useMemo(
    () => orders.filter((r) => r.status === "FILLED").length,
    [orders]
  );

  const userInitial = (session?.user?.email ?? "U").charAt(0).toUpperCase();
  const memberSince = t("mypage.memberSince");

  /* ── Data loading ── */
  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setBalances([]);
      setLedger([]);
      setOrders([]);
      setOrdersTotal(0);
      return;
    }

    setLoading(true);
    setError("");

    const [balancesRes, ledgerRes, ordersRes] = await Promise.all([
      fetch(`${apiBaseUrl}/wallet/balances`, {
        headers: { Authorization: `Bearer ${session?.tokens?.accessToken ?? ""}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`${apiBaseUrl}/wallet/ledger?limit=10`, {
        headers: { Authorization: `Bearer ${session?.tokens?.accessToken ?? ""}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`${apiBaseUrl}/orders?limit=10&sortBy=CREATED_AT&sortOrder=DESC`, {
        headers: { Authorization: `Bearer ${session?.tokens?.accessToken ?? ""}` },
      }).then((r) => r.json()).catch(() => null),
    ]);

    setLoading(false);

    setBalances(Array.isArray(balancesRes) ? (balancesRes as BalanceRow[]) : []);
    setLedger(Array.isArray(ledgerRes) ? (ledgerRes as LedgerRow[]) : []);

    const ordersPayload = (ordersRes ?? {}) as OrdersListPayload | OrderRow[];
    if (Array.isArray(ordersPayload)) {
      setOrders(ordersPayload);
      setOrdersTotal(ordersPayload.length);
    } else {
      setOrders(Array.isArray(ordersPayload.items) ? ordersPayload.items : []);
      setOrdersTotal(ordersPayload.total ?? 0);
    }
  }, [isAuthenticated, session?.tokens?.accessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ── 2FA handlers ── */
  const handleSetup2FA = async () => {
    const email = session?.user?.email;
    if (!email) { setSecurityError(t("mypage.twoFactor.emailNotFound")); return; }
    if (!password.trim()) { setSecurityError(t("mypage.twoFactor.passwordRequired")); return; }

    setSecurityLoading(true);
    setSecurityMessage("");
    setSecurityError("");

    try {
      const res = await fetch(`${apiBaseUrl}/auth/2fa/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as TwoFactorSetupResponse | unknown;

      if (!res.ok) {
        setSecurityError(parseApiError(data, `2FA setup failed (HTTP ${res.status}).`));
        return;
      }

      const result = data as TwoFactorSetupResponse;
      setTwoFactorSecret(result.secret ?? "");
      setTwoFactorOtpAuthUrl(result.otpauthUrl ?? "");
      setSecurityMessage(t("mypage.twoFactor.secretGenerated"));
    } catch {
      setSecurityError(t("mypage.twoFactor.setupError"));
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    const email = session?.user?.email;
    if (!email) { setSecurityError(t("mypage.twoFactor.emailNotFound")); return; }
    if (!password.trim()) { setSecurityError(t("mypage.twoFactor.passwordRequiredEnable")); return; }
    if (!twoFactorCode.trim()) { setSecurityError(t("mypage.twoFactor.codeRequired")); return; }

    setSecurityLoading(true);
    setSecurityMessage("");
    setSecurityError("");

    try {
      const res = await fetch(`${apiBaseUrl}/auth/2fa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code: twoFactorCode.trim() }),
      });
      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setSecurityError(parseApiError(data, `2FA activation failed (HTTP ${res.status}).`));
        return;
      }

      setSecurityMessage(t("mypage.twoFactor.enabled"));
      setTwoFactorCode("");
      setTwoFactorSecret("");
      setTwoFactorOtpAuthUrl("");
    } catch {
      setSecurityError(t("mypage.twoFactor.activationError"));
    } finally {
      setSecurityLoading(false);
    }
  };

  /* ── Navigation ── */
  const navigateToTab = (tab: MyPageTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /* ── Guard states ── */
  if (!isReady) {
    return (
      <section className="panel animate-fade-in p-8">
        <div className="flex items-center gap-3">
          <SpinnerIcon className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("mypage.loading")}</p>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="panel mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="28" className="text-primary">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">{t("mypage.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("mypage.signInDesc")}
        </p>
        <Link className="btn-primary mt-6 inline-block" href="/auth/login">
          {t("mypage.signIn")}
        </Link>
      </section>
    );
  }

  /* ═══════════════════════════════════════════════════════
     Main render
     ═══════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header card ── */}
      <section className="panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
              {userInitial}
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-xl font-bold text-foreground">
                {t("mypage.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{session?.user?.email ?? "-"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="badge-info">{session?.user?.role ?? "USER"}</span>
                <span className="text-xs text-muted-foreground">{memberSince}</span>
              </div>
            </div>
          </div>
          <button
            className="btn-ghost gap-1.5 !px-3 !py-2 text-xs"
            onClick={() => void loadData()}
            type="button"
          >
            <RefreshIcon />
            {t("mypage.refresh")}
          </button>
        </div>

        {/* Error */}
        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Tab navigation */}
        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
          {TAB_ITEMS.map((tab) => (
            <button
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
              key={tab.key}
              onClick={() => navigateToTab(tab.key)}
              type="button"
            >
              <TabIcon name={tab.icon} />
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
         Overview Tab
         ══════════════════════════════════ */}
      {activeTab === "overview" ? (
        <div className="space-y-6 animate-fade-up">
          {/* Quick stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.totalBalance")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                {loading ? "..." : formatAmount(String(totalBalance), 6)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("mypage.assetsHeld", { count: String(balances.length) })}</p>
            </article>
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.openOrders")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                {loading ? "..." : openOrdersCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("mypage.activePositions")}</p>
            </article>
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.completedTrades")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                {loading ? "..." : filledOrdersCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("mypage.totalOrders", { count: String(ordersTotal) })}</p>
            </article>
          </div>

          {/* Account summary */}
          <section className="panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("mypage.accountSummary")}</h2>
            <div className="mt-4 divide-y divide-border">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{t("mypage.email")}</span>
                <span className="text-sm font-medium text-foreground">{session?.user?.email ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{t("mypage.accountRole")}</span>
                <span className="badge-info">{session?.user?.role ?? "USER"}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{t("mypage.twoFactorAuth")}</span>
                <span className="badge-warning">{t("mypage.checkSecurity")}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{t("mypage.userId")}</span>
                <span className="font-mono text-xs text-muted-foreground">{session?.user?.userId ?? "-"}</span>
              </div>
            </div>
          </section>

          {/* Recent activity */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("mypage.recentActivity")}</h2>
              <button className="text-xs font-medium text-primary hover:text-primary/80" onClick={() => navigateToTab("activity")} type="button">
                {t("mypage.viewAll")}
              </button>
            </div>
            {orders.length === 0 && ledger.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">{t("mypage.noActivity")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("mypage.noActivityHint")}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {orders.slice(0, 5).map((o) => (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3" key={o.orderId}>
                    <CoinIcon size="sm" symbol={extractCoinFromSymbol(o.symbol)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{o.symbol}</span>
                        <SideBadge side={o.side} />
                        <span className="badge-muted">{o.type}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("mypage.qty", { amount: formatAmount(o.quantity, 6) })}
                        {o.price ? ` ${t("mypage.atPrice", { price: formatAmount(o.price, 2) })}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <OrderStatusBadge status={o.status} />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {o.createdAt ? formatDateTime(o.createdAt) : "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ══════════════════════════════════
         Security Tab
         ══════════════════════════════════ */}
      {activeTab === "security" ? (
        <div className="space-y-6 animate-fade-up">
          {/* 2FA Setup */}
          <section className="panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {twoFactorSecret ? <ShieldCheckIcon /> : <ShieldOffIcon />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-[var(--font-display)] text-lg font-semibold text-foreground">
                  {t("mypage.twoFactor.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("mypage.twoFactor.desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {/* Step 1: Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="sec-password">
                  {t("mypage.twoFactor.currentPassword")}
                </label>
                <input
                  className="input-field max-w-md"
                  id="sec-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("mypage.twoFactor.passwordPlaceholder")}
                  type="password"
                  value={password}
                />
              </div>

              <button
                className="btn-primary !px-4 !py-2 text-sm"
                disabled={securityLoading}
                onClick={handleSetup2FA}
                type="button"
              >
                {securityLoading ? (
                  <span className="flex items-center gap-2"><SpinnerIcon className="animate-spin" /> {t("mypage.twoFactor.generating")}</span>
                ) : (
                  t("mypage.twoFactor.generate")
                )}
              </button>

              {/* Secret display with QR code */}
              {twoFactorSecret ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">{t("mypage.twoFactor.secretTitle")}</p>

                  {twoFactorOtpAuthUrl ? (
                    <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      {/* QR Code */}
                      <div className="shrink-0 rounded-lg bg-white p-3">
                        <QRCodeSVG
                          value={twoFactorOtpAuthUrl}
                          size={160}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      {/* Secret key + hint */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t("mypage.twoFactor.scanQrCode")}
                        </p>
                        <div className="rounded-md border border-border bg-card px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">{t("mypage.twoFactor.manualEntry")}</p>
                          <p className="mt-1 break-all font-mono text-xs text-amber-600 dark:text-amber-400">
                            {twoFactorSecret}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("mypage.twoFactor.secretHint")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 break-all font-mono text-xs text-amber-600 dark:text-amber-400">
                      {twoFactorSecret}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Step 2: Verify code */}
              {twoFactorSecret ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="sec-2fa-code">
                      {t("mypage.twoFactor.verificationCode")}
                    </label>
                    <input
                      className="input-field max-w-xs font-mono tracking-[0.3em]"
                      id="sec-2fa-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      value={twoFactorCode}
                    />
                  </div>
                  <button
                    className="btn-primary !px-4 !py-2.5 text-sm"
                    disabled={securityLoading}
                    onClick={handleEnable2FA}
                    type="button"
                  >
                    {t("mypage.twoFactor.activate")}
                  </button>
                </div>
              ) : null}

              {/* Messages */}
              {securityMessage ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                  {securityMessage}
                </div>
              ) : null}
              {securityError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                  {securityError}
                </div>
              ) : null}
            </div>
          </section>

          {/* Password section (placeholder) */}
          <section className="panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
                  <rect height="11" rx="2" width="18" x="3" y="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2 className="font-[var(--font-display)] text-lg font-semibold text-foreground">
                  {t("mypage.changePassword.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("mypage.changePassword.desc")}
                </p>
                <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t("mypage.changePassword.comingSoon")}
                </p>
              </div>
            </div>
          </section>

          {/* Login sessions (placeholder) */}
          <section className="panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
                  <rect height="14" rx="2" width="20" x="2" y="3" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              </div>
              <div>
                <h2 className="font-[var(--font-display)] text-lg font-semibold text-foreground">
                  {t("mypage.sessions.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("mypage.sessions.desc")}
                </p>
                <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t("mypage.sessions.comingSoon")}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* ══════════════════════════════════
         Assets Tab
         ══════════════════════════════════ */}
      {activeTab === "assets" ? (
        <div className="space-y-6 animate-fade-up">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.totalAvailable")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                {formatAmount(String(balances.reduce((s, r) => s + toNumber(r.available), 0)), 6)}
              </p>
            </article>
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.totalLocked")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-amber-500">
                {formatAmount(String(balances.reduce((s, r) => s + toNumber(r.locked), 0)), 6)}
              </p>
            </article>
            <article className="panel p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("mypage.portfolioSize")}</p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                {balances.length}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{t("mypage.assetsLabel")}</span>
              </p>
            </article>
          </div>

          {/* Portfolio table */}
          <section className="panel overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("mypage.portfolio")}</h2>
            </div>
            {balances.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t("mypage.noAssets")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("mypage.noAssetsHint")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">{t("mypage.asset")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.available")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.locked")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((row) => {
                      const total = toNumber(row.available) + toNumber(row.locked);
                      return (
                        <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors" key={row.asset}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <CoinIcon size="md" symbol={row.asset} />
                              <span className="font-medium text-foreground">{row.asset}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-sm text-foreground">
                            {formatAmount(row.available, 6)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-sm text-amber-500">
                            {toNumber(row.locked) > 0 ? formatAmount(row.locked, 6) : "-"}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-sm font-medium text-foreground">
                            {formatAmount(String(total), 6)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ══════════════════════════════════
         Activity Tab
         ══════════════════════════════════ */}
      {activeTab === "activity" ? (
        <div className="space-y-6 animate-fade-up">
          {/* Recent Orders */}
          <section className="panel overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("mypage.recentOrders")}</h2>
            </div>
            {orders.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t("mypage.noOrders")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("mypage.noOrdersHint")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">{t("mypage.date")}</th>
                      <th className="px-5 py-3">{t("mypage.pair")}</th>
                      <th className="px-5 py-3">{t("mypage.side")}</th>
                      <th className="px-5 py-3">{t("mypage.type")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.price")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.amount")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors" key={o.orderId}>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                          {o.createdAt ? formatDateTime(o.createdAt) : "-"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <CoinIcon size="sm" symbol={extractCoinFromSymbol(o.symbol)} />
                            <span className="font-medium text-foreground">{o.symbol}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><SideBadge side={o.side} /></td>
                        <td className="px-5 py-3"><span className="badge-muted">{o.type}</span></td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-foreground">
                          {o.price ? formatAmount(o.price, 2) : t("mypage.market")}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-foreground">
                          {formatAmount(o.quantity, 6)}
                        </td>
                        <td className="px-5 py-3 text-right"><OrderStatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Ledger */}
          <section className="panel overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("mypage.recentLedger")}</h2>
            </div>
            {ledger.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t("mypage.noLedger")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("mypage.noLedgerHint")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">{t("mypage.date")}</th>
                      <th className="px-5 py-3">{t("mypage.type")}</th>
                      <th className="px-5 py-3">{t("mypage.currency")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.amount")}</th>
                      <th className="px-5 py-3 text-right">{t("mypage.balanceAfter")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => {
                      const amountNum = toNumber(entry.amount);
                      return (
                        <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors" key={entry.id}>
                          <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-5 py-3"><span className="badge-muted">{entry.entryType}</span></td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <CoinIcon size="sm" symbol={entry.asset} />
                              <span className="font-medium text-foreground">{entry.asset}</span>
                            </div>
                          </td>
                          <td className={`px-5 py-3 text-right font-mono text-sm ${amountNum >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                            {amountNum >= 0 ? "+" : ""}{formatAmount(entry.amount, 6)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-sm text-foreground">
                            {formatAmount(entry.balanceAfter, 6)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
