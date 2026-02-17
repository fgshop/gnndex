import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { apiBaseUrl } from "../services/api";
import { getMobileSession } from "../store/auth-storage";
import { streamSseWithBackoff, type SseRetryInfo } from "../utils/sse-stream";
import {
  parseApiError,
  parseOrdersStreamEvent,
  tabStatuses,
  toIsoOrUndefined,
} from "../utils/formatters";
import type {
  OrderRow,
  OrdersListPayload,
  OrderViewTab,
  OrderSortOption,
  OrderStatusFilter,
} from "../types/market";
import { ORDER_PAGE_SIZE } from "../types/market";

const POLL_INTERVAL_MS = 15_000;

export type OrderFilters = {
  orderViewTab: OrderViewTab;
  orderSymbolFilter: string;
  orderStatusFilter: OrderStatusFilter;
  orderSort: OrderSortOption;
  orderFromCreatedAt: string;
  orderToCreatedAt: string;
};

export function useOrders(isAuthenticated: boolean, filters: OrderFilters) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamRetryInfo, setStreamRetryInfo] = useState<SseRetryInfo | null>(
    null,
  );

  const {
    orderViewTab,
    orderSymbolFilter,
    orderStatusFilter,
    orderSort,
    orderFromCreatedAt,
    orderToCreatedAt,
  } = filters;

  const buildQuery = useCallback(
    (page: number) => ({
      page,
      limit: ORDER_PAGE_SIZE,
      symbol: orderSymbolFilter !== "ALL" ? orderSymbolFilter : undefined,
      status: orderStatusFilter !== "ALL" ? orderStatusFilter : undefined,
      statuses: tabStatuses(orderViewTab),
      fromCreatedAt: toIsoOrUndefined(orderFromCreatedAt),
      toCreatedAt: toIsoOrUndefined(orderToCreatedAt),
      sortBy: "CREATED_AT" as const,
      sortOrder:
        orderSort === "NEWEST" ? ("DESC" as const) : ("ASC" as const),
    }),
    [
      orderSymbolFilter,
      orderStatusFilter,
      orderViewTab,
      orderFromCreatedAt,
      orderToCreatedAt,
      orderSort,
    ],
  );

  const loadOrders = useCallback(
    async (options?: { page?: number }) => {
      if (!isAuthenticated) {
        setOrders([]);
        setOrdersPage(1);
        setOrdersTotal(0);
        return;
      }

      const targetPage = options?.page ?? ordersPage;
      if (targetPage < 1) return;

      const query = buildQuery(targetPage);
      setOrdersLoading(true);

      const { data, error } = await api.GET("/orders", {
        params: { query },
      });
      setOrdersLoading(false);

      if (error || !data) {
        setOrderMessage(parseApiError(error, "Failed to load orders"));
        if (targetPage === 1) {
          setOrders([]);
          setOrdersPage(1);
          setOrdersTotal(0);
        }
        return;
      }

      const payload = data as OrderRow[] | OrdersListPayload;
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
          ? payload.items
          : [];

      setOrders(items);
      setOrdersPage(targetPage);
      setOrdersTotal(
        Array.isArray(payload)
          ? items.length
          : (payload.total ?? items.length),
      );
    },
    [isAuthenticated, ordersPage, buildQuery],
  );

  // Reset on auth change
  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setOrdersPage(1);
      setOrdersTotal(0);
      setStreamConnected(false);
      setStreamRetryInfo(null);
      return;
    }
  }, [isAuthenticated]);

  // Load orders on filter change
  useEffect(() => {
    if (!isAuthenticated) return;
    loadOrders({ page: 1 }).catch(() => {
      setOrderMessage("Failed to reload filtered orders");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    orderSymbolFilter,
    orderStatusFilter,
    orderViewTab,
    orderFromCreatedAt,
    orderToCreatedAt,
    orderSort,
  ]);

  // SSE stream for orders
  useEffect(() => {
    if (!isAuthenticated) {
      setStreamConnected(false);
      setStreamRetryInfo(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    async function startStream() {
      const accessToken = (await getMobileSession())?.tokens?.accessToken;
      if (!accessToken) {
        setStreamConnected(false);
        setStreamRetryInfo(null);
        return;
      }

      const query = buildQuery(ordersPage);
      const parts: string[] = [];
      for (const [key, value] of Object.entries({
        ...query,
        intervalMs: 5000,
      })) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            parts.push(
              `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
            );
          }
          continue;
        }
        parts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
        );
      }

      try {
        const streamUrl = `${apiBaseUrl}/orders/stream${parts.length > 0 ? `?${parts.join("&")}` : ""}`;
        await streamSseWithBackoff({
          url: streamUrl,
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
          onOpen: () => {
            if (!isActive) return;
            setStreamConnected(true);
            setStreamRetryInfo(null);
          },
          onData: (rawData) => {
            if (!isActive) return;
            const payload = parseOrdersStreamEvent(rawData);
            if (!payload) return;

            if (payload.eventType === "user.orders.error") {
              const errorData = payload.data as { message?: string };
              setOrderMessage(
                typeof errorData.message === "string"
                  ? errorData.message
                  : "Orders stream error",
              );
              return;
            }

            const data = payload.data as OrdersListPayload;
            if (Array.isArray(data.items)) {
              setOrders(data.items);
              setOrdersPage(data.page ?? ordersPage);
              setOrdersTotal(data.total ?? data.items.length);
              setOrdersLoading(false);
            }
          },
          onRetry: (info) => {
            if (!isActive) return;
            setStreamConnected(false);
            setStreamRetryInfo(info);
          },
        });
      } catch {
        if (isActive) setStreamConnected(false);
      } finally {
        if (isActive) setStreamConnected(false);
      }
    }

    void startStream();

    return () => {
      isActive = false;
      controller.abort();
      setStreamConnected(false);
      setStreamRetryInfo(null);
    };
  }, [
    isAuthenticated,
    orderSymbolFilter,
    orderStatusFilter,
    orderViewTab,
    orderFromCreatedAt,
    orderToCreatedAt,
    ordersPage,
    orderSort,
    buildQuery,
  ]);

  // Polling fallback
  useEffect(() => {
    if (!isAuthenticated || streamConnected) return;

    const timerId = setInterval(() => {
      loadOrders({ page: ordersPage }).catch(() => {
        setOrderMessage("Failed to refresh orders");
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timerId);
  }, [isAuthenticated, streamConnected, loadOrders, ordersPage]);

  const openOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "NEW" || o.status === "PARTIALLY_FILLED",
      ).length,
    [orders],
  );

  const historyOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "FILLED" ||
          o.status === "CANCELED" ||
          o.status === "REJECTED" ||
          o.status === "NOT_FOUND",
      ).length,
    [orders],
  );

  const visibleOrders = useMemo(() => {
    const filteredByTab = orders.filter((item) => {
      if (orderViewTab === "OPEN") {
        return item.status === "NEW" || item.status === "PARTIALLY_FILLED";
      }
      if (orderViewTab === "HISTORY") {
        return (
          item.status === "FILLED" ||
          item.status === "CANCELED" ||
          item.status === "REJECTED" ||
          item.status === "NOT_FOUND"
        );
      }
      return true;
    });

    const filteredBySymbol =
      orderSymbolFilter === "ALL"
        ? filteredByTab
        : filteredByTab.filter((item) => item.symbol === orderSymbolFilter);

    return orderStatusFilter === "ALL"
      ? filteredBySymbol
      : filteredBySymbol.filter(
          (item) => item.status === orderStatusFilter,
        );
  }, [orders, orderStatusFilter, orderSymbolFilter, orderViewTab]);

  const totalPages = Math.max(
    1,
    Math.ceil(Math.max(ordersTotal, 0) / ORDER_PAGE_SIZE),
  );
  const canPrevPage = ordersPage > 1;
  const canNextPage = ordersPage < totalPages;

  return {
    orders,
    visibleOrders,
    ordersPage,
    ordersTotal,
    ordersLoading,
    orderMessage,
    setOrderMessage,
    streamConnected,
    streamRetryInfo,
    openOrdersCount,
    historyOrdersCount,
    totalPages,
    canPrevPage,
    canNextPage,
    loadOrders,
  };
}
