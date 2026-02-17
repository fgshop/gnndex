import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../features/auth/auth-context";
import { useTranslation } from "../i18n/locale-context";
import { apiBaseUrl } from "../lib/api";
import { getApiErrorMessage } from "../lib/api-error";

type SupportTicketStatus = "RECEIVED" | "IN_REVIEW" | "ANSWERED" | "CLOSED";

type SupportTicketRow = {
  ticketId: string;
  userId: string;
  email: string;
  category: string;
  subject: string;
  content: string;
  contactEmail: string;
  status: SupportTicketStatus;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  repliedAt: string | null;
};

type ReplyModalState = {
  ticketId: string;
  status: SupportTicketStatus;
  adminReply: string;
};

const SUPPORT_STATUS_VALUES: SupportTicketStatus[] = [
  "RECEIVED",
  "IN_REVIEW",
  "ANSWERED",
  "CLOSED"
];

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

function toQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

function parseHttpError(status: number, payload: unknown, fallback: string): string {
  return `${getApiErrorMessage(payload, fallback)} (HTTP ${status})`;
}

export function SupportTicketsPage() {
  const { t } = useTranslation();
  const { session } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"" | SupportTicketStatus>("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [replyModal, setReplyModal] = useState<ReplyModalState | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const accessToken = session?.tokens?.accessToken;
  const authedHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken || ""}`
    }),
    [accessToken]
  );

  const loadRows = async (nextPage = page) => {
    if (!accessToken) {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(t("support.sessionMissing"));
      return false;
    }

    setLoading(true);
    const query = toQueryString({
      page: nextPage,
      limit,
      email: email || undefined,
      category: category || undefined,
      subject: subject || undefined,
      status: status || undefined,
      fromCreatedAt: toUtcIso(fromCreatedAt),
      toCreatedAt: toUtcIso(toCreatedAt)
    });

    try {
      const response = await fetch(`${apiBaseUrl}/admin/support-tickets?${query}`, {
        method: "GET",
        headers: authedHeaders
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            items?: SupportTicketRow[];
            pagination?: { page?: number; total?: number; totalPages?: number };
          }
        | unknown;

      if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
        setRows([]);
        setFeedbackTone("error");
        setFeedbackMessage(parseHttpError(response.status, payload, t("support.loadFailed")));
        setLoading(false);
        return false;
      }

      const data = payload as {
        items?: SupportTicketRow[];
        pagination?: { page?: number; total?: number; totalPages?: number };
      };
      setRows(data.items ?? []);
      setPage(data.pagination?.page ?? nextPage);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setLoading(false);
      return true;
    } catch {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(t("support.loadFailed"));
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    void loadRows(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilter = async (event: FormEvent) => {
    event.preventDefault();
    setFeedbackMessage(null);
    await loadRows(1);
  };

  const openReplyModal = (row: SupportTicketRow) => {
    setModalError(null);
    setFeedbackMessage(null);
    setReplyModal({
      ticketId: row.ticketId,
      status: row.status,
      adminReply: row.adminReply ?? ""
    });
  };

  const closeReplyModal = () => {
    if (actionLoading) {
      return;
    }
    setReplyModal(null);
    setModalError(null);
  };

  const onSubmitReply = async () => {
    if (!replyModal) {
      return;
    }
    if (!accessToken) {
      setModalError(t("support.sessionMissingShort"));
      return;
    }
    if (!replyModal.adminReply.trim()) {
      setModalError(t("support.replyRequired"));
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/admin/support-tickets/${replyModal.ticketId}`, {
        method: "PATCH",
        headers: {
          ...authedHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: replyModal.status,
          adminReply: replyModal.adminReply.trim()
        })
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setModalError(parseHttpError(response.status, payload, t("support.updateFailed")));
        setActionLoading(false);
        return;
      }

      await loadRows(page);
      setReplyModal(null);
      setFeedbackTone("success");
      setFeedbackMessage(t("support.updated"));
    } catch {
      setModalError(t("common.requestFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main>
      <h2>{t("support.title")}</h2>
      <p className="muted">{t("support.subtitle")}</p>

      {feedbackMessage && <div className={`admin-feedback ${feedbackTone}`}>{feedbackMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={onFilter}>
        <h3>{t("support.filters")}</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("support.emailPlaceholder")} />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t("support.categoryPlaceholder")}
          />
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t("support.subjectPlaceholder")}
          />
          <select value={status} onChange={(event) => setStatus(event.target.value as "" | SupportTicketStatus)}>
            <option value="">ALL STATUS</option>
            {SUPPORT_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={fromCreatedAt}
            onChange={(event) => setFromCreatedAt(event.target.value)}
            placeholder={t("support.fromCreatedAt")}
          />
          <input
            type="datetime-local"
            value={toCreatedAt}
            onChange={(event) => setToCreatedAt(event.target.value)}
            placeholder={t("support.toCreatedAt")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="support-limit">{t("common.limit")}</label>
          <select
            id="support-limit"
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
          <button className="admin-btn" disabled={loading || actionLoading} type="submit">
            {loading ? t("common.loading") : t("support.loadTickets")}
          </button>
        </div>
      </form>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-row table-head">
          <span>{t("support.tableTimeUtc")}</span>
          <span>{t("support.tableUser")}</span>
          <span>{t("support.tableInquiry")}</span>
          <span>{t("support.tableStatusAction")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>{t("support.noData")}</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="table-row" key={row.ticketId}>
              <span>{row.createdAt}</span>
              <span>
                {row.email}
                <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{row.contactEmail}</div>
              </span>
              <span>
                <strong>{row.subject}</strong>
                <div className="support-ticket-content">
                  [{row.category}] {row.content}
                </div>
                {row.adminReply ? (
                  <div className="support-ticket-reply">
                    <strong>{t("support.replyLabel")}</strong> {row.adminReply}
                  </div>
                ) : null}
              </span>
              <span>
                {row.status}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="admin-btn secondary"
                    disabled={actionLoading}
                    onClick={() => openReplyModal(row)}
                    type="button"
                  >
                    {t("support.replyUpdate")}
                  </button>
                </div>
                {row.repliedAt ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                    {t("support.repliedAt")} {row.repliedAt}
                  </div>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          className="admin-btn"
          disabled={loading || actionLoading || page <= 1}
          onClick={() => {
            void loadRows(page - 1);
          }}
          type="button"
        >
          {t("common.prev")}
        </button>
        <button
          className="admin-btn"
          disabled={loading || actionLoading || page >= totalPages}
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

      {replyModal ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{t("support.modalTitle")}</h3>
            <p className="muted">{t("support.modalSubtitle")}</p>
            <div className="admin-modal-field">
              <label>{t("support.modalStatus")}</label>
              <select
                value={replyModal.status}
                onChange={(event) => {
                  const value = event.target.value as SupportTicketStatus;
                  setReplyModal((prev) => (prev ? { ...prev, status: value } : prev));
                }}
              >
                {SUPPORT_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-modal-field">
              <label>{t("support.modalAdminReply")}</label>
              <textarea
                value={replyModal.adminReply}
                onChange={(event) => {
                  setReplyModal((prev) =>
                    prev
                      ? {
                          ...prev,
                          adminReply: event.target.value
                        }
                      : prev
                  );
                }}
                placeholder={t("support.modalReplyPlaceholder")}
              />
            </div>

            {modalError ? <div className="admin-feedback error">{modalError}</div> : null}

            <div className="admin-modal-actions">
              <button className="admin-btn secondary" disabled={actionLoading} onClick={closeReplyModal} type="button">
                {t("common.cancel")}
              </button>
              <button className="admin-btn" disabled={actionLoading} onClick={() => void onSubmitReply()} type="button">
                {actionLoading ? t("common.processing") : t("support.saveReply")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
