import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type {
  TickerRow,
  OrderbookPayload,
  CandleRow,
} from "../types/market";
import { parseApiError } from "../utils/formatters";

const TICKER_POLL_MS = 15_000;
const MARKET_POLL_MS = 15_000;

export function useMarketData(selectedSymbol: string) {
  const [tickers, setTickers] = useState<TickerRow[]>([]);
  const [orderbook, setOrderbook] = useState<OrderbookPayload | null>(null);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [marketMessage, setMarketMessage] = useState("");

  const loadTickers = useCallback(async () => {
    const { data, error } = await api.GET("/market/tickers", {
      params: { query: { limit: 3 } },
    });

    if (error || !data) {
      setTickers([]);
      return;
    }

    setTickers(Array.isArray(data) ? (data as TickerRow[]) : []);
  }, []);

  const loadMarketSnapshot = useCallback(async () => {
    const [orderbookRes, candlesRes] = await Promise.all([
      api.GET("/market/orderbook/{symbol}", {
        params: {
          path: { symbol: selectedSymbol },
          query: { limit: 6 },
        },
      }),
      api.GET("/market/candles", {
        params: {
          query: {
            symbol: selectedSymbol,
            interval: "1m",
            limit: 20,
          },
        },
      }),
    ]);

    if (
      orderbookRes.error ||
      !orderbookRes.data ||
      candlesRes.error ||
      !candlesRes.data
    ) {
      setOrderbook(null);
      setCandles([]);
      setMarketMessage(
        parseApiError(
          orderbookRes.error ?? candlesRes.error,
          "Failed to load market snapshot",
        ),
      );
      return;
    }

    setOrderbook(orderbookRes.data as OrderbookPayload);
    setCandles(
      Array.isArray(candlesRes.data) ? (candlesRes.data as CandleRow[]) : [],
    );
    setMarketMessage("");
  }, [selectedSymbol]);

  // Initial ticker load
  useEffect(() => {
    loadTickers().catch(() => setTickers([]));
  }, [loadTickers]);

  // Ticker polling
  useEffect(() => {
    const timerId = setInterval(() => {
      loadTickers().catch(() => setTickers([]));
    }, TICKER_POLL_MS);
    return () => clearInterval(timerId);
  }, [loadTickers]);

  // Market snapshot on symbol change
  useEffect(() => {
    setMarketMessage("");
    loadMarketSnapshot().catch(() => {
      setMarketMessage("Failed to load market snapshot");
      setOrderbook(null);
      setCandles([]);
    });
  }, [loadMarketSnapshot]);

  // Market snapshot polling
  useEffect(() => {
    const timerId = setInterval(() => {
      loadMarketSnapshot().catch(() => {
        setMarketMessage("Failed to refresh market snapshot");
      });
    }, MARKET_POLL_MS);
    return () => clearInterval(timerId);
  }, [loadMarketSnapshot]);

  const latestCandle = useMemo(
    () => candles[candles.length - 1] ?? null,
    [candles],
  );

  return {
    tickers,
    orderbook,
    candles,
    latestCandle,
    marketMessage,
    loadMarketSnapshot,
  };
}
