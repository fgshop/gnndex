import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { apiBaseUrl } from "../services/api";
import { getMobileSession } from "../store/auth-storage";
import { streamSseWithBackoff, type SseRetryInfo } from "../utils/sse-stream";
import { parseBalancesStreamEvent } from "../utils/formatters";
import type { BalanceRow } from "../types/market";

const POLL_INTERVAL_MS = 15_000;

export function useBalancesStream(isAuthenticated: boolean) {
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [retryInfo, setRetryInfo] = useState<SseRetryInfo | null>(null);
  const [message, setMessage] = useState("Sign in to load balances.");
  const [loading, setLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    const { data, error } = await api.GET("/wallet/balances");

    if (error || !data) {
      setMessage("Failed to load balances from API");
      setBalances([]);
      return;
    }

    setMessage("Connected to backend API");
    setBalances(Array.isArray(data) ? (data as BalanceRow[]) : []);
  }, []);

  // Initial load on auth
  useEffect(() => {
    if (!isAuthenticated) {
      setBalances([]);
      setConnected(false);
      setRetryInfo(null);
      return;
    }

    setLoading(true);
    loadBalances()
      .catch(() => setMessage("Failed to load authenticated data"))
      .finally(() => setLoading(false));
  }, [isAuthenticated, loadBalances]);

  // SSE stream
  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      setRetryInfo(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    async function startStream() {
      const accessToken = (await getMobileSession())?.tokens?.accessToken;
      if (!accessToken) {
        setConnected(false);
        setRetryInfo(null);
        return;
      }

      try {
        const streamUrl = `${apiBaseUrl}/wallet/stream/balances?intervalMs=5000`;
        await streamSseWithBackoff({
          url: streamUrl,
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
          onOpen: () => {
            if (!isActive) return;
            setConnected(true);
            setRetryInfo(null);
          },
          onData: (rawData) => {
            if (!isActive) return;
            const payload = parseBalancesStreamEvent(rawData);
            if (!payload) return;

            if (payload.eventType === "user.balances.error") {
              const errorData = payload.data as { message?: string };
              setMessage(
                typeof errorData.message === "string"
                  ? errorData.message
                  : "Balances stream error",
              );
              return;
            }

            const balancesData = payload.data as BalanceRow[];
            if (Array.isArray(balancesData)) {
              setBalances(balancesData);
            }
          },
          onRetry: (info) => {
            if (!isActive) return;
            setConnected(false);
            setRetryInfo(info);
          },
        });
      } catch {
        if (isActive) setConnected(false);
      } finally {
        if (isActive) setConnected(false);
      }
    }

    void startStream();

    return () => {
      isActive = false;
      controller.abort();
      setConnected(false);
      setRetryInfo(null);
    };
  }, [isAuthenticated]);

  // Polling fallback
  useEffect(() => {
    if (!isAuthenticated || connected) return;

    const timerId = setInterval(() => {
      loadBalances().catch(() => {
        setMessage("Failed to refresh balances");
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timerId);
  }, [isAuthenticated, connected, loadBalances]);

  return { balances, connected, retryInfo, message, loading, loadBalances };
}
