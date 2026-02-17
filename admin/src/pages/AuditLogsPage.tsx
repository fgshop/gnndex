import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";

type AuditLogRow = {
  id: string;
  actorEmail?: string | null;
  action?: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: unknown;
  createdAt?: string;
};

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

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is string => typeof item === "string").sort();
}

function getPermissionDiff(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const previous = toStringArray(record.previousPermissions);
  const next = toStringArray(record.nextPermissions);
  if (previous.length === 0 && next.length === 0) {
    return null;
  }

  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  const added = next.filter((permission) => !previousSet.has(permission));
  const removed = previous.filter((permission) => !nextSet.has(permission));

  return {
    current: next,
    added,
    removed
  };
}

function toMetadataText(metadata: unknown): string | null {
  if (!metadata) {
    return null;
  }
  if (typeof metadata === "string") {
    return metadata;
  }
  if (typeof metadata === "object") {
    return JSON.stringify(metadata);
  }

  return String(metadata);
}

export function AuditLogsPage() {
  const { t } = useTranslation();
  const [actorEmail, setActorEmail] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditLogRow[]>([]);

  const loadEntries = async (nextPage = page) => {
    setLoading(true);
    const { data, error } = await api.GET("/admin/audit-logs", {
      params: {
        query: {
          actorEmail: actorEmail || undefined,
          action: action || undefined,
          targetType: targetType || undefined,
          fromCreatedAt: toUtcIso(fromCreatedAt),
          toCreatedAt: toUtcIso(toCreatedAt),
          limit,
          page: nextPage
        }
      }
    });
    setLoading(false);

    if (error || !data) {
      setEntries([]);
      setErrorMessage(getApiErrorMessage(error, t("audit.loadFailed")));
      return;
    }

    const payload = data as {
      items?: AuditLogRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };
    setEntries(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
    setErrorMessage(null);
  };

  useEffect(() => {
    loadEntries(1).catch(() => {
      setEntries([]);
      setErrorMessage(t("audit.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const fetchAuditLogs = async (event: FormEvent) => {
    event.preventDefault();
    await loadEntries(1);
  };

  return (
    <main>
      <h2>{t("audit.title")}</h2>
      <p className="muted">{t("audit.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={fetchAuditLogs}>
        <h3>{t("audit.filters")}</h3>
        <div className="admin-form-grid">
          <input
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            placeholder={t("audit.actorEmailPlaceholder")}
          />
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("audit.actionPlaceholder")} />
          <input
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            placeholder={t("audit.targetTypePlaceholder")}
          />
          <input
            type="datetime-local"
            value={fromCreatedAt}
            onChange={(e) => setFromCreatedAt(e.target.value)}
            placeholder={t("audit.fromCreatedAt")}
          />
          <input
            type="datetime-local"
            value={toCreatedAt}
            onChange={(e) => setToCreatedAt(e.target.value)}
            placeholder={t("audit.toCreatedAt")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="audit-limit">{t("common.limit")}</label>
          <select
            id="audit-limit"
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
            {loading ? t("common.loading") : t("audit.loadAuditLogs")}
          </button>
        </div>
      </form>
      <div className="table-card">
        <div className="table-row table-head">
          <span>{t("audit.tableTimeUtc")}</span>
          <span>{t("audit.tableActor")}</span>
          <span>{t("audit.tableAction")}</span>
          <span>{t("audit.tableTarget")}</span>
        </div>
        {entries.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>{t("audit.noData")}</span>
            <span>-</span>
          </div>
        ) : (
          entries.map((entry) => {
            const permissionDiff =
              entry.action === "ADMIN_PERMISSIONS_UPDATED" ? getPermissionDiff(entry.metadata) : null;
            const metadataText = permissionDiff === null ? toMetadataText(entry.metadata) : null;

            return (
              <div className="table-row" key={entry.id}>
                <span>{entry.createdAt ?? "-"}</span>
                <span>{entry.actorEmail ?? "-"}</span>
                <span>{entry.action ?? "-"}</span>
                <span>
                  <div className="audit-detail">
                    <div className="audit-target">
                      {entry.targetType ?? "-"}:{entry.targetId ?? "-"}
                    </div>

                    {permissionDiff && (
                      <>
                        {permissionDiff.added.length > 0 && (
                          <div className="audit-chip-row">
                            {permissionDiff.added.map((permission) => (
                              <span className="audit-chip added" key={`added-${entry.id}-${permission}`}>
                                + {permission}
                              </span>
                            ))}
                          </div>
                        )}
                        {permissionDiff.removed.length > 0 && (
                          <div className="audit-chip-row">
                            {permissionDiff.removed.map((permission) => (
                              <span className="audit-chip removed" key={`removed-${entry.id}-${permission}`}>
                                - {permission}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="audit-chip-row">
                          {permissionDiff.current.map((permission) => (
                            <span className="audit-chip current" key={`current-${entry.id}-${permission}`}>
                              {permission}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {permissionDiff === null && metadataText && metadataText !== "{}" && (
                      <code className="audit-json">{metadataText}</code>
                    )}
                  </div>
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || page <= 1}
          onClick={() => {
            void loadEntries(page - 1);
          }}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || page >= totalPages}
          onClick={() => {
            void loadEntries(page + 1);
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
