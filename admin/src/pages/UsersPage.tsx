import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";

type AdminUserRow = {
  userId: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  createdAt: string;
};

type UserStatusFilter = "" | "ACTIVE" | "LOCKED" | "SUSPENDED";

function toUtcIso(localDateTime: string): string | undefined {
  if (!localDateTime) {
    return undefined;
  }

  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function UsersPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminUserRow[]>([]);

  const loadUsers = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/users", {
      params: {
        query: {
          page: nextPage,
          limit,
          email: email || undefined,
          status: status || undefined,
          fromCreatedAt: toUtcIso(fromCreatedAt),
          toCreatedAt: toUtcIso(toCreatedAt)
        }
      }
    });
    setLoading(false);

    if (error || !data) {
      setRows([]);
      setErrorMessage(getApiErrorMessage(error, t("users.loadFailed")));
      return;
    }

    const payload = data as {
      items?: AdminUserRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };
    setRows(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
    setErrorMessage(null);
  };

  useEffect(() => {
    loadUsers(1).catch(() => {
      setRows([]);
      setErrorMessage(t("users.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    await loadUsers(1);
  };

  return (
    <main>
      <h2>{t("users.title")}</h2>
      <p className="muted">{t("users.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("users.filters")}</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("users.emailPlaceholder")} />
          <select value={status} onChange={(e) => setStatus(e.target.value as UserStatusFilter)}>
            <option value="">ALL STATUS</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <input
            type="datetime-local"
            value={fromCreatedAt}
            onChange={(e) => setFromCreatedAt(e.target.value)}
            placeholder={t("users.fromCreatedAt")}
          />
          <input
            type="datetime-local"
            value={toCreatedAt}
            onChange={(e) => setToCreatedAt(e.target.value)}
            placeholder={t("users.toCreatedAt")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="users-limit">{t("common.limit")}</label>
          <select
            id="users-limit"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
            }}
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="admin-btn" disabled={loading} type="submit">
            {loading ? t("common.loading") : t("users.loadUsers")}
          </button>
        </div>
      </form>

      <div className="table-card">
        <div className="table-row table-head">
          <span>{t("users.tableUser")}</span>
          <span>{t("users.tableRole")}</span>
          <span>{t("users.tableStatus")}</span>
          <span>{t("users.table2fa")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>{t("users.noData")}</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="table-row" key={row.userId}>
              <span>{row.email}</span>
              <span>{row.role}</span>
              <span>{row.status}</span>
              <span>
                {row.twoFactorEnabled ? t("common.enabled") : t("common.disabled")} / {row.createdAt}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || page <= 1}
          onClick={() => {
            void loadUsers(page - 1);
          }}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || page >= totalPages}
          onClick={() => {
            void loadUsers(page + 1);
          }}
          type="button"
        >
          {t("common.next")}
        </button>
        <span>
          {t("common.page", { page: String(page), totalPages: String(totalPages), total: String(total) })}
        </span>
      </div>
    </main>
  );
}
