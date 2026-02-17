import { BadRequestException, Injectable } from "@nestjs/common";
import { OrderSide, Prisma } from "@prisma/client";
import { Observable, catchError, from, map, of, switchMap, timer } from "rxjs";
import { PrismaService } from "../database/prisma.service";
import { CandleInterval, ListCandlesQueryDto } from "./dto/list-candles.dto";
import { GetOrderbookQueryDto } from "./dto/get-orderbook.dto";
import { ListTickersQueryDto } from "./dto/list-tickers.dto";
import { StreamTickersQueryDto } from "./dto/stream-tickers.dto";

const DEFAULT_SYMBOLS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT"] as const;
const DAY_24H_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MIN_ORDER_NOTIONAL_USDT = new Prisma.Decimal("5");
const DEFAULT_MAKER_FEE_RATE_PCT = new Prisma.Decimal("0.02");
const DEFAULT_TAKER_FEE_RATE_PCT = new Prisma.Decimal("0.06");
const DEFAULT_VAT_RATE_PCT = new Prisma.Decimal("10");
const PRIMARY_QUOTE_ASSET = "USDT";
const LEGACY_QUOTE_ASSET = "KRW";
const LEGACY_KRW_PER_USDT = new Prisma.Decimal(process.env.LEGACY_KRW_PER_USDT ?? "1300");
const PRICE_PRECISION = 8;
const BINANCE_API_BASE = process.env.BINANCE_API_BASE ?? "https://api.binance.com";
const BINANCE_TIMEOUT_MS = Number(process.env.BINANCE_TIMEOUT_MS ?? 4000);
const BINANCE_ANCHORED_BASE_ASSETS = new Set(["BTC", "ETH", "SOL", "XRP"]);
const INTERNAL_CHART_SOURCE = "INTERNAL";
const BINANCE_CHART_SOURCE = "BINANCE";
const INTERNAL_DB_CHART_FALLBACK_SYMBOLS = new Set(["SBK-USDT", "G99-USDT"]);

const INTERVAL_MS_MAP: Record<CandleInterval, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000
};

type TickerSnapshot = {
  symbol: string;
  lastPrice: string | null;
  openPrice24h: string | null;
  highPrice24h: string | null;
  lowPrice24h: string | null;
  volume24h: string;
  changePercent24h: string | null;
  updatedAt: string;
};

type OrderbookLevel = {
  price: string;
  quantity: string;
};

type CandleBucket = {
  open: Prisma.Decimal;
  high: Prisma.Decimal;
  low: Prisma.Decimal;
  close: Prisma.Decimal;
  volume: Prisma.Decimal;
};

type StreamTickersEvent = {
  eventId: string;
  eventType: "market.ticker.snapshot" | "market.ticker.error";
  eventVersion: number;
  occurredAt: string;
  data: TickerSnapshot[] | { message: string };
};

type BinanceTicker24h = {
  lastPrice?: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  priceChangePercent?: string;
};

type BinanceDepthSnapshot = {
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
};

type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  ...unknown[]
];

type ListedCoinRow = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  chartSource: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSymbol(value: string): string {
    return value.trim().toUpperCase();
  }

  private parseMarketPair(symbolInput: string): { symbol: string; baseAsset: string; quoteAsset: string } {
    const symbol = this.normalizeSymbol(symbolInput);
    const [baseAsset, quoteAsset] = symbol.split("-");
    if (!baseAsset || !quoteAsset) {
      throw new BadRequestException("Invalid symbol format, expected BASE-QUOTE");
    }
    return { symbol, baseAsset, quoteAsset };
  }

  private normalizeToPrimarySymbol(
    symbolInput: string,
    options?: { includeLegacyQuote?: boolean }
  ): {
    symbol: string;
    baseAsset: string;
    requestedQuoteAsset: string;
    legacyKrwSymbol: string;
    querySymbols: string[];
  } {
    const includeLegacyQuote = options?.includeLegacyQuote ?? true;
    const { baseAsset, quoteAsset } = this.parseMarketPair(symbolInput);
    if (quoteAsset !== PRIMARY_QUOTE_ASSET && quoteAsset !== LEGACY_QUOTE_ASSET) {
      throw new BadRequestException(`Only ${PRIMARY_QUOTE_ASSET} markets are supported`);
    }
    const symbol = `${baseAsset}-${PRIMARY_QUOTE_ASSET}`;
    const legacyKrwSymbol = `${baseAsset}-${LEGACY_QUOTE_ASSET}`;
    return {
      symbol,
      baseAsset,
      requestedQuoteAsset: quoteAsset,
      legacyKrwSymbol,
      querySymbols: includeLegacyQuote ? [symbol, legacyKrwSymbol] : [symbol]
    };
  }

  private isBinanceAnchoredBaseAsset(baseAsset: string): boolean {
    return BINANCE_ANCHORED_BASE_ASSETS.has(baseAsset);
  }

  private normalizeToPrimarySymbolOrNull(symbolInput: string): string | null {
    try {
      const { symbol } = this.normalizeToPrimarySymbol(symbolInput);
      return symbol;
    } catch {
      return null;
    }
  }

  private toBinanceSymbol(symbolInput: string): string {
    const { baseAsset } = this.normalizeToPrimarySymbol(symbolInput);
    return `${baseAsset}${PRIMARY_QUOTE_ASSET}`;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BINANCE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getBinanceTickerSnapshot(symbol: string): Promise<TickerSnapshot | null> {
    const { symbol: primarySymbol } = this.normalizeToPrimarySymbol(symbol);
    const binanceSymbol = this.toBinanceSymbol(primarySymbol);
    const payload = await this.fetchJson<BinanceTicker24h>(
      `${BINANCE_API_BASE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol)}`
    );
    if (!payload?.lastPrice || !payload.openPrice || !payload.highPrice || !payload.lowPrice || !payload.volume) {
      return null;
    }
    const last = new Prisma.Decimal(payload.lastPrice);
    const open = new Prisma.Decimal(payload.openPrice);
    return {
      symbol: primarySymbol,
      lastPrice: last.toString(),
      openPrice24h: open.toString(),
      highPrice24h: new Prisma.Decimal(payload.highPrice).toString(),
      lowPrice24h: new Prisma.Decimal(payload.lowPrice).toString(),
      volume24h: new Prisma.Decimal(payload.volume).toString(),
      changePercent24h:
        payload.priceChangePercent ??
        this.computeChangePercent(open, last),
      updatedAt: new Date().toISOString()
    };
  }

  private toUsdtPrice(price: Prisma.Decimal, symbol: string): Prisma.Decimal {
    if (symbol.endsWith(`-${LEGACY_QUOTE_ASSET}`)) {
      return price.div(LEGACY_KRW_PER_USDT);
    }
    return price;
  }

  private maxDecimal(values: Array<Prisma.Decimal | null>): Prisma.Decimal | null {
    let max: Prisma.Decimal | null = null;
    for (const value of values) {
      if (!value) continue;
      if (!max || value.comparedTo(max) > 0) {
        max = value;
      }
    }
    return max;
  }

  private minDecimal(values: Array<Prisma.Decimal | null>): Prisma.Decimal | null {
    let min: Prisma.Decimal | null = null;
    for (const value of values) {
      if (!value) continue;
      if (!min || value.comparedTo(min) < 0) {
        min = value;
      }
    }
    return min;
  }

  private parseSymbolsCsv(raw?: string): string[] {
    if (!raw) {
      return [];
    }

    const deduped = new Set<string>();
    for (const chunk of raw.split(",")) {
      const symbol = this.normalizeToPrimarySymbolOrNull(chunk);
      if (!symbol) {
        continue;
      }
      deduped.add(symbol);
      if (deduped.size >= 50) {
        break;
      }
    }

    return [...deduped];
  }

  private async listConfiguredSymbols(limit: number): Promise<string[]> {
    const rows = await this.prisma.coinListing.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { symbol: "asc" }],
      take: Math.min(limit, 100),
      select: { symbol: true }
    });
    if (rows.length === 0) {
      return [];
    }
    return rows.map((row) => row.symbol);
  }

  private async resolveChartSourceSymbol(symbolInput: string): Promise<string> {
    const { symbol } = this.normalizeToPrimarySymbol(symbolInput, { includeLegacyQuote: false });
    const listing = await this.prisma.coinListing.findUnique({
      where: { symbol },
      select: { chartSource: true }
    });
    if (listing?.chartSource) {
      return listing.chartSource.trim().toUpperCase();
    }
    return INTERNAL_DB_CHART_FALLBACK_SYMBOLS.has(symbol) ? INTERNAL_CHART_SOURCE : BINANCE_CHART_SOURCE;
  }

  private async isInternalChartSymbol(symbolInput: string): Promise<boolean> {
    const source = await this.resolveChartSourceSymbol(symbolInput);
    return source === INTERNAL_CHART_SOURCE;
  }

  async listListedCoins(options?: { activeOnly?: boolean }): Promise<ListedCoinRow[]> {
    const activeOnly = options?.activeOnly ?? true;
    const rows = await this.prisma.coinListing.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: "asc" }, { symbol: "asc" }],
      select: {
        symbol: true,
        baseAsset: true,
        quoteAsset: true,
        chartSource: true,
        isActive: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (rows.length > 0) {
      return rows.map((row) => ({
        symbol: row.symbol,
        baseAsset: row.baseAsset,
        quoteAsset: row.quoteAsset,
        chartSource: row.chartSource.trim().toUpperCase(),
        isActive: row.isActive,
        displayOrder: row.displayOrder,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      }));
    }

    const fallbackSymbols = [...DEFAULT_SYMBOLS, ...INTERNAL_DB_CHART_FALLBACK_SYMBOLS];
    const deduped = Array.from(new Set(fallbackSymbols));
    return deduped.map((symbol, index) => {
      const { baseAsset, quoteAsset } = this.parseMarketPair(symbol);
      return {
        symbol,
        baseAsset,
        quoteAsset,
        chartSource: INTERNAL_DB_CHART_FALLBACK_SYMBOLS.has(symbol)
          ? INTERNAL_CHART_SOURCE
          : BINANCE_CHART_SOURCE,
        isActive: true,
        displayOrder: index,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      };
    });
  }

  private async listCandlesFromInternalTable(
    symbol: string,
    interval: CandleInterval,
    limit: number
  ) {
    const rows = await this.prisma.internalCandle.findMany({
      where: { symbol, interval },
      orderBy: { openTime: "desc" },
      take: limit,
      select: {
        openTime: true,
        closeTime: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true
      }
    });

    return rows.reverse().map((row) => ({
      symbol,
      interval,
      openTime: row.openTime.toISOString(),
      closeTime: row.closeTime.toISOString(),
      open: row.open.toString(),
      high: row.high.toString(),
      low: row.low.toString(),
      close: row.close.toString(),
      volume: row.volume.toString()
    }));
  }

  private async listCandlesFromOrders(
    symbol: string,
    querySymbols: string[],
    interval: CandleInterval,
    limit: number,
    intervalMs: number
  ) {
    const end = Date.now();
    const start = end - intervalMs * limit;

    const rows = await this.prisma.order.findMany({
      where: {
        symbol: { in: querySymbols },
        price: { not: null },
        createdAt: {
          gte: new Date(start),
          lte: new Date(end)
        }
      },
      orderBy: { createdAt: "asc" },
      select: {
        symbol: true,
        createdAt: true,
        price: true,
        quantity: true
      }
    });

    const buckets = new Map<number, CandleBucket>();

    for (const row of rows) {
      if (!row.price) {
        continue;
      }
      const normalizedPrice = this.toUsdtPrice(row.price, row.symbol);

      const bucketStart = Math.floor(row.createdAt.getTime() / intervalMs) * intervalMs;
      const existing = buckets.get(bucketStart);

      if (!existing) {
        buckets.set(bucketStart, {
          open: normalizedPrice,
          high: normalizedPrice,
          low: normalizedPrice,
          close: normalizedPrice,
          volume: row.quantity
        });
        continue;
      }

      if (normalizedPrice.gt(existing.high)) {
        existing.high = normalizedPrice;
      }
      if (normalizedPrice.lt(existing.low)) {
        existing.low = normalizedPrice;
      }
      existing.close = normalizedPrice;
      existing.volume = existing.volume.add(row.quantity);
    }

    const sortedEntries = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-limit);

    return sortedEntries.map(([bucketStart, bucket]) => ({
      symbol,
      interval,
      openTime: new Date(bucketStart).toISOString(),
      closeTime: new Date(bucketStart + intervalMs).toISOString(),
      open: bucket.open.toString(),
      high: bucket.high.toString(),
      low: bucket.low.toString(),
      close: bucket.close.toString(),
      volume: bucket.volume.toString()
    }));
  }

  private async getRecentSymbols(limit: number): Promise<string[]> {
    const configured = await this.listConfiguredSymbols(limit);
    if (configured.length > 0) {
      return configured;
    }

    const rows = await this.prisma.order.groupBy({
      by: ["symbol"],
      where: {
        price: { not: null }
      },
      _max: {
        createdAt: true
      },
      orderBy: {
        _max: {
          createdAt: "desc"
        }
      },
      take: Math.min(limit * 5, 250)
    });

    const symbols: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const normalized = this.normalizeToPrimarySymbolOrNull(row.symbol);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      symbols.push(normalized);
      seen.add(normalized);
      if (symbols.length >= limit) {
        break;
      }
    }
    if (symbols.length > 0) {
      return symbols;
    }

    return [...DEFAULT_SYMBOLS].slice(0, Math.min(limit, DEFAULT_SYMBOLS.length));
  }

  private computeChangePercent(
    openPrice: Prisma.Decimal | null,
    lastPrice: Prisma.Decimal | null
  ): string | null {
    if (!openPrice || !lastPrice || openPrice.eq(0)) {
      return null;
    }

    return lastPrice.sub(openPrice).div(openPrice).mul(100).toDecimalPlaces(4).toString();
  }

  private async getTickerSnapshot(symbol: string): Promise<TickerSnapshot> {
    const primary = this.normalizeToPrimarySymbol(symbol, { includeLegacyQuote: false });
    const useInternalChart = await this.isInternalChartSymbol(primary.symbol);
    if (!useInternalChart) {
      const externalSnapshot = await this.getBinanceTickerSnapshot(primary.symbol);
      if (externalSnapshot) {
        return externalSnapshot;
      }
    }

    const fallback = this.normalizeToPrimarySymbol(symbol, {
      includeLegacyQuote: !this.isBinanceAnchoredBaseAsset(primary.baseAsset)
    });
    const usdtSymbol = fallback.querySymbols[0];
    const krwSymbol = fallback.querySymbols[1];
    const since24h = new Date(Date.now() - DAY_24H_MS);

    if (!krwSymbol) {
      const [latestUsdt, open24hUsdt, aggregate24hUsdt] = await Promise.all([
        this.prisma.order.findFirst({
          where: {
            symbol: usdtSymbol,
            price: { not: null }
          },
          orderBy: { createdAt: "desc" },
          select: { symbol: true, price: true, createdAt: true }
        }),
        this.prisma.order.findFirst({
          where: {
            symbol: usdtSymbol,
            price: { not: null },
            createdAt: { gte: since24h }
          },
          orderBy: { createdAt: "asc" },
          select: { symbol: true, price: true, createdAt: true }
        }),
        this.prisma.order.aggregate({
          where: {
            symbol: usdtSymbol,
            price: { not: null },
            createdAt: { gte: since24h }
          },
          _max: { price: true },
          _min: { price: true },
          _sum: { quantity: true }
        })
      ]);

      const lastPrice = latestUsdt?.price ?? null;
      const openPrice = open24hUsdt?.price ?? lastPrice;
      const highPrice = aggregate24hUsdt._max.price ?? lastPrice;
      const lowPrice = aggregate24hUsdt._min.price ?? lastPrice;
      const volume = aggregate24hUsdt._sum.quantity ?? new Prisma.Decimal(0);

      return {
        symbol: primary.symbol,
        lastPrice: lastPrice?.toString() ?? null,
        openPrice24h: openPrice?.toString() ?? null,
        highPrice24h: highPrice?.toString() ?? null,
        lowPrice24h: lowPrice?.toString() ?? null,
        volume24h: volume.toString(),
        changePercent24h: this.computeChangePercent(openPrice, lastPrice),
        updatedAt: (latestUsdt?.createdAt ?? new Date()).toISOString()
      };
    }

    const [
      latestUsdt,
      latestKrw,
      open24hUsdt,
      open24hKrw,
      aggregate24hUsdt,
      aggregate24hKrw
    ] = await Promise.all([
      this.prisma.order.findFirst({
        where: {
          symbol: usdtSymbol,
          price: { not: null }
        },
        orderBy: { createdAt: "desc" },
        select: { symbol: true, price: true, createdAt: true }
      }),
      this.prisma.order.findFirst({
        where: {
          symbol: krwSymbol,
          price: { not: null }
        },
        orderBy: { createdAt: "desc" },
        select: { symbol: true, price: true, createdAt: true }
      }),
      this.prisma.order.findFirst({
        where: {
          symbol: usdtSymbol,
          price: { not: null },
          createdAt: { gte: since24h }
        },
        orderBy: { createdAt: "asc" },
        select: { symbol: true, price: true, createdAt: true }
      }),
      this.prisma.order.findFirst({
        where: {
          symbol: krwSymbol,
          price: { not: null },
          createdAt: { gte: since24h }
        },
        orderBy: { createdAt: "asc" },
        select: { symbol: true, price: true, createdAt: true }
      }),
      this.prisma.order.aggregate({
        where: {
          symbol: usdtSymbol,
          price: { not: null },
          createdAt: { gte: since24h }
        },
        _max: { price: true },
        _min: { price: true },
        _sum: { quantity: true }
      }),
      this.prisma.order.aggregate({
        where: {
          symbol: krwSymbol,
          price: { not: null },
          createdAt: { gte: since24h }
        },
        _max: { price: true },
        _min: { price: true },
        _sum: { quantity: true }
      })
    ]);

    const latest = [latestUsdt, latestKrw]
      .filter((row): row is NonNullable<typeof latestUsdt> => Boolean(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    const open24h = [open24hUsdt, open24hKrw]
      .filter((row): row is NonNullable<typeof open24hUsdt> => Boolean(row))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;

    const lastPrice = latest?.price ? this.toUsdtPrice(latest.price, latest.symbol) : null;
    const openPrice =
      open24h?.price
        ? this.toUsdtPrice(open24h.price, open24h.symbol)
        : lastPrice;
    const highPrice = this.maxDecimal([
      aggregate24hUsdt._max.price ?? null,
      aggregate24hKrw._max.price ? this.toUsdtPrice(aggregate24hKrw._max.price, krwSymbol) : null,
      lastPrice
    ]);
    const lowPrice = this.minDecimal([
      aggregate24hUsdt._min.price ?? null,
      aggregate24hKrw._min.price ? this.toUsdtPrice(aggregate24hKrw._min.price, krwSymbol) : null,
      lastPrice
    ]);
    const volume = (aggregate24hUsdt._sum.quantity ?? new Prisma.Decimal(0)).add(
      aggregate24hKrw._sum.quantity ?? new Prisma.Decimal(0)
    );

    return {
      symbol: primary.symbol,
      lastPrice: lastPrice?.toString() ?? null,
      openPrice24h: openPrice?.toString() ?? null,
      highPrice24h: highPrice?.toString() ?? null,
      lowPrice24h: lowPrice?.toString() ?? null,
      volume24h: volume.toString(),
      changePercent24h: this.computeChangePercent(openPrice, lastPrice),
      updatedAt: (latest?.createdAt ?? new Date()).toISOString()
    };
  }

  async getTradingRules(symbolInput: string) {
    const { symbol, baseAsset } = this.normalizeToPrimarySymbol(symbolInput);
    const quoteAsset = PRIMARY_QUOTE_ASSET;
    const minOrderNotional = DEFAULT_MIN_ORDER_NOTIONAL_USDT;
    const makerFeeRatePctInclVat = DEFAULT_MAKER_FEE_RATE_PCT.mul(
      DEFAULT_VAT_RATE_PCT.div(100).add(1)
    );
    const takerFeeRatePctInclVat = DEFAULT_TAKER_FEE_RATE_PCT.mul(
      DEFAULT_VAT_RATE_PCT.div(100).add(1)
    );

    return {
      symbol,
      baseAsset,
      quoteAsset,
      minOrderNotional: minOrderNotional.toDecimalPlaces(8).toString(),
      makerFeeRatePct: DEFAULT_MAKER_FEE_RATE_PCT.toDecimalPlaces(8).toString(),
      takerFeeRatePct: DEFAULT_TAKER_FEE_RATE_PCT.toDecimalPlaces(8).toString(),
      vatRatePct: DEFAULT_VAT_RATE_PCT.toDecimalPlaces(8).toString(),
      makerFeeRatePctInclVat: makerFeeRatePctInclVat.toDecimalPlaces(8).toString(),
      takerFeeRatePctInclVat: takerFeeRatePctInclVat.toDecimalPlaces(8).toString()
    };
  }

  async listTickers(query: ListTickersQueryDto) {
    const limit = query.limit ?? 20;
    const parsedSymbols = this.parseSymbolsCsv(query.symbols);
    const symbols = (parsedSymbols.length > 0 ? parsedSymbols : await this.getRecentSymbols(limit)).slice(0, limit);
    const snapshots = await Promise.all(symbols.map((symbol) => this.getTickerSnapshot(symbol)));
    return snapshots;
  }

  streamTickers(query: StreamTickersQueryDto): Observable<StreamTickersEvent> {
    const intervalMs = query.intervalMs ?? 5000;
    const listQuery: ListTickersQueryDto = {
      symbols: query.symbols,
      limit: query.limit
    };
    let sequence = 0;

    return timer(0, intervalMs).pipe(
      switchMap(() =>
        from(this.listTickers(listQuery)).pipe(
          map((snapshots) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            return {
              eventId: `ticker-${occurredAt}-${sequence}`,
              eventType: "market.ticker.snapshot" as const,
              eventVersion: 1,
              occurredAt,
              data: snapshots
            };
          }),
          catchError((error: unknown) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            const message =
              error instanceof Error ? error.message : "Failed to stream ticker snapshots";
            return of({
              eventId: `ticker-error-${occurredAt}-${sequence}`,
              eventType: "market.ticker.error" as const,
              eventVersion: 1,
              occurredAt,
              data: { message }
            });
          })
        )
      )
    );
  }

  async getOrderbook(symbolInput: string, query: GetOrderbookQueryDto) {
    const primary = this.normalizeToPrimarySymbol(symbolInput, { includeLegacyQuote: false });
    const { symbol, querySymbols } = this.normalizeToPrimarySymbol(symbolInput, {
      includeLegacyQuote: !this.isBinanceAnchoredBaseAsset(primary.baseAsset)
    });
    const limit = query.limit ?? 20;
    const useInternalChart = await this.isInternalChartSymbol(symbol);

    if (!useInternalChart) {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const externalDepth = await this.fetchJson<BinanceDepthSnapshot>(
        `${BINANCE_API_BASE}/api/v3/depth?symbol=${encodeURIComponent(binanceSymbol)}&limit=${limit}`
      );
      if (externalDepth?.bids && externalDepth?.asks) {
        return {
          symbol,
          bids: externalDepth.bids.map((level) => ({
            price: level[0],
            quantity: level[1]
          })),
          asks: externalDepth.asks.map((level) => ({
            price: level[0],
            quantity: level[1]
          })),
          updatedAt: new Date().toISOString()
        };
      }
    }

    const grouped = await this.prisma.order.groupBy({
      by: ["symbol", "side", "price"],
      where: {
        symbol: { in: querySymbols },
        type: "LIMIT",
        status: { in: ["NEW", "PARTIALLY_FILLED"] },
        price: { not: null }
      },
      _sum: { quantity: true }
    });

    const bidLevels = new Map<string, Prisma.Decimal>();
    const askLevels = new Map<string, Prisma.Decimal>();

    for (const row of grouped) {
      if (!row.price || !row._sum.quantity) {
        continue;
      }

      const normalizedPrice = this.toUsdtPrice(row.price, row.symbol).toDecimalPlaces(PRICE_PRECISION);
      const priceKey = normalizedPrice.toString();

      if (row.side === OrderSide.BUY) {
        const prevQty = bidLevels.get(priceKey) ?? new Prisma.Decimal(0);
        bidLevels.set(priceKey, prevQty.add(row._sum.quantity));
      } else {
        const prevQty = askLevels.get(priceKey) ?? new Prisma.Decimal(0);
        askLevels.set(priceKey, prevQty.add(row._sum.quantity));
      }
    }

    const bids: OrderbookLevel[] = [...bidLevels.entries()].map(([price, quantity]) => ({
      price,
      quantity: quantity.toString()
    }));
    const asks: OrderbookLevel[] = [...askLevels.entries()].map(([price, quantity]) => ({
      price,
      quantity: quantity.toString()
    }));

    bids.sort((a, b) => new Prisma.Decimal(b.price).comparedTo(new Prisma.Decimal(a.price)));
    asks.sort((a, b) => new Prisma.Decimal(a.price).comparedTo(new Prisma.Decimal(b.price)));

    return {
      symbol,
      bids: bids.slice(0, limit),
      asks: asks.slice(0, limit),
      updatedAt: new Date().toISOString()
    };
  }

  async listCandles(query: ListCandlesQueryDto) {
    const primary = this.normalizeToPrimarySymbol(query.symbol, { includeLegacyQuote: false });
    const { symbol, querySymbols } = this.normalizeToPrimarySymbol(query.symbol, {
      includeLegacyQuote: !this.isBinanceAnchoredBaseAsset(primary.baseAsset)
    });
    const interval = query.interval ?? "1m";
    const limit = query.limit ?? 120;
    const intervalMs = INTERVAL_MS_MAP[interval];
    const useInternalChart = await this.isInternalChartSymbol(symbol);

    if (useInternalChart) {
      const internalCandles = await this.listCandlesFromInternalTable(symbol, interval, limit);
      if (internalCandles.length > 0) {
        return internalCandles;
      }
    } else {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const externalKlines = await this.fetchJson<BinanceKlineRow[]>(
        `${BINANCE_API_BASE}/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${interval}&limit=${limit}`
      );
      if (Array.isArray(externalKlines) && externalKlines.length > 0) {
        return externalKlines.map((kline) => ({
          symbol,
          interval,
          openTime: new Date(kline[0]).toISOString(),
          closeTime: new Date(kline[6]).toISOString(),
          open: kline[1],
          high: kline[2],
          low: kline[3],
          close: kline[4],
          volume: kline[5]
        }));
      }
    }
    return this.listCandlesFromOrders(symbol, querySymbols, interval, limit, intervalMs);
  }
}
