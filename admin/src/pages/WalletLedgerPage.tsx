import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";

type LedgerRow = {
  id: string;
  userId: string;
  email: string;
  asset: string;
  entryType: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
};

type EntryTypeFilter =
  | ""
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "ORDER_LOCK"
  | "ORDER_UNLOCK"
  | "TRADE_SETTLEMENT"
  | "ADJUSTMENT";

const ENTRY_TYPE_VALUES: EntryTypeFilter[] = [
  "DEPOSIT",
  "WITHDRAWAL",
  "ORDER_LOCK",
  "ORDER_UNLOCK",
  "TRADE_SETTLEMENT",
  "ADJUSTMENT"
];

export function WalletLedgerPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [asset, setAsset] = useState("");
  const [entryType, setEntryType] = useState<EntryTypeFilter>("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [detailModal, setDetailModal] = useState<LedgerRow | null>(null);

  const loadRows = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/wallet-ledger", {
      params: {
        query: {
          page: nextPage,
          limit,
          email: email || undefined,
          asset: asset || undefined,
          entryType: (entryType || undefined) as
            | "DEPOSIT"
            | "WITHDRAWAL"
            | "ORDER_LOCK"
            | "ORDER_UNLOCK"
            | "TRADE_SETTLEMENT"
            | "ADJUSTMENT"
            | undefined
        }
      }
    });
    setLoading(false);

    if (error || !data) {
      setRows([]);
      setErrorMessage(getApiErrorMessage(error, t("walletLedger.loadFailed")));
      return;
    }

    const payload = data as {
      items?: LedgerRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };
    setRows(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
    setErrorMessage(null);
  };

  useEffect(() => {
    loadRows(1).catch(() => {
      setRows([]);
      setErrorMessage(t("walletLedger.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    await loadRows(1);
  };

  const amountColor = (entryType: string) => {
    switch (entryType) {
      case "DEPOSIT":
      case "ORDER_UNLOCK":
      case "TRADE_SETTLEMENT":
        return "#4ade80";
      case "WITHDRAWAL":
      case "ORDER_LOCK":
        return "#f87171";
      case "ADJUSTMENT":
        return "#fbbf24";
      default:
        return "#e2e8f0";
    }
  };

  const entryTypeClass = (type: string) => {
    switch (type) {
      case "DEPOSIT":
      case "TRADE_SETTLEMENT":
        return "status-badge active";
      case "WITHDRAWAL":
        return "status-badge failed";
      case "ORDER_LOCK":
        return "status-badge canceled";
      case "ORDER_UNLOCK":
        return "status-badge new";
      case "ADJUSTMENT":
        return "status-badge review_pending";
      default:
        return "status-badge";
    }
  };

  return (
    <main>
      <h2>{t("walletLedger.title")}</h2>
      <p className="muted">{t("walletLedger.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("walletLedger.filters")}</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("walletLedger.emailPlaceholder")} />
          <input
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder={t("walletLedger.assetPlaceholder")}
          />
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryTypeFilter)}
          >
            <option value="">{t("common.allTypes")}</option>
            {ENTRY_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="ledger-limit">{t("common.limit")}</label>
            <select
              id="ledger-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <button className="admin-btn" disabled={loading} type="submit" style={{ marginTop: 10 }}>
          {loading ? t("common.loading") : t("walletLedger.loadLedger")}
        </button>
      </form>

      <div className="table-card">
        <div
          className="table-row table-head"
          style={{ gridTemplateColumns: "1fr 1fr 0.8fr 1fr 1.2fr" }}
        >
          <span>{t("walletLedger.tableTimeUtc")}</span>
          <span>{t("walletLedger.tableUserAsset")}</span>
          <span>{t("walletLedger.tableType")}</span>
          <span>{t("walletLedger.tableAmount")}</span>
          <span>{t("walletLedger.tableBalance")}</span>
        </div>
        {rows.length === 0 ? (
          <div
            className="table-row"
            style={{ gridTemplateColumns: "1fr 1fr 0.8fr 1fr 1.2fr" }}
          >
            <span>-</span>
            <span>-</span>
            <span>{t("walletLedger.noData")}</span>
            <span>-</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div
              className="table-row"
              key={row.id}
              style={{
                gridTemplateColumns: "1fr 1fr 0.8fr 1fr 1.2fr",
                cursor: "pointer"
              }}
              onClick={() => setDetailModal(row)}
            >
              <span style={{ fontSize: 12 }}>{row.createdAt}</span>
              <span>
                <div style={{ fontSize: 12 }}>{row.email}</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{row.asset}</div>
              </span>
              <span>
                <span className={entryTypeClass(row.entryType)}>{row.entryType}</span>
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: amountColor(row.entryType)
                }}
              >
                {row.amount}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
                {row.balanceBefore} → {row.balanceAfter}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || page <= 1}
          onClick={() => void loadRows(page - 1)}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || page >= totalPages}
          onClick={() => void loadRows(page + 1)}
          type="button"
        >
          {t("common.next")}
        </button>
        <span className="muted" style={{ marginTop: 0 }}>
          {t("common.page", { page: String(page), totalPages: String(totalPages), total: String(total) })}
        </span>
      </div>

      {detailModal && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{t("walletLedger.detailTitle")}</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              {detailModal.id}
            </p>
            <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailUser")}</span> {detailModal.email}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailAsset")}</span> {detailModal.asset}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailType")}</span>{" "}
                <span className={entryTypeClass(detailModal.entryType)}>
                  {detailModal.entryType}
                </span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailAmount")}</span>{" "}
                <span
                  style={{
                    fontFamily: "monospace",
                    color: amountColor(detailModal.entryType)
                  }}
                >
                  {detailModal.amount}
                </span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailBalanceBefore")}</span>{" "}
                <span style={{ fontFamily: "monospace" }}>{detailModal.balanceBefore}</span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailBalanceAfter")}</span>{" "}
                <span style={{ fontFamily: "monospace" }}>{detailModal.balanceAfter}</span>
              </div>
              {detailModal.referenceType && (
                <div>
                  <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailReference")}</span>{" "}
                  {detailModal.referenceType}:{detailModal.referenceId}
                </div>
              )}
              <div>
                <span style={{ color: "#94a3b8" }}>{t("walletLedger.detailCreated")}</span> {detailModal.createdAt}
              </div>
            </div>
            <pre className="admin-pre" style={{ maxHeight: 200 }}>
              {JSON.stringify(detailModal, null, 2)}
            </pre>
            <div className="admin-modal-actions">
              <button
                className="admin-btn secondary"
                onClick={() => setDetailModal(null)}
                type="button"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
