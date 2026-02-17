import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";

type OrderRow = {
  orderId: string;
  userId: string;
  email: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  quantity: string;
  filledQuantity: string;
  status: string;
  createdAt: string;
};

type OrderStatusFilter = "" | "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";

export function OrdersPage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<OrderStatusFilter>("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [detailModal, setDetailModal] = useState<OrderRow | null>(null);

  const loadOrders = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/orders", {
      params: {
        query: {
          page: nextPage,
          limit,
          symbol: symbol || undefined,
          email: email || undefined,
          status: (status || undefined) as
            | "NEW"
            | "PARTIALLY_FILLED"
            | "FILLED"
            | "CANCELED"
            | "REJECTED"
            | undefined
        }
      }
    });
    setLoading(false);

    if (error || !data) {
      setRows([]);
      setErrorMessage(getApiErrorMessage(error, t("orders.loadFailed")));
      return;
    }

    const payload = data as {
      items?: OrderRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };
    setRows(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
    setErrorMessage(null);
  };

  useEffect(() => {
    loadOrders(1).catch(() => {
      setRows([]);
      setErrorMessage(t("orders.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    await loadOrders(1);
  };

  const statusClass = (s: string) => `status-badge ${s.toLowerCase()}`;

  return (
    <main>
      <h2>{t("orders.title")}</h2>
      <p className="muted">{t("orders.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("orders.filters")}</h3>
        <div className="admin-form-grid">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={t("orders.symbolPlaceholder")}
          />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("orders.emailPlaceholder")} />
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatusFilter)}>
            <option value="">ALL STATUS</option>
            <option value="NEW">NEW</option>
            <option value="PARTIALLY_FILLED">PARTIALLY_FILLED</option>
            <option value="FILLED">FILLED</option>
            <option value="CANCELED">CANCELED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="orders-limit">{t("common.limit")}</label>
            <select
              id="orders-limit"
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
          {loading ? t("common.loading") : t("orders.loadOrders")}
        </button>
      </form>

      <div className="table-card">
        <div className="table-row table-head" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
          <span>{t("orders.tableTimeUtc")}</span>
          <span>{t("orders.tableUser")}</span>
          <span>{t("orders.tableSymbolSide")}</span>
          <span>{t("orders.tablePriceQty")}</span>
          <span>{t("orders.tableStatus")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
            <span>-</span>
            <span>-</span>
            <span>{t("orders.noData")}</span>
            <span>-</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div
              className="table-row"
              key={row.orderId}
              style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", cursor: "pointer" }}
              onClick={() => setDetailModal(row)}
            >
              <span>{row.createdAt}</span>
              <span style={{ fontSize: 12 }}>{row.email}</span>
              <span>
                {row.symbol}{" "}
                <span
                  style={{
                    color: row.side === "BUY" ? "#4ade80" : "#f87171",
                    fontWeight: 600
                  }}
                >
                  {row.side}
                </span>{" "}
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{row.type}</span>
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                {row.price} / {row.quantity}
                {row.filledQuantity !== "0" && row.filledQuantity !== row.quantity && (
                  <div style={{ color: "#94a3b8", marginTop: 2 }}>{t("orders.filled")} {row.filledQuantity}</div>
                )}
              </span>
              <span>
                <span className={statusClass(row.status)}>{row.status}</span>
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || page <= 1}
          onClick={() => void loadOrders(page - 1)}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || page >= totalPages}
          onClick={() => void loadOrders(page + 1)}
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
            <h3>{t("orders.detailTitle")}</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              {detailModal.orderId}
            </p>
            <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailUser")}</span> {detailModal.email}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailSymbol")}</span> {detailModal.symbol}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailSideType")}</span>{" "}
                <span
                  style={{
                    color: detailModal.side === "BUY" ? "#4ade80" : "#f87171",
                    fontWeight: 600
                  }}
                >
                  {detailModal.side}
                </span>{" "}
                {detailModal.type}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailPrice")}</span>{" "}
                <span style={{ fontFamily: "monospace" }}>{detailModal.price}</span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailQuantity")}</span>{" "}
                <span style={{ fontFamily: "monospace" }}>{detailModal.quantity}</span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailFilled")}</span>{" "}
                <span style={{ fontFamily: "monospace" }}>{detailModal.filledQuantity}</span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailStatus")}</span>{" "}
                <span className={statusClass(detailModal.status)}>{detailModal.status}</span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("orders.detailCreated")}</span> {detailModal.createdAt}
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
