import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { getAdminSession } from "../features/auth/auth-storage";
import { api, apiBaseUrl } from "../lib/api";
import { streamSseWithBackoff } from "../lib/sse-stream";
import { useTranslation } from "../i18n/locale-context";

type OrderRow = {
  orderId: string;
  email: string;
  symbol: string;
  side: string;
  status: string;
  quantity: string;
  createdAt: string;
};

type WithdrawalRow = {
  withdrawalId: string;
  email: string;
  asset: string;
  network: string;
  amount: string;
  status: string;
  requestedAt: string;
};

type AuditLogRow = {
  id: string;
  actorEmail?: string | null;
  action?: string;
  targetType?: string;
  targetId?: string | null;
  createdAt?: string;
};

type DashboardSectionError = {
  code?: string;
  message?: string;
};

type DashboardStreamDiff = {
  changed?: boolean;
  sectionChanges?: {
    orders?: boolean;
    withdrawals?: boolean;
    auditLogs?: boolean;
  };
  summaryDelta?: {
    openOrdersLoaded?: number;
    pendingWithdrawalsLoaded?: number;
    riskAlertsLoaded?: number;
    adminActionsLoaded?: number;
    permissionChangesLoaded?: number;
  };
};

type DashboardOverviewResponse = {
  generatedAt?: string;
  orders?: {
    items?: OrderRow[];
    permissionDenied?: boolean;
    partialError?: DashboardSectionError | null;
  };
  withdrawals?: {
    items?: WithdrawalRow[];
    permissionDenied?: boolean;
    partialError?: DashboardSectionError | null;
  };
  auditLogs?: {
    items?: AuditLogRow[];
    permissionDenied?: boolean;
    partialError?: DashboardSectionError | null;
  };
};

type DashboardStreamEnvelope = {
  eventType?: string;
  eventVersion?: number;
  diff?: DashboardStreamDiff | null;
  data?: DashboardOverviewResponse | { message?: string };
};

type DashboardStreamEventKind = "full" | "partial" | "error";

type DashboardOverviewQuery = {
  limit: number;
  orderStatus?: string;
  orderSymbol?: string;
  withdrawalStatus?: string;
  auditAction?: string;
};

type DashboardDetailModal = {
  kind: "ORDER" | "WITHDRAWAL" | "AUDIT";
  title: string;
  payload: unknown;
};

type DashboardFilterPreset = {
  orderStatus: string;
  orderSymbol: string;
  withdrawalStatus: string;
  auditAction: string;
};

type DashboardSharePayload = {
  orderStatus?: string;
  orderSymbol?: string;
  withdrawalStatus?: string;
  auditAction?: string;
  presetSlot?: DashboardPresetSlot;
};

type DashboardShareLinkCreateResponse = {
  shareCode?: string;
  sharePath?: string;
  expiresAt?: string;
  createdAt?: string;
  payload?: DashboardSharePayload;
};

type DashboardShareLinkResolveResponse = {
  shareCode?: string;
  expiresAt?: string;
  createdAt?: string;
  payload?: DashboardSharePayload;
};

const DASHBOARD_PRESET_SLOTS = [
  { id: "default", label: "Default" },
  { id: "risk-watch", label: "Risk Watch" },
  { id: "compliance", label: "Compliance" }
] as const;

const DASHBOARD_SHARE_EXPIRY_OPTIONS = [
  { minutes: 30, label: "30m" },
  { minutes: 120, label: "2h" },
  { minutes: 360, label: "6h" },
  { minutes: 1440, label: "24h" },
  { minutes: 10080, label: "7d" }
] as const;
const DASHBOARD_SHARE_DEFAULT_EXPIRY_MINUTES = 1440;

type DashboardPresetSlot = (typeof DASHBOARD_PRESET_SLOTS)[number]["id"];
type DashboardFilterPresetCollection = Partial<Record<DashboardPresetSlot, DashboardFilterPreset>>;

const DASHBOARD_PRESET_FIELDS = [
  "orderStatus",
  "orderSymbol",
  "withdrawalStatus",
  "auditAction"
] as const;

function isDashboardPresetSlot(value: string | null): value is DashboardPresetSlot {
  return DASHBOARD_PRESET_SLOTS.some((slot) => slot.id === value);
}

function normalizeFilterValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function toValidShareExpiryMinutes(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const matched = DASHBOARD_SHARE_EXPIRY_OPTIONS.find((option) => option.minutes === parsed);
  return matched?.minutes ?? null;
}

function toDashboardSharePayloadFromFilters(input: {
  orderStatus: string;
  orderSymbol: string;
  withdrawalStatus: string;
  auditAction: string;
  presetSlot: DashboardPresetSlot;
}): DashboardSharePayload {
  const payload: DashboardSharePayload = {};

  const orderStatus = normalizeFilterValue(input.orderStatus);
  const orderSymbol = normalizeFilterValue(input.orderSymbol);
  const withdrawalStatus = normalizeFilterValue(input.withdrawalStatus);
  const auditAction = normalizeFilterValue(input.auditAction);

  if (orderStatus) {
    payload.orderStatus = orderStatus;
  }
  if (orderSymbol) {
    payload.orderSymbol = orderSymbol;
  }
  if (withdrawalStatus) {
    payload.withdrawalStatus = withdrawalStatus;
  }
  if (auditAction) {
    payload.auditAction = auditAction;
  }
  if (input.presetSlot !== "default") {
    payload.presetSlot = input.presetSlot;
  }

  return payload;
}

function hasDashboardSharePayload(payload: DashboardSharePayload): boolean {
  return (
    Boolean(payload.orderStatus) ||
    Boolean(payload.orderSymbol) ||
    Boolean(payload.withdrawalStatus) ||
    Boolean(payload.auditAction) ||
    Boolean(payload.presetSlot)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function useDebouncedText(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

function getSectionNoteTone(code?: string): "warning" | "error" {
  if (code === "PERMISSION_DENIED") {
    return "warning";
  }
  return "error";
}

function parseDashboardStreamEventKind(eventType?: string): DashboardStreamEventKind | null {
  if (eventType === "admin.dashboard.overview.full") {
    return "full";
  }
  if (eventType === "admin.dashboard.overview.partial") {
    return "partial";
  }
  if (eventType === "admin.dashboard.error") {
    return "error";
  }
  return null;
}

function normalizePreset(value: unknown): DashboardFilterPreset | null {
  if (!isRecord(value)) {
    return null;
  }

  const hasPresetShape = DASHBOARD_PRESET_FIELDS.some((field) => typeof value[field] === "string");
  if (!hasPresetShape) {
    return null;
  }

  const normalized: DashboardFilterPreset = {
    orderStatus: typeof value.orderStatus === "string" ? value.orderStatus : "",
    orderSymbol: typeof value.orderSymbol === "string" ? value.orderSymbol : "",
    withdrawalStatus: typeof value.withdrawalStatus === "string" ? value.withdrawalStatus : "",
    auditAction: typeof value.auditAction === "string" ? value.auditAction : ""
  };

  return normalized;
}

function toPresetCollection(value: unknown): DashboardFilterPresetCollection {
  if (!isRecord(value)) {
    return {};
  }

  // Backward compatibility: legacy format stored a single preset object.
  const legacyPreset = normalizePreset(value);
  if (legacyPreset) {
    return { default: legacyPreset };
  }

  const next: DashboardFilterPresetCollection = {};
  for (const slot of DASHBOARD_PRESET_SLOTS) {
    const preset = normalizePreset(value[slot.id]);
    if (preset) {
      next[slot.id] = preset;
    }
  }
  return next;
}

const DASHBOARD_REFRESH_MS = 10000;
const DASHBOARD_MAX_BACKOFF_MS = 60000;
const DASHBOARD_FILTER_PRESET_KEY = "gnndex.admin.dashboard.filters";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshFailures, setRefreshFailures] = useState(0);
  const [nextRefreshMs, setNextRefreshMs] = useState(DASHBOARD_REFRESH_MS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DashboardDetailModal | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyFeedbackTone, setCopyFeedbackTone] = useState<"success" | "error">("success");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderSymbolFilter, setOrderSymbolFilter] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [ordersSectionCode, setOrdersSectionCode] = useState<string | null>(null);
  const [ordersSectionMessage, setOrdersSectionMessage] = useState<string | null>(null);
  const [withdrawalsSectionCode, setWithdrawalsSectionCode] = useState<string | null>(null);
  const [withdrawalsSectionMessage, setWithdrawalsSectionMessage] = useState<string | null>(null);
  const [auditSectionCode, setAuditSectionCode] = useState<string | null>(null);
  const [auditSectionMessage, setAuditSectionMessage] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const [selectedPresetSlot, setSelectedPresetSlot] = useState<DashboardPresetSlot>("default");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetMessageTone, setPresetMessageTone] = useState<"success" | "error">("success");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareMessageTone, setShareMessageTone] = useState<"success" | "error">("success");
  const [selectedShareExpiryMinutes, setSelectedShareExpiryMinutes] = useState<number>(
    DASHBOARD_SHARE_DEFAULT_EXPIRY_MINUTES
  );
  const [shareResolveInFlight, setShareResolveInFlight] = useState(false);
  const [shareCreateInFlight, setShareCreateInFlight] = useState(false);
  const [handledShareCode, setHandledShareCode] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "connected" | "reconnecting" | "error">(
    "connecting"
  );
  const [streamRetryAttempt, setStreamRetryAttempt] = useState(0);
  const [streamRetryDelayMs, setStreamRetryDelayMs] = useState<number | null>(null);
  const [streamEventKind, setStreamEventKind] = useState<DashboardStreamEventKind | null>(null);
  const [streamDiffMessage, setStreamDiffMessage] = useState<string | null>(null);
  const [ordersHighlightTick, setOrdersHighlightTick] = useState(0);
  const [withdrawalsHighlightTick, setWithdrawalsHighlightTick] = useState(0);
  const [auditHighlightTick, setAuditHighlightTick] = useState(0);
  const debouncedOrderStatusFilter = useDebouncedText(orderStatusFilter, 350);
  const debouncedOrderSymbolFilter = useDebouncedText(orderSymbolFilter, 350);
  const debouncedWithdrawalStatusFilter = useDebouncedText(withdrawalStatusFilter, 350);
  const debouncedAuditActionFilter = useDebouncedText(auditActionFilter, 350);

  useEffect(() => {
    const hasSharedFilterParams =
      DASHBOARD_PRESET_FIELDS.some((field) => searchParams.has(field)) ||
      searchParams.has("presetSlot");
    setOrderStatusFilter(searchParams.get("orderStatus") ?? "");
    setOrderSymbolFilter(searchParams.get("orderSymbol") ?? "");
    setWithdrawalStatusFilter(searchParams.get("withdrawalStatus") ?? "");
    setAuditActionFilter(searchParams.get("auditAction") ?? "");
    const nextPresetSlot = searchParams.get("presetSlot");
    if (isDashboardPresetSlot(nextPresetSlot)) {
      setSelectedPresetSlot(nextPresetSlot);
    } else {
      setSelectedPresetSlot("default");
    }
    const nextShareExpiryMinutes = toValidShareExpiryMinutes(searchParams.get("shareTtlPreset"));
    setSelectedShareExpiryMinutes(nextShareExpiryMinutes ?? DASHBOARD_SHARE_DEFAULT_EXPIRY_MINUTES);
    if (!filtersReady && hasSharedFilterParams) {
      setShareMessageTone("success");
      setShareMessage(t("dashboard.shareRestoredFromUrl"));
    }
    setFiltersReady(true);
  }, [filtersReady, searchParams]);

  useEffect(() => {
    if (!filtersReady) {
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    const syncField = (key: string, value: string) => {
      const normalized = value.trim();
      if (!normalized) {
        nextParams.delete(key);
        return;
      }
      nextParams.set(key, normalized);
    };

    syncField("orderStatus", orderStatusFilter);
    syncField("orderSymbol", orderSymbolFilter);
    syncField("withdrawalStatus", withdrawalStatusFilter);
    syncField("auditAction", auditActionFilter);
    if (selectedPresetSlot === "default") {
      nextParams.delete("presetSlot");
    } else {
      nextParams.set("presetSlot", selectedPresetSlot);
    }
    if (selectedShareExpiryMinutes === DASHBOARD_SHARE_DEFAULT_EXPIRY_MINUTES) {
      nextParams.delete("shareTtlPreset");
    } else {
      nextParams.set("shareTtlPreset", String(selectedShareExpiryMinutes));
    }

    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;
    const nextSearch = nextParams.toString();

    if (nextSearch !== currentSearch) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    auditActionFilter,
    filtersReady,
    location.search,
    orderStatusFilter,
    orderSymbolFilter,
    selectedPresetSlot,
    selectedShareExpiryMinutes,
    setSearchParams,
    withdrawalStatusFilter
  ]);

  const applyDashboardPayload = useCallback((payload: DashboardOverviewResponse) => {
    const orderPermissionDenied = payload.orders?.permissionDenied === true;
    const withdrawalPermissionDenied = payload.withdrawals?.permissionDenied === true;
    const auditPermissionDenied = payload.auditLogs?.permissionDenied === true;
    const orderErrorCode = payload.orders?.partialError?.code ?? null;
    const withdrawalErrorCode = payload.withdrawals?.partialError?.code ?? null;
    const auditErrorCode = payload.auditLogs?.partialError?.code ?? null;
    const orderErrorMessage = payload.orders?.partialError?.message ?? null;
    const withdrawalErrorMessage = payload.withdrawals?.partialError?.message ?? null;
    const auditErrorMessage = payload.auditLogs?.partialError?.message ?? null;

    setOrdersSectionCode(orderErrorCode);
    setOrdersSectionMessage(orderErrorMessage);
    setWithdrawalsSectionCode(withdrawalErrorCode);
    setWithdrawalsSectionMessage(withdrawalErrorMessage);
    setAuditSectionCode(auditErrorCode);
    setAuditSectionMessage(auditErrorMessage);

    if (orderPermissionDenied || withdrawalPermissionDenied || auditPermissionDenied) {
      setErrorMessage(t("dashboard.errorMissingPermissions"));
    } else if (
      orderErrorCode === "SECTION_LOAD_FAILED" ||
      withdrawalErrorCode === "SECTION_LOAD_FAILED" ||
      auditErrorCode === "SECTION_LOAD_FAILED"
    ) {
      setErrorMessage(t("dashboard.errorDegraded"));
    } else {
      setErrorMessage(null);
    }
    setOrders(payload.orders?.items ?? []);
    setWithdrawals(payload.withdrawals?.items ?? []);
    setAuditLogs(payload.auditLogs?.items ?? []);
    setLastUpdatedAt(payload.generatedAt ?? new Date().toISOString());
  }, []);

  const dashboardOverviewQuery = useMemo<DashboardOverviewQuery>(() => {
    const orderStatus = debouncedOrderStatusFilter.trim();
    const orderSymbol = debouncedOrderSymbolFilter.trim();
    const withdrawalStatus = debouncedWithdrawalStatusFilter.trim();
    const auditAction = debouncedAuditActionFilter.trim();

    return {
      limit: 10,
      ...(orderStatus ? { orderStatus } : {}),
      ...(orderSymbol ? { orderSymbol } : {}),
      ...(withdrawalStatus ? { withdrawalStatus } : {}),
      ...(auditAction ? { auditAction } : {})
    };
  }, [
    debouncedAuditActionFilter,
    debouncedOrderStatusFilter,
    debouncedOrderSymbolFilter,
    debouncedWithdrawalStatusFilter
  ]);
  const filtersDebouncing =
    orderStatusFilter.trim() !== debouncedOrderStatusFilter.trim() ||
    orderSymbolFilter.trim() !== debouncedOrderSymbolFilter.trim() ||
    withdrawalStatusFilter.trim() !== debouncedWithdrawalStatusFilter.trim() ||
    auditActionFilter.trim() !== debouncedAuditActionFilter.trim();

  const loadDashboard = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true);
    }

    const overviewRes = await api.GET("/admin/dashboard/overview", {
      params: { query: dashboardOverviewQuery }
    });

    if (!options?.background) {
      setLoading(false);
    }

    if (overviewRes.error || !overviewRes.data) {
      setOrders([]);
      setWithdrawals([]);
      setAuditLogs([]);
      setOrdersSectionCode(null);
      setOrdersSectionMessage(null);
      setWithdrawalsSectionCode(null);
      setWithdrawalsSectionMessage(null);
      setAuditSectionCode(null);
      setAuditSectionMessage(null);
      setErrorMessage(t("dashboard.errorLoadFailed"));
      return false;
    }

    applyDashboardPayload(overviewRes.data as DashboardOverviewResponse);
    return true;
  }, [applyDashboardPayload, dashboardOverviewQuery]);

  const applySharePayload = useCallback((payload?: DashboardSharePayload) => {
    setOrderStatusFilter(normalizeFilterValue(payload?.orderStatus));
    setOrderSymbolFilter(normalizeFilterValue(payload?.orderSymbol));
    setWithdrawalStatusFilter(normalizeFilterValue(payload?.withdrawalStatus));
    setAuditActionFilter(normalizeFilterValue(payload?.auditAction));
    const nextPresetSlot =
      payload?.presetSlot && isDashboardPresetSlot(payload.presetSlot) ? payload.presetSlot : "default";
    setSelectedPresetSlot(nextPresetSlot);
  }, []);

  useEffect(() => {
    const shareCode = searchParams.get("share")?.trim();
    if (!shareCode) {
      if (handledShareCode !== null) {
        setHandledShareCode(null);
      }
      return;
    }
    if (handledShareCode === shareCode || shareResolveInFlight) {
      return;
    }

    let isActive = true;
    setShareResolveInFlight(true);

    void (async () => {
      const response = await api.GET("/admin/dashboard/share-links/{shareCode}", {
        params: {
          path: {
            shareCode
          }
        }
      });

      if (!isActive) {
        return;
      }

      if (!response.data) {
        setShareMessageTone("error");
        setShareMessage(t("dashboard.shareResolveFailed"));
        setHandledShareCode(shareCode);
        return;
      }

      const resolved = response.data as DashboardShareLinkResolveResponse;
      applySharePayload(resolved.payload);
      const expiresLabel = resolved.expiresAt
        ? ` (expires ${new Date(resolved.expiresAt).toLocaleString()})`
        : "";
      setShareMessageTone("success");
      setShareMessage(`Shared dashboard link restored${expiresLabel}`);
      setHandledShareCode(shareCode);
    })().finally(() => {
      if (isActive) {
        setShareResolveInFlight(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [applySharePayload, handledShareCode, searchParams, shareResolveInFlight]);

  useEffect(() => {
    loadDashboard().catch(() => {
      setOrders([]);
      setWithdrawals([]);
      setAuditLogs([]);
      setOrdersSectionCode(null);
      setOrdersSectionMessage(null);
      setWithdrawalsSectionCode(null);
      setWithdrawalsSectionMessage(null);
      setAuditSectionCode(null);
      setAuditSectionMessage(null);
      setErrorMessage(t("dashboard.errorLoadFailed"));
    });
  }, [loadDashboard]);

  useEffect(() => {
    const initialToken = getAdminSession()?.tokens?.accessToken;
    if (!initialToken) {
      setStreamState("error");
      return;
    }

    const controller = new AbortController();
    const normalizedBaseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
    const streamUrl = new URL("admin/dashboard/stream", normalizedBaseUrl);
    streamUrl.searchParams.set("limit", String(dashboardOverviewQuery.limit));
    if (dashboardOverviewQuery.orderStatus) {
      streamUrl.searchParams.set("orderStatus", dashboardOverviewQuery.orderStatus);
    }
    if (dashboardOverviewQuery.orderSymbol) {
      streamUrl.searchParams.set("orderSymbol", dashboardOverviewQuery.orderSymbol);
    }
    if (dashboardOverviewQuery.withdrawalStatus) {
      streamUrl.searchParams.set("withdrawalStatus", dashboardOverviewQuery.withdrawalStatus);
    }
    if (dashboardOverviewQuery.auditAction) {
      streamUrl.searchParams.set("auditAction", dashboardOverviewQuery.auditAction);
    }
    streamUrl.searchParams.set("intervalMs", "5000");

    setStreamState("connecting");
    setStreamRetryAttempt(0);
    setStreamRetryDelayMs(null);

    void streamSseWithBackoff({
      url: streamUrl.toString(),
      signal: controller.signal,
      headers: (): Record<string, string> => {
        const token = getAdminSession()?.tokens?.accessToken;
        if (!token) {
          return {};
        }
        return { Authorization: `Bearer ${token}` };
      },
      onOpen: () => {
        setStreamState("connected");
        setStreamRetryAttempt(0);
        setStreamRetryDelayMs(null);
        setStreamEventKind(null);
        setStreamDiffMessage(null);
      },
      onData: (raw) => {
        try {
          const parsed = JSON.parse(raw) as DashboardStreamEnvelope;
          if (parsed.eventVersion !== 2) {
            setErrorMessage(t("dashboard.errorStreamVersion"));
            return;
          }
          const eventKind = parseDashboardStreamEventKind(parsed.eventType);
          if (!eventKind) {
            setErrorMessage(t("dashboard.errorStreamEventType"));
            return;
          }
          setStreamEventKind(eventKind);
          if (eventKind === "error") {
            const dataRecord = isRecord(parsed.data as unknown)
              ? (parsed.data as Record<string, unknown>)
              : null;
            const messageFromStream =
              dataRecord && typeof dataRecord["message"] === "string"
                ? (dataRecord["message"] as string)
                : null;
            const message =
              messageFromStream ?? t("dashboard.errorStreamFailed");
            setErrorMessage(message);
            setStreamDiffMessage(null);
            return;
          }
          if (!parsed.data || !isRecord(parsed.data)) {
            return;
          }
          applyDashboardPayload(parsed.data as DashboardOverviewResponse);
          const changedSections = [
            parsed.diff?.sectionChanges?.orders ? "orders" : null,
            parsed.diff?.sectionChanges?.withdrawals ? "withdrawals" : null,
            parsed.diff?.sectionChanges?.auditLogs ? "audit" : null
          ].filter((item): item is string => Boolean(item));
          if (parsed.diff?.changed && changedSections.length > 0) {
            const deltas = parsed.diff.summaryDelta;
            const deltaSummary = deltas
              ? [
                  `open ${deltas.openOrdersLoaded ?? 0}`,
                  `pending ${deltas.pendingWithdrawalsLoaded ?? 0}`,
                  `risk ${deltas.riskAlertsLoaded ?? 0}`
                ].join(", ")
              : "";
            setStreamDiffMessage(
              `Changed: ${changedSections.join(", ")}${deltaSummary ? ` (${deltaSummary})` : ""}`
            );
          } else {
            setStreamDiffMessage(null);
          }
          if (parsed.diff?.sectionChanges?.orders) {
            setOrdersHighlightTick((previous) => previous + 1);
          }
          if (parsed.diff?.sectionChanges?.withdrawals) {
            setWithdrawalsHighlightTick((previous) => previous + 1);
          }
          if (parsed.diff?.sectionChanges?.auditLogs) {
            setAuditHighlightTick((previous) => previous + 1);
          }
          setRefreshFailures(0);
          setNextRefreshMs(DASHBOARD_REFRESH_MS);
        } catch {
          setStreamEventKind("error");
          setErrorMessage(t("dashboard.errorStreamPayload"));
        }
      },
      onRetry: ({ attempt, delayMs }) => {
        setStreamState("reconnecting");
        setStreamRetryAttempt(attempt);
        setStreamRetryDelayMs(delayMs);
      }
    });

    return () => {
      controller.abort();
    };
  }, [applyDashboardPayload, dashboardOverviewQuery]);

  useEffect(() => {
    if (!autoRefresh || streamState === "connected" || streamState === "connecting") {
      return;
    }

    let isActive = true;
    let timerId: number | undefined;
    let failures = 0;

    const schedule = (delayMs: number) => {
      setNextRefreshMs(delayMs);
      timerId = window.setTimeout(async () => {
        const ok = await loadDashboard({ background: true }).catch(() => false);
        if (!isActive) {
          return;
        }

        if (ok) {
          failures = 0;
          setRefreshFailures(0);
        } else {
          failures = Math.min(failures + 1, 6);
          setRefreshFailures(failures);
          setErrorMessage(t("dashboard.errorRefreshFailed"));
        }

        const nextDelay = Math.min(
          DASHBOARD_REFRESH_MS * 2 ** failures,
          DASHBOARD_MAX_BACKOFF_MS
        );
        schedule(nextDelay);
      }, delayMs);
    };

    failures = 0;
    setRefreshFailures(0);
    schedule(DASHBOARD_REFRESH_MS);

    return () => {
      isActive = false;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [autoRefresh, loadDashboard, streamState]);

  const openOrdersCount = useMemo(
    () => orders.filter((item) => item.status === "NEW" || item.status === "PARTIALLY_FILLED").length,
    [orders]
  );
  const pendingWithdrawalsCount = useMemo(
    () =>
      withdrawals.filter((item) =>
        ["REQUESTED", "REVIEW_PENDING", "APPROVED", "BROADCASTED"].includes(item.status)
      ).length,
    [withdrawals]
  );
  const riskAlertsCount = useMemo(
    () => withdrawals.filter((item) => item.status === "FAILED" || item.status === "REJECTED").length,
    [withdrawals]
  );
  const adminActionsCount = useMemo(() => auditLogs.length, [auditLogs]);
  const permissionChangesCount = useMemo(
    () => auditLogs.filter((item) => item.action === "ADMIN_PERMISSIONS_UPDATED").length,
    [auditLogs]
  );
  const detailJson = useMemo(() => {
    if (!detailModal) {
      return "";
    }
    return JSON.stringify(detailModal.payload, null, 2);
  }, [detailModal]);
  const filteredOrders = useMemo(() => {
    const statusFilter = orderStatusFilter.trim().toUpperCase();
    const symbolFilter = orderSymbolFilter.trim().toUpperCase();

    return orders.filter((item) => {
      const matchesStatus = !statusFilter || item.status.toUpperCase().includes(statusFilter);
      const matchesSymbol = !symbolFilter || item.symbol.toUpperCase().includes(symbolFilter);
      return matchesStatus && matchesSymbol;
    });
  }, [orderStatusFilter, orderSymbolFilter, orders]);
  const filteredWithdrawals = useMemo(() => {
    const statusFilter = withdrawalStatusFilter.trim().toUpperCase();
    if (!statusFilter) {
      return withdrawals;
    }

    return withdrawals.filter((item) => item.status.toUpperCase().includes(statusFilter));
  }, [withdrawalStatusFilter, withdrawals]);
  const filteredAuditLogs = useMemo(() => {
    const actionFilter = auditActionFilter.trim().toUpperCase();
    if (!actionFilter) {
      return auditLogs;
    }

    return auditLogs.filter((item) => (item.action ?? "").toUpperCase().includes(actionFilter));
  }, [auditActionFilter, auditLogs]);
  const currentSharePayload = useMemo(
    () =>
      toDashboardSharePayloadFromFilters({
        orderStatus: orderStatusFilter,
        orderSymbol: orderSymbolFilter,
        withdrawalStatus: withdrawalStatusFilter,
        auditAction: auditActionFilter,
        presetSlot: selectedPresetSlot
      }),
    [
      auditActionFilter,
      orderStatusFilter,
      orderSymbolFilter,
      selectedPresetSlot,
      withdrawalStatusFilter
    ]
  );
  const canCreateShareLink = useMemo(
    () => hasDashboardSharePayload(currentSharePayload),
    [currentSharePayload]
  );
  const selectedShareExpiryLabel = useMemo(() => {
    const matched = DASHBOARD_SHARE_EXPIRY_OPTIONS.find(
      (option) => option.minutes === selectedShareExpiryMinutes
    );
    return matched?.label ?? `${selectedShareExpiryMinutes}m`;
  }, [selectedShareExpiryMinutes]);
  const selectedShareExpiryDateLabel = useMemo(
    () => new Date(Date.now() + selectedShareExpiryMinutes * 60_000).toLocaleString(),
    [selectedShareExpiryMinutes]
  );
  const copyModalJson = useCallback(async () => {
    if (!detailJson) {
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(detailJson);
        setCopyFeedbackTone("success");
        setCopyFeedback(t("dashboard.copiedJson"));
        return;
      }

      setCopyFeedbackTone("error");
      setCopyFeedback(t("dashboard.clipboardUnavailable"));
    } catch {
      setCopyFeedbackTone("error");
      setCopyFeedback(t("dashboard.copyFailed"));
    }
  }, [detailJson]);
  const readPresetCollection = useCallback((): DashboardFilterPresetCollection => {
    if (typeof window === "undefined") {
      return {};
    }

    const raw = window.localStorage.getItem(DASHBOARD_FILTER_PRESET_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return toPresetCollection(parsed);
  }, []);
  const saveFilterPreset = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: DashboardFilterPreset = {
      orderStatus: orderStatusFilter.trim(),
      orderSymbol: orderSymbolFilter.trim(),
      withdrawalStatus: withdrawalStatusFilter.trim(),
      auditAction: auditActionFilter.trim()
    };

    try {
      const collection = readPresetCollection();
      collection[selectedPresetSlot] = payload;
      window.localStorage.setItem(DASHBOARD_FILTER_PRESET_KEY, JSON.stringify(collection));
      setPresetMessageTone("success");
      setPresetMessage(`Preset "${selectedPresetSlot}" saved`);
    } catch {
      setPresetMessageTone("error");
      setPresetMessage(t("dashboard.presetSaveFailed"));
    }
  }, [
    auditActionFilter,
    orderStatusFilter,
    orderSymbolFilter,
    readPresetCollection,
    selectedPresetSlot,
    withdrawalStatusFilter
  ]);
  const loadFilterPreset = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const collection = readPresetCollection();
      const selectedPreset = collection[selectedPresetSlot];
      if (!selectedPreset) {
        setPresetMessageTone("error");
        setPresetMessage(`No saved preset for "${selectedPresetSlot}"`);
        return;
      }

      setOrderStatusFilter(selectedPreset.orderStatus ?? "");
      setOrderSymbolFilter(selectedPreset.orderSymbol ?? "");
      setWithdrawalStatusFilter(selectedPreset.withdrawalStatus ?? "");
      setAuditActionFilter(selectedPreset.auditAction ?? "");
      setPresetMessageTone("success");
      setPresetMessage(`Preset "${selectedPresetSlot}" loaded`);
    } catch {
      setPresetMessageTone("error");
      setPresetMessage(t("dashboard.presetLoadFailed"));
    }
  }, [readPresetCollection, selectedPresetSlot]);
  const clearFilterPreset = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const collection = readPresetCollection();
      if (collection[selectedPresetSlot]) {
        delete collection[selectedPresetSlot];
        window.localStorage.setItem(DASHBOARD_FILTER_PRESET_KEY, JSON.stringify(collection));
      }
    } catch {
      setPresetMessageTone("error");
      setPresetMessage(t("dashboard.presetClearFailed"));
      return;
    }

    setOrderStatusFilter("");
    setOrderSymbolFilter("");
    setWithdrawalStatusFilter("");
    setAuditActionFilter("");
    setPresetMessageTone("success");
    setPresetMessage(`Preset "${selectedPresetSlot}" cleared and filters reset`);
  }, [readPresetCollection, selectedPresetSlot]);
  const copyDashboardShareUrl = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!canCreateShareLink) {
      setShareMessageTone("error");
      setShareMessage(t("dashboard.shareNeedFilter"));
      return;
    }

    setShareCreateInFlight(true);
    try {
      let created: DashboardShareLinkCreateResponse | null = null;
      try {
        const response = await api.POST("/admin/dashboard/share-links", {
          body: {
            ...currentSharePayload,
            expiresInMinutes: selectedShareExpiryMinutes
          }
        });
        if (!response.data) {
          setShareMessageTone("error");
          setShareMessage(t("dashboard.shareCreateFailed"));
          return;
        }
        created = response.data as DashboardShareLinkCreateResponse;
      } catch {
        setShareMessageTone("error");
        setShareMessage(t("dashboard.shareCreateFailed"));
        return;
      }

      if (!created) {
        setShareMessageTone("error");
        setShareMessage(t("dashboard.shareCreateFailed"));
        return;
      }

      const shareCode = normalizeFilterValue(created.shareCode);
      if (!shareCode) {
        setShareMessageTone("error");
        setShareMessage(t("dashboard.shareCodeMissing"));
        return;
      }

      const shareUrl = new URL(window.location.href);
      shareUrl.pathname = location.pathname;
      shareUrl.search = "";
      shareUrl.searchParams.set("share", shareCode);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl.toString());
        const expiresLabel = created.expiresAt
          ? ` (expires ${new Date(created.expiresAt).toLocaleString()})`
          : "";
        setShareMessageTone("success");
        setShareMessage(`Dashboard share URL copied${expiresLabel}`);
        return;
      }

      setShareMessageTone("success");
      setShareMessage(`Clipboard unavailable. Share URL: ${shareUrl.toString()}`);
    } finally {
      setShareCreateInFlight(false);
    }
  }, [
    canCreateShareLink,
    currentSharePayload,
    location.pathname,
    selectedShareExpiryMinutes
  ]);

  return (
    <main>
      <h2>Operations Dashboard</h2>
      <p className="muted">실시간 운영 지표와 리스크 이벤트 요약</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button
          className="admin-btn"
          onClick={() => {
            void loadDashboard();
          }}
          type="button"
        >
          {loading ? "Loading..." : t("dashboard.refreshNow")}
        </button>
        <button
          className="admin-btn secondary"
          onClick={() => {
            setAutoRefresh((prev) => !prev);
          }}
          type="button"
        >
          {autoRefresh ? `Auto Refresh: ON (${Math.round(nextRefreshMs / 1000)}s)` : "Auto Refresh: OFF"}
        </button>
        <span className="muted" style={{ marginTop: 0 }}>
          Stream:{" "}
          {streamState === "connected"
            ? t("dashboard.streamLive")
            : streamState === "connecting"
              ? t("dashboard.streamConnecting")
              : streamState === "reconnecting"
                ? t("dashboard.streamReconnecting")
                : t("dashboard.streamError")}
        </span>
        {streamEventKind ? (
          <span className={`admin-stream-event-badge ${streamEventKind}`}>
            Event: {streamEventKind.toUpperCase()}
          </span>
        ) : null}
        {streamState === "reconnecting" && streamRetryDelayMs ? (
          <span className="muted" style={{ marginTop: 0 }}>
            Stream retry #{streamRetryAttempt} in {Math.round(streamRetryDelayMs / 1000)}s
          </span>
        ) : null}
        {streamDiffMessage ? (
          <span className="muted" style={{ marginTop: 0 }}>
            {streamDiffMessage}
          </span>
        ) : null}
        {refreshFailures > 0 ? (
          <span className="muted" style={{ marginTop: 0 }}>
            Retry backoff x{refreshFailures}
          </span>
        ) : null}
        <span className="muted" style={{ marginTop: 0 }}>
          Last update: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "-"}
        </span>
      </div>
      {errorMessage ? <div className="admin-feedback error">{errorMessage}</div> : null}
      <div className="stats-grid">
        <article className="stat-card">
          <p>Open Orders (loaded)</p>
          <strong>{openOrdersCount}</strong>
        </article>
        <article className="stat-card">
          <p>Pending Withdrawals (loaded)</p>
          <strong>{pendingWithdrawalsCount}</strong>
        </article>
        <article className="stat-card">
          <p>Risk Alerts (loaded)</p>
          <strong>{riskAlertsCount}</strong>
        </article>
        <article className="stat-card">
          <p>Admin Actions (loaded)</p>
          <strong>{adminActionsCount}</strong>
        </article>
        <article className="stat-card">
          <p>Permission Changes (loaded)</p>
          <strong>{permissionChangesCount}</strong>
        </article>
      </div>
      <div className="table-card" style={{ marginTop: 16, padding: 14 }}>
        <h3>Dashboard Filters</h3>
        <div className="admin-form-grid">
          <input
            value={orderStatusFilter}
            onChange={(event) => {
              setOrderStatusFilter(event.target.value);
            }}
            placeholder={t("dashboard.orderStatusPlaceholder")}
          />
          <input
            value={orderSymbolFilter}
            onChange={(event) => {
              setOrderSymbolFilter(event.target.value);
            }}
            placeholder={t("dashboard.orderSymbolPlaceholder")}
          />
          <input
            value={withdrawalStatusFilter}
            onChange={(event) => {
              setWithdrawalStatusFilter(event.target.value);
            }}
            placeholder={t("dashboard.withdrawalStatusPlaceholder")}
          />
          <input
            value={auditActionFilter}
            onChange={(event) => {
              setAuditActionFilter(event.target.value);
            }}
            placeholder={t("dashboard.auditActionPlaceholder")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label className="muted" htmlFor="dashboard-preset-slot" style={{ marginTop: 0 }}>
            Preset Slot
          </label>
          <select
            id="dashboard-preset-slot"
            value={selectedPresetSlot}
            onChange={(event) => {
              setSelectedPresetSlot(event.target.value as DashboardPresetSlot);
            }}
          >
            {DASHBOARD_PRESET_SLOTS.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </select>
          <button className="admin-btn secondary" onClick={saveFilterPreset} type="button">
            Save Preset
          </button>
          <button className="admin-btn secondary" onClick={loadFilterPreset} type="button">
            Load Preset
          </button>
          <button className="admin-btn secondary" onClick={clearFilterPreset} type="button">
            Clear
          </button>
          <label className="muted" htmlFor="dashboard-share-expiry" style={{ marginTop: 0 }}>
            Link Expiry
          </label>
          <select
            id="dashboard-share-expiry"
            value={String(selectedShareExpiryMinutes)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) {
                setSelectedShareExpiryMinutes(next);
              }
            }}
          >
            {DASHBOARD_SHARE_EXPIRY_OPTIONS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
          <span
            className="admin-share-expiry-badge"
            title={`Approximate link expiry time: ${selectedShareExpiryDateLabel}`}
          >
            TTL {selectedShareExpiryLabel}
          </span>
          <button
            className="admin-btn secondary"
            onClick={() => void copyDashboardShareUrl()}
            type="button"
            disabled={shareResolveInFlight || shareCreateInFlight || !canCreateShareLink}
          >
            {shareCreateInFlight
              ? t("dashboard.creatingShare")
              : shareResolveInFlight
                ? t("dashboard.resolvingShare")
                : t("dashboard.copyShareUrl")}
          </button>
          {!canCreateShareLink ? (
            <span className="muted" style={{ marginTop: 0 }}>
              Add filter/preset to enable share
            </span>
          ) : null}
          {filtersDebouncing ? (
            <span className="muted" style={{ marginTop: 0 }}>
              Applying filter changes...
            </span>
          ) : null}
        </div>
        {presetMessage ? <div className={`admin-feedback ${presetMessageTone}`}>{presetMessage}</div> : null}
        {shareMessage ? <div className={`admin-feedback ${shareMessageTone}`}>{shareMessage}</div> : null}
      </div>
      <div
        className={`table-card ${
          ordersHighlightTick > 0 ? `table-card-highlight-${ordersHighlightTick % 2}` : ""
        }`}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ margin: 0, padding: "12px 14px 0 14px" }}>
          Recent Orders ({filteredOrders.length})
        </h3>
        {ordersSectionMessage ? (
          <p
            className={`admin-section-note ${getSectionNoteTone(ordersSectionCode ?? undefined)}`}
            style={{ padding: "4px 14px 0 14px", marginTop: 0 }}
          >
            {ordersSectionMessage}
          </p>
        ) : null}
        <div className="table-row table-head">
          <span>Time (UTC)</span>
          <span>User</span>
          <span>Order</span>
          <span>Status</span>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>No order data</span>
            <span>-</span>
          </div>
        ) : (
          filteredOrders.map((item) => (
            <div className="table-row" key={item.orderId}>
              <span>{item.createdAt}</span>
              <span>{item.email}</span>
              <span>
                {item.symbol} {item.side} {item.quantity}
              </span>
              <span>
                {item.status}
                <button
                  className="admin-btn secondary"
                  style={{ marginLeft: 8, marginTop: 0 }}
                  onClick={() => {
                    setCopyFeedback(null);
                    setDetailModal({
                      kind: "ORDER",
                      title: `Order ${item.orderId}`,
                      payload: item
                    });
                  }}
                  type="button"
                >
                  View
                </button>
              </span>
            </div>
          ))
        )}
      </div>
      <div
        className={`table-card ${
          withdrawalsHighlightTick > 0 ? `table-card-highlight-${withdrawalsHighlightTick % 2}` : ""
        }`}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ margin: 0, padding: "12px 14px 0 14px" }}>
          Recent Withdrawals ({filteredWithdrawals.length})
        </h3>
        {withdrawalsSectionMessage ? (
          <p
            className={`admin-section-note ${getSectionNoteTone(withdrawalsSectionCode ?? undefined)}`}
            style={{ padding: "4px 14px 0 14px", marginTop: 0 }}
          >
            {withdrawalsSectionMessage}
          </p>
        ) : null}
        <div className="table-row table-head">
          <span>Time (UTC)</span>
          <span>User</span>
          <span>Withdrawal</span>
          <span>Status</span>
        </div>
        {filteredWithdrawals.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>No withdrawal data</span>
            <span>-</span>
          </div>
        ) : (
          filteredWithdrawals.map((item) => (
            <div className="table-row" key={item.withdrawalId}>
              <span>{item.requestedAt}</span>
              <span>{item.email}</span>
              <span>
                {item.asset} {item.amount} ({item.network})
              </span>
              <span>
                {item.status}
                <button
                  className="admin-btn secondary"
                  style={{ marginLeft: 8, marginTop: 0 }}
                  onClick={() => {
                    setCopyFeedback(null);
                    setDetailModal({
                      kind: "WITHDRAWAL",
                      title: `Withdrawal ${item.withdrawalId}`,
                      payload: item
                    });
                  }}
                  type="button"
                >
                  View
                </button>
              </span>
            </div>
          ))
        )}
      </div>
      <div
        className={`table-card ${
          auditHighlightTick > 0 ? `table-card-highlight-${auditHighlightTick % 2}` : ""
        }`}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ margin: 0, padding: "12px 14px 0 14px" }}>
          Recent Audit Logs ({filteredAuditLogs.length})
        </h3>
        {auditSectionMessage ? (
          <p
            className={`admin-section-note ${getSectionNoteTone(auditSectionCode ?? undefined)}`}
            style={{ padding: "4px 14px 0 14px", marginTop: 0 }}
          >
            {auditSectionMessage}
          </p>
        ) : null}
        <div className="table-row table-head">
          <span>Time (UTC)</span>
          <span>Actor</span>
          <span>Action</span>
          <span>Target</span>
        </div>
        {filteredAuditLogs.length === 0 ? (
          <div className="table-row">
            <span>-</span>
            <span>-</span>
            <span>No audit data</span>
            <span>-</span>
          </div>
        ) : (
          filteredAuditLogs.map((item) => (
            <div className="table-row" key={item.id}>
              <span>{item.createdAt ?? "-"}</span>
              <span>{item.actorEmail ?? "-"}</span>
              <span>{item.action ?? "-"}</span>
              <span>
                {(item.targetType ?? "-")}:{item.targetId ?? "-"}
                <button
                  className="admin-btn secondary"
                  style={{ marginLeft: 8, marginTop: 0 }}
                  onClick={() => {
                    setCopyFeedback(null);
                    setDetailModal({
                      kind: "AUDIT",
                      title: `Audit ${item.id}`,
                      payload: item
                    });
                  }}
                  type="button"
                >
                  View
                </button>
              </span>
            </div>
          ))
        )}
      </div>
      {detailModal ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{detailModal.title}</h3>
            <p className="muted">Type: {detailModal.kind}</p>
            <pre className="admin-pre" style={{ marginTop: 12, maxHeight: 360 }}>
              {detailJson}
            </pre>
            {copyFeedback ? <div className={`admin-feedback ${copyFeedbackTone}`}>{copyFeedback}</div> : null}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => void copyModalJson()} type="button">
                Copy JSON
              </button>
              <button
                className="admin-btn secondary"
                onClick={() => {
                  setCopyFeedback(null);
                  setDetailModal(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
