import { FormEvent, useEffect, useState } from "react";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import { useTranslation } from "../i18n/locale-context";

type WithdrawalRow = {
  withdrawalId: string;
  email: string;
  asset: string;
  network: string;
  amount: string;
  fee: string;
  address: string;
  status: string;
  txHash: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  broadcastedAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  reviewedByUserId: string | null;
  rejectReason: string | null;
  failureReason: string | null;
};

type WithdrawalStatusFilter =
  | "REQUESTED"
  | "REVIEW_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "BROADCASTED"
  | "CONFIRMED"
  | "FAILED";

type WithdrawalActionKind = "APPROVE" | "REJECT" | "BROADCAST" | "CONFIRM" | "FAIL";

type ActionModalState = {
  kind: WithdrawalActionKind;
  withdrawalId: string;
  value: string;
};

const WITHDRAWAL_STATUS_VALUES: WithdrawalStatusFilter[] = [
  "REQUESTED",
  "REVIEW_PENDING",
  "APPROVED",
  "REJECTED",
  "BROADCASTED",
  "CONFIRMED",
  "FAILED"
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

function getActionMeta(kind: WithdrawalActionKind) {
  switch (kind) {
    case "APPROVE":
      return {
        title: "Approve Withdrawal",
        description: "요청 출금을 승인 상태로 전환합니다.",
        confirmLabel: "Approve",
        requiresInput: false,
        inputLabel: "",
        inputPlaceholder: ""
      };
    case "REJECT":
      return {
        title: "Reject Withdrawal",
        description: "출금을 거절하고 잠금 잔고를 사용자에게 복구합니다.",
        confirmLabel: "Reject",
        requiresInput: true,
        inputLabel: "Reject reason",
        inputPlaceholder: "Risk policy violation"
      };
    case "BROADCAST":
      return {
        title: "Broadcast Withdrawal",
        description: "온체인 브로드캐스트 해시를 기록합니다.",
        confirmLabel: "Broadcast",
        requiresInput: true,
        inputLabel: "txHash",
        inputPlaceholder: "0x..."
      };
    case "CONFIRM":
      return {
        title: "Confirm Withdrawal",
        description: "출금 확정 처리 후 잠금 잔고를 최종 차감합니다.",
        confirmLabel: "Confirm",
        requiresInput: false,
        inputLabel: "",
        inputPlaceholder: ""
      };
    case "FAIL":
      return {
        title: "Fail Withdrawal",
        description: "출금을 실패 처리하고 잠금 잔고를 사용자에게 복구합니다.",
        confirmLabel: "Fail",
        requiresInput: true,
        inputLabel: "Fail reason",
        inputPlaceholder: "On-chain transaction failed"
      };
    default:
      return {
        title: "Confirm Action",
        description: "",
        confirmLabel: "Confirm",
        requiresInput: false,
        inputLabel: "",
        inputPlaceholder: ""
      };
  }
}

export function WithdrawalsPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState("");
  const [status, setStatus] = useState<"" | WithdrawalStatusFilter>("");
  const [fromRequestedAt, setFromRequestedAt] = useState("");
  const [toRequestedAt, setToRequestedAt] = useState("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshFailures, setRefreshFailures] = useState(0);
  const [nextRefreshMs, setNextRefreshMs] = useState(10000);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);

  const loadRows = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/withdrawals", {
      params: {
        query: {
          page: nextPage,
          limit,
          email: email || undefined,
          asset: asset || undefined,
          network: network || undefined,
          status: status || undefined,
          fromRequestedAt: toUtcIso(fromRequestedAt),
          toRequestedAt: toUtcIso(toRequestedAt)
        }
      }
    });

    setLoading(false);

    if (error || !data) {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("withdrawals.loadFailed")));
      return false;
    }

    const payload = data as {
      items?: WithdrawalRow[];
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
      setFeedbackMessage(t("withdrawals.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh || actionLoading || actionModal) {
      return;
    }

    let isActive = true;
    let timerId: number | undefined;
    let failures = 0;

    const schedule = (delayMs: number) => {
      setNextRefreshMs(delayMs);
      timerId = window.setTimeout(async () => {
        const ok = await loadRows(page).catch(() => false);
        if (!isActive) {
          return;
        }

        if (ok) {
          failures = 0;
          setRefreshFailures(0);
        } else {
          failures = Math.min(failures + 1, 6);
          setRefreshFailures(failures);
          setFeedbackTone("error");
          setFeedbackMessage(t("withdrawals.refreshFailed"));
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
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoRefresh,
    actionLoading,
    actionModal,
    page,
    limit,
    email,
    asset,
    network,
    status,
    fromRequestedAt,
    toRequestedAt
  ]);

  const openActionModal = (kind: WithdrawalActionKind, withdrawalId: string) => {
    let defaultValue = "";
    if (kind === "REJECT") {
      defaultValue = t("withdrawals.rejectInputPlaceholder");
    } else if (kind === "FAIL") {
      defaultValue = t("withdrawals.failInputPlaceholder");
    } else if (kind === "BROADCAST") {
      defaultValue = "0x";
    }

    setModalError(null);
    setFeedbackMessage(null);
    setActionModal({
      kind,
      withdrawalId,
      value: defaultValue
    });
  };

  const closeActionModal = () => {
    if (actionLoading) {
      return;
    }

    setActionModal(null);
    setModalError(null);
  };

  const executeAction = async () => {
    if (!actionModal) {
      return;
    }

    const meta = getActionMeta(actionModal.kind);
    if (meta.requiresInput && actionModal.value.trim().length === 0) {
      setModalError(`${meta.inputLabel} is required`);
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      let result: { error?: unknown } | undefined;

      if (actionModal.kind === "APPROVE") {
        result = await api.POST("/admin/withdrawals/{withdrawalId}/approve", {
          params: { path: { withdrawalId: actionModal.withdrawalId } }
        });
      } else if (actionModal.kind === "REJECT") {
        result = await api.POST("/admin/withdrawals/{withdrawalId}/reject", {
          params: { path: { withdrawalId: actionModal.withdrawalId } },
          body: { reason: actionModal.value.trim() }
        });
      } else if (actionModal.kind === "BROADCAST") {
        result = await api.POST("/admin/withdrawals/{withdrawalId}/broadcast", {
          params: { path: { withdrawalId: actionModal.withdrawalId } },
          body: { txHash: actionModal.value.trim() }
        });
      } else if (actionModal.kind === "CONFIRM") {
        result = await api.POST("/admin/withdrawals/{withdrawalId}/confirm", {
          params: { path: { withdrawalId: actionModal.withdrawalId } }
        });
      } else {
        result = await api.POST("/admin/withdrawals/{withdrawalId}/fail", {
          params: { path: { withdrawalId: actionModal.withdrawalId } },
          body: { reason: actionModal.value.trim() }
        });
      }

      if (result.error) {
        setModalError(getApiErrorMessage(result.error, t("withdrawals.actionFailed")));
        return;
      }

      await loadRows(page);
      setActionModal(null);
      setFeedbackTone("success");
      setFeedbackMessage(`${meta.title} completed`);
    } catch {
      setModalError("Request failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    setFeedbackMessage(null);
    await loadRows(1);
  };

  return (
    <main>
      <h2>Withdrawals</h2>
      <p className="muted">출금 운영 큐 (상태/기간/페이지 필터)</p>

      {feedbackMessage && (
        <div className={`admin-feedback ${feedbackTone}`}>
          {feedbackMessage}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button
          className="admin-btn secondary"
          type="button"
          onClick={() => {
            setAutoRefresh((prev) => !prev);
          }}
        >
          {autoRefresh ? `Auto Refresh: ON (${Math.round(nextRefreshMs / 1000)}s)` : "Auto Refresh: OFF"}
        </button>
        {refreshFailures > 0 ? (
          <span className="muted" style={{ marginTop: 0 }}>
            Retry backoff x{refreshFailures}
          </span>
        ) : null}
        <span className="muted" style={{ marginTop: 0 }}>
          Last update: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "-"}
        </span>
      </div>

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>Withdrawal Filters</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("withdrawals.emailPlaceholder")} />
          <input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder={t("withdrawals.assetPlaceholder")} />
          <input
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            placeholder={t("withdrawals.networkPlaceholder")}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | WithdrawalStatusFilter)}>
            <option value="">ALL STATUS</option>
            {WITHDRAWAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={fromRequestedAt}
            onChange={(e) => setFromRequestedAt(e.target.value)}
            placeholder={t("withdrawals.fromRequestedAt")}
          />
          <input
            type="datetime-local"
            value={toRequestedAt}
            onChange={(e) => setToRequestedAt(e.target.value)}
            placeholder={t("withdrawals.toRequestedAt")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="withdrawal-limit">Limit</label>
          <select
            id="withdrawal-limit"
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
          <button className="admin-btn" disabled={loading || actionLoading} type="submit">
            {loading ? "Loading..." : t("withdrawals.loadWithdrawals")}
          </button>
        </div>
      </form>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-row table-head">
          <span>Time (UTC)</span>
          <span>User</span>
          <span>Asset</span>
          <span>Status / Action</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>No withdrawal data</span>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="table-row" key={row.withdrawalId}>
              <span>{row.requestedAt}</span>
              <span>{row.email}</span>
              <span>
                {row.asset} {row.amount} ({row.network})
              </span>
              <span>
                {row.status}
                {(row.status === "REQUESTED" || row.status === "REVIEW_PENDING") && (
                  <>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 8 }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("APPROVE", row.withdrawalId)}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 6, backgroundColor: "#b91c1c" }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("REJECT", row.withdrawalId)}
                      type="button"
                    >
                      Reject
                    </button>
                  </>
                )}
                {row.status === "APPROVED" && (
                  <>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 8 }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("BROADCAST", row.withdrawalId)}
                      type="button"
                    >
                      Broadcast
                    </button>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 6, backgroundColor: "#0369a1" }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("CONFIRM", row.withdrawalId)}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 6, backgroundColor: "#b91c1c" }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("FAIL", row.withdrawalId)}
                      type="button"
                    >
                      Fail
                    </button>
                  </>
                )}
                {row.status === "BROADCASTED" && (
                  <>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 8, backgroundColor: "#0369a1" }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("CONFIRM", row.withdrawalId)}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      className="admin-btn"
                      style={{ marginLeft: 6, backgroundColor: "#b91c1c" }}
                      disabled={actionLoading}
                      onClick={() => openActionModal("FAIL", row.withdrawalId)}
                      type="button"
                    >
                      Fail
                    </button>
                  </>
                )}
                {row.txHash && <div style={{ marginTop: 6 }}>txHash: {row.txHash}</div>}
                {row.rejectReason && <div style={{ marginTop: 4 }}>reject: {row.rejectReason}</div>}
                {row.failureReason && (
                  <div style={{ marginTop: 4 }}>failure: {row.failureReason}</div>
                )}
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
          Prev
        </button>
        <button
          className="admin-btn"
          disabled={loading || actionLoading || page >= totalPages}
          onClick={() => {
            void loadRows(page + 1);
          }}
          type="button"
        >
          Next
        </button>
        <span>
          Page {page} / {totalPages} (Total: {total})
        </span>
      </div>

      {actionModal && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{getActionMeta(actionModal.kind).title}</h3>
            <p className="muted">{getActionMeta(actionModal.kind).description}</p>

            {getActionMeta(actionModal.kind).requiresInput && (
              <div className="admin-modal-field">
                <label>{getActionMeta(actionModal.kind).inputLabel}</label>
                <input
                  value={actionModal.value}
                  onChange={(event) => {
                    setActionModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            value: event.target.value
                          }
                        : prev
                    );
                  }}
                  placeholder={getActionMeta(actionModal.kind).inputPlaceholder}
                />
              </div>
            )}

            {modalError && <div className="admin-feedback error">{modalError}</div>}

            <div className="admin-modal-actions">
              <button className="admin-btn secondary" disabled={actionLoading} onClick={closeActionModal} type="button">
                Cancel
              </button>
              <button className="admin-btn" disabled={actionLoading} onClick={() => void executeAction()} type="button">
                {actionLoading ? "Processing..." : getActionMeta(actionModal.kind).confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
