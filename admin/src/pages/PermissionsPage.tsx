import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";

const ALL_ADMIN_PERMISSIONS = [
  "USER_READ",
  "ORDER_READ",
  "WALLET_LEDGER_READ",
  "WITHDRAWAL_READ",
  "WITHDRAWAL_APPROVE",
  "WITHDRAWAL_REJECT",
  "WITHDRAWAL_BROADCAST",
  "WITHDRAWAL_CONFIRM",
  "WITHDRAWAL_FAIL",
  "BALANCE_ADJUST",
  "AUDIT_LOG_READ",
  "SUPPORT_TICKET_READ",
  "SUPPORT_TICKET_REPLY",
  "ADMIN_PERMISSION_READ",
  "ADMIN_PERMISSION_WRITE",
  "COMPLIANCE_APPROVE"
] as const;

type AdminPermission = (typeof ALL_ADMIN_PERMISSIONS)[number];

type AdminPermissionRow = {
  userId: string;
  email: string;
  role: string;
  status: string;
  permissions: AdminPermission[];
};

function sortPermissions(input: AdminPermission[]) {
  const orderMap = new Map<string, number>(
    ALL_ADMIN_PERMISSIONS.map((permission, index) => [permission, index])
  );
  return [...input].sort((a, b) => {
    const aIndex = orderMap.get(a) ?? 999;
    const bIndex = orderMap.get(b) ?? 999;
    return aIndex - bIndex;
  });
}

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

export function PermissionsPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<AdminPermissionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AdminPermission[]>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const rowsById = useMemo(() => {
    const map = new Map<string, AdminPermissionRow>();
    rows.forEach((row) => map.set(row.userId, row));
    return map;
  }, [rows]);

  const loadRows = async (nextPage = page) => {
    setLoading(true);
    const { data, error } = await api.GET("/admin/permissions/users", {
      params: {
        query: {
          page: nextPage,
          limit,
          email: email || undefined,
          fromCreatedAt: toUtcIso(fromCreatedAt),
          toCreatedAt: toUtcIso(toCreatedAt)
        }
      }
    });
    setLoading(false);

    if (error || !data) {
      setRows([]);
      setDrafts({});
      setErrorMessage(getApiErrorMessage(error, t("permissions.loadFailed")));
      return;
    }

    const payload = data as {
      items?: AdminPermissionRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };
    const nextRows = payload.items ?? [];
    setRows(nextRows);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);

    const nextDrafts: Record<string, AdminPermission[]> = {};
    nextRows.forEach((row) => {
      nextDrafts[row.userId] = sortPermissions(row.permissions ?? []);
    });
    setDrafts(nextDrafts);
    setErrorMessage(null);
  };

  useEffect(() => {
    loadRows(1).catch(() => {
      setRows([]);
      setDrafts({});
      setErrorMessage(t("permissions.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    await loadRows(1);
  };

  const handleToggle = (userId: string, permission: AdminPermission, checked: boolean) => {
    const current = drafts[userId] ?? rowsById.get(userId)?.permissions ?? [];
    const next = checked
      ? sortPermissions(Array.from(new Set([...current, permission])))
      : sortPermissions(current.filter((item) => item !== permission));

    setDrafts((prev) => ({
      ...prev,
      [userId]: next
    }));
  };

  const handleSave = async (userId: string) => {
    const permissions = drafts[userId] ?? rowsById.get(userId)?.permissions ?? [];
    setSavingUserId(userId);

    try {
      const { error } = await api.PATCH("/admin/permissions/users/{userId}", {
        params: { path: { userId } },
        body: { permissions: permissions as unknown as never[] }
      });

      if (error) {
        setErrorMessage(getApiErrorMessage(error, t("permissions.saveFailed")));
        return;
      }

      await loadRows(page);
      setErrorMessage(null);
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <main>
      <h2>{t("permissions.title")}</h2>
      <p className="muted">{t("permissions.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("permissions.filters")}</h3>
        <div className="admin-form-grid">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("permissions.emailPlaceholder")}
          />
          <input
            type="datetime-local"
            value={fromCreatedAt}
            onChange={(event) => setFromCreatedAt(event.target.value)}
            placeholder={t("permissions.fromCreatedAt")}
          />
          <input
            type="datetime-local"
            value={toCreatedAt}
            onChange={(event) => setToCreatedAt(event.target.value)}
            placeholder={t("permissions.toCreatedAt")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="permission-limit">{t("common.limit")}</label>
          <select
            id="permission-limit"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
            }}
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="admin-btn" disabled={loading || savingUserId !== null} type="submit">
            {loading ? t("common.loading") : t("permissions.loadPermissions")}
          </button>
        </div>
      </form>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-row table-head">
          <span>{t("permissions.tableAdmin")}</span>
          <span>{t("permissions.tableRoleStatus")}</span>
          <span>{t("permissions.tablePermissions")}</span>
          <span>{t("permissions.tableAction")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>{t("permissions.noData")}</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => {
            const selected = drafts[row.userId] ?? row.permissions;
            return (
              <div className="table-row" key={row.userId}>
                <span>{row.email}</span>
                <span>
                  {row.role} / {row.status}
                </span>
                <span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 6
                    }}
                  >
                    {ALL_ADMIN_PERMISSIONS.map((permission) => (
                      <label
                        key={permission}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          lineHeight: 1.2
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(permission)}
                          onChange={(event) =>
                            handleToggle(row.userId, permission, event.target.checked)
                          }
                        />
                        {permission}
                      </label>
                    ))}
                  </div>
                </span>
                <span>
                  <button
                    className="admin-btn"
                    disabled={savingUserId === row.userId}
                    onClick={() => {
                      void handleSave(row.userId);
                    }}
                    type="button"
                  >
                    {savingUserId === row.userId ? t("permissions.saving") : t("permissions.savePermissions")}
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || savingUserId !== null || page <= 1}
          onClick={() => {
            void loadRows(page - 1);
          }}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || savingUserId !== null || page >= totalPages}
          onClick={() => {
            void loadRows(page + 1);
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
