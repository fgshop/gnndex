"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/api";

function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase();
}

function toTradingViewSymbol(input: string): string {
  const normalized = normalizeSymbol(input);
  const compact = normalized.replaceAll("-", "");
  return `BINANCE:${compact}`;
}

type CandleFrame = "1" | "3" | "5" | "15" | "30" | "60" | "240" | "1440";
const FRAME_OPTIONS: Array<{ value: CandleFrame; label: string }> = [
  { value: "1", label: "1m" },
  { value: "3", label: "3m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "1440", label: "1d" }
];

type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
const INTERNAL_INTERVAL_MAP: Record<CandleFrame, CandleInterval> = {
  "1": "1m",
  "3": "5m",
  "5": "5m",
  "15": "15m",
  "30": "15m",
  "60": "1h",
  "240": "4h",
  "1440": "1d"
};
const INTERNAL_LIMIT_MAP: Record<CandleFrame, number> = {
  "1": 180,
  "3": 160,
  "5": 160,
  "15": 150,
  "30": 130,
  "60": 120,
  "240": 100,
  "1440": 90
};

const INTERNAL_DB_SYMBOL_FALLBACK = new Set(["SBK-USDT", "G99-USDT"]);

type ListedCoinRow = {
  symbol: string;
  chartSource?: string;
};

type ApiCandleRow = {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

type ParsedCandle = {
  openTimeMs: number;
  closeTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TradingViewChartProps = {
  symbol: string;
};

const unsafeApi = api as unknown as {
  GET: (path: string, options?: unknown) => Promise<{ data?: unknown; error?: unknown }>;
};

function fmtValue(value: number, maxFrac = 6): string {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac
  });
}

function InternalDbCandleChart({ symbol, chartFrame }: { symbol: string; chartFrame: CandleFrame }) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiCandleRow[]>([]);

  const interval = INTERNAL_INTERVAL_MAP[chartFrame];
  const limit = INTERNAL_LIMIT_MAP[chartFrame];

  const loadCandles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await api.GET("/market/candles", {
      params: {
        query: {
          symbol,
          interval,
          limit
        }
      }
    });
    setLoading(false);

    if (error || !Array.isArray(data)) {
      setRows([]);
      setErrorMessage("내부 차트 데이터를 불러오지 못했습니다.");
      return;
    }

    const payload = data as ApiCandleRow[];
    setRows(payload);
    setErrorMessage(null);
  }, [interval, limit, symbol]);

  useEffect(() => {
    void loadCandles();
    const timerId = window.setInterval(() => {
      void loadCandles();
    }, 5000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loadCandles]);

  const candles = useMemo<ParsedCandle[]>(() => {
    return rows
      .map((row) => {
        const openTimeMs = new Date(row.openTime).getTime();
        const closeTimeMs = new Date(row.closeTime).getTime();
        const open = Number(row.open);
        const high = Number(row.high);
        const low = Number(row.low);
        const close = Number(row.close);
        const volume = Number(row.volume);
        if (
          !Number.isFinite(openTimeMs) ||
          !Number.isFinite(closeTimeMs) ||
          !Number.isFinite(open) ||
          !Number.isFinite(high) ||
          !Number.isFinite(low) ||
          !Number.isFinite(close) ||
          !Number.isFinite(volume)
        ) {
          return null;
        }
        return { openTimeMs, closeTimeMs, open, high, low, close, volume };
      })
      .filter((row): row is ParsedCandle => row !== null)
      .sort((a, b) => a.openTimeMs - b.openTimeMs);
  }, [rows]);

  const latest = candles[candles.length - 1] ?? null;
  const previous = candles[candles.length - 2] ?? null;
  const latestPrice = latest?.close ?? null;
  const deltaPct =
    latest && previous && previous.close !== 0
      ? ((latest.close - previous.close) / previous.close) * 100
      : null;

  const svg = useMemo(() => {
    if (candles.length === 0) {
      return null;
    }

    const width = 1000;
    const height = 390;
    const volumeHeight = 78;
    const priceHeight = height - volumeHeight - 8;

    const highs = candles.map((row) => row.high);
    const lows = candles.map((row) => row.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const priceRange = Math.max(maxPrice - minPrice, maxPrice * 0.003, 0.0000001);
    const paddedMax = maxPrice + priceRange * 0.04;
    const paddedMin = minPrice - priceRange * 0.04;
    const denom = Math.max(paddedMax - paddedMin, 0.0000001);

    const maxVolume = Math.max(...candles.map((row) => row.volume), 1);
    const step = width / candles.length;
    const bodyWidth = Math.max(2, step * 0.62);

    const priceY = (price: number) => ((paddedMax - price) / denom) * (priceHeight - 4) + 2;

    const guides = Array.from({ length: 4 }, (_, idx) => {
      const ratio = idx / 3;
      const y = 2 + (priceHeight - 4) * ratio;
      const value = paddedMax - (paddedMax - paddedMin) * ratio;
      return { y, value };
    });

    return {
      width,
      height,
      priceHeight,
      volumeHeight,
      step,
      bodyWidth,
      maxVolume,
      priceY,
      guides
    };
  }, [candles]);

  if (loading && candles.length === 0) {
    return (
      <div className="flex h-full min-h-[390px] items-center justify-center text-sm text-muted-foreground">
        내부 차트 데이터 로딩 중...
      </div>
    );
  }

  if (errorMessage && candles.length === 0) {
    return (
      <div className="flex h-full min-h-[390px] items-center justify-center text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  if (!svg || candles.length === 0) {
    return (
      <div className="flex h-full min-h-[390px] items-center justify-center text-sm text-muted-foreground">
        내부 차트 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[390px] w-full rounded-lg border border-border bg-card p-2">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Internal DB Candle: {symbol}</span>
        <span className={deltaPct !== null && deltaPct < 0 ? "text-down" : "text-up"}>
          {latestPrice !== null ? fmtValue(latestPrice, 6) : "-"}
          {deltaPct !== null ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%)` : ""}
        </span>
      </div>
      <svg className="h-[calc(100%-18px)] w-full" viewBox={`0 0 ${svg.width} ${svg.height}`}>
        <rect fill="transparent" height={svg.height} width={svg.width} x={0} y={0} />
        {svg.guides.map((guide) => (
          <g key={guide.y}>
            <line
              stroke="hsl(var(--border) / 0.35)"
              strokeDasharray="3 3"
              strokeWidth={1}
              x1={0}
              x2={svg.width}
              y1={guide.y}
              y2={guide.y}
            />
            <text
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
              fontSize="10"
              textAnchor="end"
              x={svg.width - 2}
              y={guide.y - 2}
            >
              {fmtValue(guide.value, 6)}
            </text>
          </g>
        ))}

        {candles.map((row, idx) => {
          const xCenter = idx * svg.step + svg.step / 2;
          const yOpen = svg.priceY(row.open);
          const yClose = svg.priceY(row.close);
          const yHigh = svg.priceY(row.high);
          const yLow = svg.priceY(row.low);
          const isUp = row.close >= row.open;
          const color = isUp ? "hsl(var(--exchange-up))" : "hsl(var(--exchange-down))";
          const bodyY = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          const volumeBarHeight = (row.volume / svg.maxVolume) * (svg.volumeHeight - 2);
          const volumeTop = svg.priceHeight + (svg.volumeHeight - volumeBarHeight);

          return (
            <g key={`${row.openTimeMs}-${idx}`}>
              <line stroke={color} strokeWidth={1} x1={xCenter} x2={xCenter} y1={yHigh} y2={yLow} />
              <rect
                fill={color}
                height={bodyH}
                opacity={0.92}
                width={svg.bodyWidth}
                x={xCenter - svg.bodyWidth / 2}
                y={bodyY}
              />
              <rect
                fill={color}
                height={Math.max(volumeBarHeight, 1)}
                opacity={0.25}
                width={Math.max(svg.bodyWidth, 2)}
                x={xCenter - Math.max(svg.bodyWidth, 2) / 2}
                y={volumeTop}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TradingViewChart({ symbol }: TradingViewChartProps) {
  const [chartFrame, setChartFrame] = useState<CandleFrame>("1");
  const [chartSource, setChartSource] = useState<"BINANCE" | "INTERNAL">(
    INTERNAL_DB_SYMBOL_FALLBACK.has(normalizeSymbol(symbol)) ? "INTERNAL" : "BINANCE"
  );
  const { resolvedTheme } = useTheme();
  const tvSymbol = useMemo(() => toTradingViewSymbol(symbol), [symbol]);

  useEffect(() => {
    const normalized = normalizeSymbol(symbol);
    let active = true;

    const loadChartSource = async () => {
      const { data, error } = await unsafeApi.GET("/market/listed-coins");
      if (!active) {
        return;
      }

      if (!error && Array.isArray(data)) {
        const row = (data as ListedCoinRow[]).find((entry) => normalizeSymbol(entry.symbol) === normalized);
        const next = row?.chartSource?.trim().toUpperCase();
        if (next === "INTERNAL" || next === "BINANCE") {
          setChartSource(next);
          return;
        }
      }

      setChartSource(INTERNAL_DB_SYMBOL_FALLBACK.has(normalized) ? "INTERNAL" : "BINANCE");
    };

    void loadChartSource();
    return () => {
      active = false;
    };
  }, [symbol]);

  const chartUrl = useMemo(() => {
    const params = new URLSearchParams({
      frameElementId: `gnndex_${symbol.replaceAll("-", "_")}`,
      symbol: tvSymbol,
      interval: chartFrame === "1440" ? "D" : chartFrame,
      timezone: "Asia/Seoul",
      hidetoptoolbar: "1",
      hidesidetoolbar: "1",
      symboledit: "0",
      saveimage: "0",
      toolbarbg: resolvedTheme === "dark" ? "rgba(17,24,39,1)" : "rgba(255,255,255,1)",
      theme: resolvedTheme === "dark" ? "dark" : "light"
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [chartFrame, resolvedTheme, symbol, tvSymbol]);

  const useInternalChart = chartSource === "INTERNAL";

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border bg-card p-2 flex flex-col">
      <div className="mb-2 shrink-0 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs text-muted-foreground">
          {useInternalChart ? (
            <>
              Data Source: <span className="font-medium text-foreground">INTERNAL DB ({normalizeSymbol(symbol)})</span>
            </>
          ) : (
            <>
              TradingView Symbol: <span className="font-medium text-foreground">{tvSymbol}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {FRAME_OPTIONS.map((option) => (
            <button
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                chartFrame === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              key={option.value}
              onClick={() => setChartFrame(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[390px] overflow-hidden rounded-lg border border-border bg-card">
        {useInternalChart ? (
          <InternalDbCandleChart chartFrame={chartFrame} symbol={symbol} />
        ) : (
          <iframe
            allowFullScreen
            className="h-full min-h-[390px] w-full bg-card"
            key={`${tvSymbol}-${chartFrame}-${resolvedTheme}`}
            src={chartUrl}
            title={`TradingView ${tvSymbol} Chart`}
          />
        )}
      </div>
      <div className="mt-2 shrink-0 px-2 text-[11px] text-muted-foreground">
        {useInternalChart ? (
          <>SBK/G99 내부 상장 코인은 거래소 DB 캔들 데이터를 사용합니다.</>
        ) : (
          <>
            차트가 표시되지 않으면{" "}
            <a
              className="font-medium text-foreground underline underline-offset-2"
              href={chartUrl}
              rel="noreferrer"
              target="_blank"
            >
              TradingView에서 열기
            </a>
            를 사용하세요.
          </>
        )}
      </div>
    </div>
  );
}
