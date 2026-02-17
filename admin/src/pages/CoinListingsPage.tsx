import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../features/auth/auth-context";
import { useTranslation } from "../i18n/locale-context";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import { usePermissions } from "../components/PermissionGate";

type ChartSource = "BINANCE" | "INTERNAL";
type SimulatorMode = "SIMULATION_ONLY" | "LIVE_MARKET";

type CoinListingRow = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  chartSource: ChartSource;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CoinListingDraft = {
  chartSource: ChartSource;
  isActive: boolean;
  displayOrder: number;
};

type CoinListingsPayload = {
  items?: CoinListingRow[];
  total?: number;
};

type TradeSimulatorLogRow = {
  id: string;
  selectedIntervalMin: number;
  scheduledAt: string;
  executedAt: string;
  status: string;
  message?: string | null;
  createdAt: string;
};

type TradeSimulatorPayload = {
  symbol: string;
  feature: string;
  enabled: boolean;
  mode: SimulatorMode;
  modeOptions: SimulatorMode[];
  modeLiveMarketAvailable: boolean;
  modeLiveMarketRuntimeAllowed?: boolean;
  intervalCandidates: number[];
  allowedIntervals: number[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  timerActive: boolean;
  logs: TradeSimulatorLogRow[];
};

type LiveApprovalHistoryRow = {
  id: string;
  symbol: string;
  requestedMode: SimulatorMode;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByUserId: string;
  requestedByEmail: string | null;
  requestedReason: string;
  reviewedByUserId: string | null;
  reviewedByEmail: string | null;
  reviewReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

type LiveApprovalPayload = {
  symbol: string;
  mode: SimulatorMode;
  modeRequiresApproval: boolean;
  pendingRequest: LiveApprovalHistoryRow | null;
  activeApproval: LiveApprovalHistoryRow | null;
  executionAvailable: boolean;
  history: LiveApprovalHistoryRow[];
};

const INTERVAL_OPTIONS = [1, 3, 5, 10, 15, 20, 30, 60] as const;

const unsafeApi = api as unknown as {
  GET: (path: string, options?: unknown) => Promise<{ data?: unknown; error?: unknown }>;
  POST: (path: string, options?: unknown) => Promise<{ data?: unknown; error?: unknown }>;
  PATCH: (path: string, options?: unknown) => Promise<{ data?: unknown; error?: unknown }>;
};

export function CoinListingsPage() {
  const { session } = useAdminAuth();
  const permissions = usePermissions();
  const { t } = useTranslation();
  const [rows, setRows] = useState<CoinListingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CoinListingDraft>>({});
  const [loading, setLoading] = useState(false);
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [newSymbol, setNewSymbol] = useState("");
  const [newChartSource, setNewChartSource] = useState<ChartSource>("BINANCE");
  const [newIsActive, setNewIsActive] = useState(true);
  const [newDisplayOrder, setNewDisplayOrder] = useState(0);

  const [simulatorSymbol, setSimulatorSymbol] = useState<string | null>(null);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorSaving, setSimulatorSaving] = useState(false);
  const [simulatorData, setSimulatorData] = useState<TradeSimulatorPayload | null>(null);
  const [liveApprovalData, setLiveApprovalData] = useState<LiveApprovalPayload | null>(null);
  const [liveApprovalReason, setLiveApprovalReason] = useState("");
  const [liveReviewReason, setLiveReviewReason] = useState("");
  const [simulatorError, setSimulatorError] = useState<string | null>(null);

  const total = useMemo(() => rows.length, [rows.length]);
  const canReviewLiveApproval = permissions.includes("COMPLIANCE_APPROVE");
  const currentUserId = session?.user?.userId ?? null;

  const loadRows = async () => {
    setLoading(true);
    const { data, error } = await unsafeApi.GET("/admin/coin-listings");
    setLoading(false);

    if (error || !data) {
      setRows([]);
      setDrafts({});
      setErrorMessage(getApiErrorMessage(error, t("coinListings.loadFailed")));
      return;
    }

    const payload = data as CoinListingsPayload;
    const items = payload.items ?? [];
    setRows(items);
    setDrafts(
      Object.fromEntries(
        items.map((row) => [
          row.symbol,
          {
            chartSource: row.chartSource,
            isActive: row.isActive,
            displayOrder: row.displayOrder
          }
        ])
      )
    );
    setErrorMessage(null);
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const loadSimulator = async (symbol: string) => {
    setSimulatorSymbol(symbol);
    setSimulatorLoading(true);
    setSimulatorData(null);
    setLiveApprovalData(null);
    setLiveApprovalReason("");
    setLiveReviewReason("");
    setSimulatorError(null);

    const [simulatorResult, approvalResult] = await Promise.all([
      unsafeApi.GET(`/admin/coin-listings/${encodeURIComponent(symbol)}/simulator`, {
        params: { query: { limit: 40 } }
      }),
      unsafeApi.GET(`/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/live-approval`, {
        params: { query: { limit: 30 } }
      })
    ]);

    setSimulatorLoading(false);

    if (simulatorResult.error || !simulatorResult.data || typeof simulatorResult.data !== "object") {
      setSimulatorError(getApiErrorMessage(simulatorResult.error, t("coinListings.simulatorLoadFailed")));
      return;
    }

    if (approvalResult.error || !approvalResult.data || typeof approvalResult.data !== "object") {
      setSimulatorError(getApiErrorMessage(approvalResult.error, t("coinListings.simulatorLoadFailed")));
      return;
    }

    setSimulatorData(simulatorResult.data as TradeSimulatorPayload);
    setLiveApprovalData(approvalResult.data as LiveApprovalPayload);
  };

  const refreshLiveApproval = async (symbol: string) => {
    const { data, error } = await unsafeApi.GET(
      `/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/live-approval`,
      { params: { query: { limit: 30 } } }
    );
    if (error || !data || typeof data !== "object") {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorLoadFailed")));
      return;
    }
    setLiveApprovalData(data as LiveApprovalPayload);
  };

  const requestLiveApproval = async (symbol: string) => {
    const reason = liveApprovalReason.trim();
    if (reason.length < 8) {
      setSimulatorError(t("coinListings.liveApprovalReasonTooShort"));
      return;
    }

    setSimulatorSaving(true);
    setSimulatorError(null);
    const { error } = await unsafeApi.POST(
      `/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/live-approval/request`,
      { body: { reason } }
    );
    setSimulatorSaving(false);

    if (error) {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorUpdateFailed")));
      return;
    }

    setLiveApprovalReason("");
    setNoticeMessage(t("coinListings.liveApprovalRequested"));
    await loadSimulator(symbol);
  };

  const reviewLiveApproval = async (
    symbol: string,
    requestId: string,
    decision: "APPROVE" | "REJECT"
  ) => {
    const reason = liveReviewReason.trim();
    if (decision === "REJECT" && reason.length < 2) {
      setSimulatorError(t("coinListings.liveApprovalReviewReasonRequired"));
      return;
    }

    setSimulatorSaving(true);
    setSimulatorError(null);
    const { error } = await unsafeApi.POST(
      `/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/live-approval/${encodeURIComponent(requestId)}/review`,
      { body: { decision, reason: reason || undefined } }
    );
    setSimulatorSaving(false);

    if (error) {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorUpdateFailed")));
      return;
    }

    setLiveReviewReason("");
    setNoticeMessage(t("coinListings.liveApprovalReviewed"));
    await loadSimulator(symbol);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setNoticeMessage(null);

    const { error } = await unsafeApi.POST("/admin/coin-listings", {
      body: {
        symbol: newSymbol.trim().toUpperCase(),
        chartSource: newChartSource,
        isActive: newIsActive,
        displayOrder: Number.isFinite(newDisplayOrder) ? newDisplayOrder : 0
      }
    });

    setCreating(false);

    if (error) {
      setErrorMessage(getApiErrorMessage(error, t("coinListings.createFailed")));
      return;
    }

    setNewSymbol("");
    setNewChartSource("BINANCE");
    setNewIsActive(true);
    setNewDisplayOrder(0);
    setErrorMessage(null);
    setNoticeMessage(t("coinListings.created"));
    await loadRows();
  };

  const handleSaveRow = async (symbol: string) => {
    const draft = drafts[symbol];
    if (!draft) {
      return;
    }

    setSavingSymbol(symbol);
    setNoticeMessage(null);

    const { error } = await unsafeApi.PATCH(`/admin/coin-listings/${encodeURIComponent(symbol)}`, {
      body: {
        chartSource: draft.chartSource,
        isActive: draft.isActive,
        displayOrder: draft.displayOrder
      }
    });

    setSavingSymbol(null);

    if (error) {
      setErrorMessage(getApiErrorMessage(error, t("coinListings.saveFailed")));
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(t("coinListings.saved"));
    await loadRows();
  };

  const updateSimulatorRemote = async (symbol: string, payload: Record<string, unknown>, successMessage: string) => {
    setSimulatorSaving(true);
    setSimulatorError(null);

    const { error } = await unsafeApi.PATCH(`/admin/coin-listings/${encodeURIComponent(symbol)}/simulator`, {
      body: payload
    });

    setSimulatorSaving(false);

    if (error) {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorUpdateFailed")));
      return;
    }

    setNoticeMessage(successMessage);
    await loadSimulator(symbol);
  };

  const startSimulator = async (symbol: string) => {
    setSimulatorSaving(true);
    setSimulatorError(null);

    const { error } = await unsafeApi.POST(`/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/start`);

    setSimulatorSaving(false);

    if (error) {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorUpdateFailed")));
      return;
    }

    setNoticeMessage(t("coinListings.simulatorStarted"));
    await loadSimulator(symbol);
  };

  const stopSimulator = async (symbol: string) => {
    setSimulatorSaving(true);
    setSimulatorError(null);

    const { error } = await unsafeApi.POST(`/admin/coin-listings/${encodeURIComponent(symbol)}/simulator/stop`);

    setSimulatorSaving(false);

    if (error) {
      setSimulatorError(getApiErrorMessage(error, t("coinListings.simulatorUpdateFailed")));
      return;
    }

    setNoticeMessage(t("coinListings.simulatorStopped"));
    await loadSimulator(symbol);
  };

  return (
    <main>
      <h2>{t("coinListings.title")}</h2>
      <p className="muted">{t("coinListings.subtitle")}</p>

      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}
      {noticeMessage && <div className="admin-feedback success">{noticeMessage}</div>}

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleCreate}>
        <h3>{t("coinListings.newSection")}</h3>
        <div className="admin-form-grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <input
            placeholder={t("coinListings.symbol")}
            value={newSymbol}
            onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
            required
          />
          <select
            value={newChartSource}
            onChange={(event) => setNewChartSource(event.target.value as ChartSource)}
          >
            <option value="BINANCE">BINANCE</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              checked={newIsActive}
              onChange={(event) => setNewIsActive(event.target.checked)}
              type="checkbox"
            />
            {t("coinListings.isActive")}
          </label>
          <input
            min={0}
            step={1}
            type="number"
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(Number(event.target.value))}
            placeholder={t("coinListings.displayOrder")}
          />
        </div>
        <button className="admin-btn" disabled={creating} type="submit" style={{ marginTop: 10 }}>
          {creating ? t("common.processing") : t("coinListings.create")}
        </button>
      </form>

      <div className="table-card">
        <div className="table-row table-head" style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.7fr 0.9fr 0.7fr 0.8fr" }}>
          <span>{t("coinListings.symbol")}</span>
          <span>{t("coinListings.chartSource")}</span>
          <span>{t("coinListings.isActive")}</span>
          <span>{t("coinListings.displayOrder")}</span>
          <span>{t("common.lastUpdate")}</span>
          <span>{t("coinListings.actions")}</span>
          <span>{t("coinListings.simulator")}</span>
        </div>
        {loading ? (
          <div className="table-row" style={{ gridTemplateColumns: "1fr" }}>
            <span>{t("common.loading")}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="table-row" style={{ gridTemplateColumns: "1fr" }}>
            <span>-</span>
          </div>
        ) : (
          rows.map((row) => {
            const draft = drafts[row.symbol] ?? {
              chartSource: row.chartSource,
              isActive: row.isActive,
              displayOrder: row.displayOrder
            };
            const isSaving = savingSymbol === row.symbol;

            return (
              <div
                key={row.symbol}
                className="table-row"
                style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.7fr 0.9fr 0.7fr 0.8fr" }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.symbol}</span>
                <select
                  value={draft.chartSource}
                  onChange={(event) => {
                    const next = event.target.value as ChartSource;
                    setDrafts((prev) => ({ ...prev, [row.symbol]: { ...draft, chartSource: next } }));
                  }}
                  style={{ maxWidth: 140 }}
                >
                  <option value="BINANCE">BINANCE</option>
                  <option value="INTERNAL">INTERNAL</option>
                </select>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    checked={draft.isActive}
                    onChange={(event) => {
                      setDrafts((prev) => ({
                        ...prev,
                        [row.symbol]: { ...draft, isActive: event.target.checked }
                      }));
                    }}
                    type="checkbox"
                  />
                  {draft.isActive ? t("common.enabled") : t("common.disabled")}
                </label>
                <input
                  min={0}
                  step={1}
                  type="number"
                  value={draft.displayOrder}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setDrafts((prev) => ({
                      ...prev,
                      [row.symbol]: {
                        ...draft,
                        displayOrder: Number.isFinite(next) ? next : 0
                      }
                    }));
                  }}
                />
                <span style={{ fontSize: 12 }}>{new Date(row.updatedAt).toLocaleString()}</span>
                <button
                  className="admin-btn"
                  disabled={isSaving}
                  onClick={() => void handleSaveRow(row.symbol)}
                  type="button"
                >
                  {isSaving ? t("common.processing") : t("coinListings.save")}
                </button>
                <button
                  className="admin-btn secondary"
                  onClick={() => void loadSimulator(row.symbol)}
                  type="button"
                >
                  {t("coinListings.simulatorOpen")}
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="muted" style={{ marginTop: 10 }}>{t("coinListings.total", { count: String(total) })}</p>

      {simulatorSymbol && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card" style={{ width: "min(760px, 100%)" }}>
            <h3>{t("coinListings.simulator")}</h3>
            <p className="muted" style={{ marginTop: 4 }}>{simulatorSymbol}</p>

            {simulatorError && <div className="admin-feedback error" style={{ marginTop: 10 }}>{simulatorError}</div>}

            {simulatorLoading || !simulatorData ? (
              <p className="muted" style={{ marginTop: 12 }}>{t("common.loading")}</p>
            ) : (
              <>
                <div className="admin-form-grid" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.simulatorStatus")}</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>
                      {simulatorData.enabled ? "RUNNING" : "STOPPED"}
                    </div>
                  </div>
                  <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.simulatorNextRun")}</div>
                    <div style={{ marginTop: 4, fontWeight: 700, fontSize: 12 }}>
                      {simulatorData.nextRunAt ? new Date(simulatorData.nextRunAt).toLocaleString() : "-"}
                    </div>
                  </div>
                  <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.simulatorRunCount")}</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>{simulatorData.runCount}</div>
                  </div>
                </div>

                <div className="admin-modal-field" style={{ marginTop: 14 }}>
                  <label>{t("coinListings.simulatorMode")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className={`admin-btn ${simulatorData.mode === "SIMULATION_ONLY" ? "" : "secondary"}`}
                      type="button"
                      disabled={simulatorSaving}
                      style={{ marginTop: 0 }}
                      onClick={() => setSimulatorData((prev) => (prev ? { ...prev, mode: "SIMULATION_ONLY" } : prev))}
                    >
                      {t("coinListings.simulatorModeSimulationOnly")}
                    </button>
                    <button
                      className={`admin-btn ${simulatorData.mode === "LIVE_MARKET" ? "" : "secondary"}`}
                      type="button"
                      disabled={simulatorSaving}
                      style={{ marginTop: 0 }}
                      onClick={() => setSimulatorData((prev) => (prev ? { ...prev, mode: "LIVE_MARKET" } : prev))}
                    >
                      {t("coinListings.simulatorModeLiveMarket")}
                    </button>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>{t("coinListings.simulatorLiveDisabled")}</div>
                </div>

                <div className="table-card" style={{ marginTop: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{t("coinListings.liveApproval")}</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        {t("coinListings.liveApprovalGuide")}
                      </div>
                    </div>
                    <button
                      className="admin-btn secondary"
                      style={{ marginTop: 0 }}
                      type="button"
                      disabled={simulatorSaving}
                      onClick={() => void refreshLiveApproval(simulatorData.symbol)}
                    >
                      {t("coinListings.liveApprovalRefreshButton")}
                    </button>
                  </div>

                  {!liveApprovalData ? (
                    <p className="muted" style={{ marginTop: 10 }}>{t("common.loading")}</p>
                  ) : (
                    <>
                      <div className="admin-form-grid" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.liveApprovalPending")}</div>
                          <div style={{ marginTop: 4, fontWeight: 700 }}>
                            {liveApprovalData.pendingRequest ? "YES" : "NO"}
                          </div>
                        </div>
                        <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.liveApprovalApproved")}</div>
                          <div style={{ marginTop: 4, fontWeight: 700 }}>
                            {liveApprovalData.activeApproval ? "ACTIVE" : "NONE"}
                          </div>
                        </div>
                        <div className="table-card" style={{ marginTop: 0, padding: 10 }}>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("coinListings.simulatorMode")}</div>
                          <div style={{ marginTop: 4, fontWeight: 700 }}>{liveApprovalData.mode}</div>
                        </div>
                      </div>

                      {simulatorData.mode !== "LIVE_MARKET" ? (
                        <div className="muted" style={{ marginTop: 10 }}>
                          {t("coinListings.liveApprovalNeedLiveMode")}
                        </div>
                      ) : (
                        <>
                          {!liveApprovalData.pendingRequest && (
                            <div className="admin-modal-field" style={{ marginTop: 12 }}>
                              <label>{t("coinListings.liveApprovalReason")}</label>
                              <textarea
                                value={liveApprovalReason}
                                onChange={(event) => setLiveApprovalReason(event.target.value)}
                                placeholder={t("coinListings.liveApprovalReason")}
                                style={{ minHeight: 80 }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                  className="admin-btn"
                                  type="button"
                                  disabled={simulatorSaving || liveApprovalReason.trim().length < 8}
                                  onClick={() => void requestLiveApproval(simulatorData.symbol)}
                                >
                                  {t("coinListings.liveApprovalRequestButton")}
                                </button>
                              </div>
                            </div>
                          )}

                          {liveApprovalData.pendingRequest && (
                            <div className="table-card" style={{ marginTop: 10, padding: 10 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("coinListings.liveApprovalPending")}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                {t("coinListings.liveApprovalRequester")}:{" "}
                                {liveApprovalData.pendingRequest.requestedByEmail ?? liveApprovalData.pendingRequest.requestedByUserId}
                              </div>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                {new Date(liveApprovalData.pendingRequest.requestedAt).toLocaleString()}
                              </div>
                              <div style={{ marginTop: 8, fontSize: 13 }}>{liveApprovalData.pendingRequest.requestedReason}</div>

                              {canReviewLiveApproval && liveApprovalData.pendingRequest.requestedByUserId !== currentUserId ? (
                                <div className="admin-modal-field" style={{ marginTop: 10 }}>
                                  <label>{t("coinListings.liveApprovalReviewReason")}</label>
                                  <textarea
                                    value={liveReviewReason}
                                    onChange={(event) => setLiveReviewReason(event.target.value)}
                                    placeholder={t("coinListings.liveApprovalReviewReason")}
                                    style={{ minHeight: 72 }}
                                  />
                                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                    <button
                                      className="admin-btn"
                                      type="button"
                                      disabled={simulatorSaving}
                                      onClick={() =>
                                        void reviewLiveApproval(
                                          simulatorData.symbol,
                                          liveApprovalData.pendingRequest!.id,
                                          "APPROVE"
                                        )
                                      }
                                    >
                                      {t("coinListings.liveApprovalApproveButton")}
                                    </button>
                                    <button
                                      className="admin-btn secondary"
                                      type="button"
                                      disabled={simulatorSaving || liveReviewReason.trim().length < 2}
                                      onClick={() =>
                                        void reviewLiveApproval(
                                          simulatorData.symbol,
                                          liveApprovalData.pendingRequest!.id,
                                          "REJECT"
                                        )
                                      }
                                    >
                                      {t("coinListings.liveApprovalRejectButton")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                                  {t("coinListings.liveApprovalReviewer")}
                                  {": "}
                                  {canReviewLiveApproval ? "-" : "COMPLIANCE_APPROVE required"}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                            {t("coinListings.liveApprovalExecutionBlocked")}
                          </div>
                        </>
                      )}

                      <div className="table-card" style={{ marginTop: 10, maxHeight: 200, overflow: "auto" }}>
                        <div className="table-row table-head" style={{ gridTemplateColumns: "0.8fr 1.2fr 1.4fr 1fr 1fr" }}>
                          <span>{t("coinListings.liveApproval")}</span>
                          <span>{t("coinListings.liveApprovalRequester")}</span>
                          <span>{t("coinListings.liveApprovalReviewer")}</span>
                          <span>{t("coinListings.liveApprovalPending")}</span>
                          <span>{t("coinListings.liveApprovalReviewReason")}</span>
                        </div>
                        {liveApprovalData.history.length === 0 ? (
                          <div className="table-row" style={{ gridTemplateColumns: "1fr" }}>
                            <span>{t("coinListings.liveApprovalNoData")}</span>
                          </div>
                        ) : (
                          liveApprovalData.history.map((row) => (
                            <div
                              key={row.id}
                              className="table-row"
                              style={{ gridTemplateColumns: "0.8fr 1.2fr 1.4fr 1fr 1fr" }}
                            >
                              <span style={{ fontSize: 12 }}>
                                {row.status === "PENDING"
                                  ? t("coinListings.liveApprovalPending")
                                  : row.status === "APPROVED"
                                    ? row.isActive
                                      ? t("coinListings.liveApprovalApproved")
                                      : t("coinListings.liveApprovalExpired")
                                    : t("coinListings.liveApprovalRejected")}
                              </span>
                              <span style={{ fontSize: 12 }}>
                                {(row.requestedByEmail ?? row.requestedByUserId) || "-"}
                              </span>
                              <span style={{ fontSize: 12 }}>
                                {(row.reviewedByEmail ?? row.reviewedByUserId) || "-"}
                              </span>
                              <span style={{ fontSize: 12 }}>{new Date(row.requestedAt).toLocaleString()}</span>
                              <span style={{ fontSize: 12 }}>{row.reviewReason ?? row.requestedReason}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="admin-modal-field" style={{ marginTop: 14 }}>
                  <label>{t("coinListings.simulatorIntervals")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                    {INTERVAL_OPTIONS.map((m) => {
                      const checked = simulatorData.intervalCandidates.includes(m);
                      return (
                        <label key={m} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const on = event.target.checked;
                              setSimulatorData((prev) => {
                                if (!prev) return prev;
                                const next = on
                                  ? [...new Set([...prev.intervalCandidates, m])]
                                  : prev.intervalCandidates.filter((v) => v !== m);
                                return { ...prev, intervalCandidates: next.sort((a, b) => a - b) };
                              });
                            }}
                          />
                          {m >= 60 ? "1시간" : `${m}분`}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="admin-modal-actions" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="admin-btn"
                      type="button"
                      disabled={simulatorSaving || simulatorData.intervalCandidates.length === 0}
                      onClick={() => {
                        void updateSimulatorRemote(
                          simulatorData.symbol,
                          {
                            enabled: simulatorData.enabled,
                            mode: simulatorData.mode,
                            intervalCandidates: simulatorData.intervalCandidates
                          },
                          t("coinListings.simulatorUpdated")
                        );
                      }}
                    >
                      {simulatorSaving ? t("common.processing") : t("coinListings.simulatorSave")}
                    </button>
                    <button
                      className="admin-btn"
                      type="button"
                      disabled={
                        simulatorSaving ||
                        (simulatorData.mode === "LIVE_MARKET" && !liveApprovalData?.executionAvailable)
                      }
                      onClick={() => void startSimulator(simulatorData.symbol)}
                    >
                      {t("coinListings.simulatorStart")}
                    </button>
                    <button
                      className="admin-btn secondary"
                      type="button"
                      disabled={simulatorSaving}
                      onClick={() => void stopSimulator(simulatorData.symbol)}
                    >
                      {t("coinListings.simulatorStop")}
                    </button>
                  </div>
                  <button className="admin-btn secondary" type="button" onClick={() => setSimulatorSymbol(null)}>
                    {t("common.close")}
                  </button>
                </div>

                <div className="table-card" style={{ marginTop: 14, maxHeight: 240, overflow: "auto" }}>
                  <div className="table-row table-head" style={{ gridTemplateColumns: "0.5fr 1fr 1fr 0.6fr 1.5fr" }}>
                    <span>간격</span>
                    <span>예약시간</span>
                    <span>실행시간</span>
                    <span>상태</span>
                    <span>{t("coinListings.simulatorLogs")}</span>
                  </div>
                  {simulatorData.logs.length === 0 ? (
                    <div className="table-row" style={{ gridTemplateColumns: "1fr" }}>
                      <span>-</span>
                    </div>
                  ) : (
                    simulatorData.logs.map((log) => (
                      <div key={log.id} className="table-row" style={{ gridTemplateColumns: "0.5fr 1fr 1fr 0.6fr 1.5fr" }}>
                        <span>{log.selectedIntervalMin}m</span>
                        <span style={{ fontSize: 12 }}>{new Date(log.scheduledAt).toLocaleString()}</span>
                        <span style={{ fontSize: 12 }}>{new Date(log.executedAt).toLocaleString()}</span>
                        <span>{log.status}</span>
                        <span style={{ fontSize: 12 }}>{log.message ?? "-"}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
