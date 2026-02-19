import { FormEvent, useEffect, useState } from "react";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import { useTranslation } from "../i18n/locale-context";

type DepositRow = {
  id: string;
  email: string;
  asset: string;
  entryType: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

function toUtcIso(localDateTime: string): string | undefined {
  if (!localDateTime) return undefined;
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function DepositsPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [asset, setAsset] = useState("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshFailures, setRefreshFailures] = useState(0);
  const [nextRefreshMs, setNextRefreshMs] = useState(10000);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createAsset, setCreateAsset] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadRows = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/deposits", {
      params: {
        query: {
          page: nextPage,
          limit,
          email: email || undefined,
          asset: asset || undefined,
          fromCreatedAt: toUtcIso(fromCreatedAt),
          toCreatedAt: toUtcIso(toCreatedAt)
        }
      }
    });

    setLoading(false);

    if (error || !data) {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("deposits.loadFailed")));
      return false;
    }

    const payload = data as {
      items?: DepositRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };

    setRows(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
    setLastUpdatedAt(new Date().toISOString());
    return true;
  };

  useEffect(() => {
    loadRows(1).catch(() => {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(t("deposits.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh || createLoading || showCreateModal) return;

    let isActive = true;
    let timerId: number | undefined;
    let failures = 0;

    const schedule = (delayMs: number) => {
      setNextRefreshMs(delayMs);
      timerId = window.setTimeout(async () => {
        const ok = await loadRows(page).catch(() => false);
        if (!isActive) return;

        if (ok) {
          failures = 0;
          setRefreshFailures(0);
        } else {
          failures = Math.min(failures + 1, 6);
          setRefreshFailures(failures);
          setFeedbackTone("error");
          setFeedbackMessage(t("deposits.refreshFailed"));
        }

        const nextDelay = Math.min(10000 * 2 ** failures, 60000);
        schedule(nextDelay);
      }, delayMs);
    };

    failures = 0;
    setRefreshFailures(0);
    schedule(10000);

    return () => {
      isActive = false;
      if (timerId) window.clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, createLoading, showCreateModal, page, limit, email, asset, fromCreatedAt, toCreatedAt]);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    setFeedbackMessage(null);
    await loadRows(1);
  };

  const handleCreate = async () => {
    if (!createEmail.trim() || !createAsset.trim() || !createAmount.trim()) {
      setModalError("Email, asset, and amount are required");
      return;
    }

    setCreateLoading(true);
    setModalError(null);

    const { error } = await api.POST("/admin/deposits", {
      body: {
        email: createEmail.trim(),
        asset: createAsset.trim().toUpperCase(),
        amount: createAmount.trim(),
        reason: createReason.trim() || undefined
      }
    });

    setCreateLoading(false);

    if (error) {
      setModalError(getApiErrorMessage(error, t("deposits.createFailed")));
      return;
    }

    setShowCreateModal(false);
    setCreateEmail("");
    setCreateAsset("");
    setCreateAmount("");
    setCreateReason("");
    setFeedbackTone("success");
    setFeedbackMessage(t("deposits.createSuccess"));
    await loadRows(1);
  };

  return (
    <main>
      <h2>{t("deposits.title")}</h2>
      <p className="muted">{t("deposits.subtitle")}</p>

      {feedbackMessage && (
        <div className={`admin-feedback ${feedbackTone}`}>{feedbackMessage}</div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button
          className="admin-btn secondary"
          type="button"
          onClick={() => setAutoRefresh((prev) => !prev)}
        >
          {autoRefresh ? `Auto Refresh: ON (${Math.round(nextRefreshMs / 1000)}s)` : "Auto Refresh: OFF"}
        </button>
        {refreshFailures > 0 ? (
          <span className="muted" style={{ marginTop: 0 }}>Retry backoff x{refreshFailures}</span>
        ) : null}
        <span className="muted" style={{ marginTop: 0 }}>
          Last update: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "-"}
        </span>
        <button className="admin-btn" type="button" onClick={() => setShowCreateModal(true)}>
          {t("deposits.createTitle")}
        </button>
      </div>

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("deposits.filters")}</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("deposits.emailPlaceholder")} />
          <input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder={t("deposits.assetPlaceholder")} />
          <input type="datetime-local" value={fromCreatedAt} onChange={(e) => setFromCreatedAt(e.target.value)} placeholder={t("deposits.fromCreatedAt")} />
          <input type="datetime-local" value={toCreatedAt} onChange={(e) => setToCreatedAt(e.target.value)} placeholder={t("deposits.toCreatedAt")} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="deposit-limit">Limit</label>
          <select id="deposit-limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="admin-btn" disabled={loading || createLoading} type="submit">
            {loading ? "Loading..." : t("deposits.loadDeposits")}
          </button>
        </div>
      </form>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-row table-head">
          <span>{t("deposits.tableTimeUtc")}</span>
          <span>{t("deposits.tableUser")}</span>
          <span>{t("deposits.tableAsset")}</span>
          <span>{t("deposits.tableAmount")}</span>
          <span>{t("deposits.tableBalance")}</span>
          <span>{t("deposits.tableRefType")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span><span>-</span><span>-</span><span>{t("deposits.noData")}</span><span>-</span><span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="table-row" key={row.id}>
              <span>{row.createdAt}</span>
              <span>{row.email}</span>
              <span>{row.asset}</span>
              <span>{row.amount}</span>
              <span>{row.balanceBefore} → {row.balanceAfter}</span>
              <span>{row.referenceType ?? "-"}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button className="admin-btn" disabled={loading || page <= 1} onClick={() => void loadRows(page - 1)} type="button">Prev</button>
        <button className="admin-btn" disabled={loading || page >= totalPages} onClick={() => void loadRows(page + 1)} type="button">Next</button>
        <span>Page {page} / {totalPages} (Total: {total})</span>
      </div>

      {showCreateModal && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{t("deposits.createTitle")}</h3>
            <p className="muted">{t("deposits.createDesc")}</p>
            <div className="admin-modal-field">
              <label>{t("deposits.createEmail")}</label>
              <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="user@gnndex.com" />
            </div>
            <div className="admin-modal-field">
              <label>{t("deposits.createAsset")}</label>
              <input value={createAsset} onChange={(e) => setCreateAsset(e.target.value)} placeholder="USDT" />
            </div>
            <div className="admin-modal-field">
              <label>{t("deposits.createAmount")}</label>
              <input value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} placeholder="1000.00" />
            </div>
            <div className="admin-modal-field">
              <label>{t("deposits.createReason")}</label>
              <input value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder={t("deposits.createReason")} />
            </div>
            {modalError && <div className="admin-feedback error">{modalError}</div>}
            <div className="admin-modal-actions">
              <button className="admin-btn secondary" disabled={createLoading} onClick={() => setShowCreateModal(false)} type="button">{t("notices.cancel")}</button>
              <button className="admin-btn" disabled={createLoading} onClick={() => void handleCreate()} type="button">
                {createLoading ? "Processing..." : t("deposits.createSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
