/**
 * Generates 7 days of internal candle data for SBK-USDT and G99-USDT.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/seed-candles.ts
 *
 * Requires DATABASE_URL in backend/.env
 */

import { PrismaClient } from "@prisma/client";

const SYMBOLS: { symbol: string; basePrice: number; pricePrecision: number }[] = [
  { symbol: "SBK-USDT", basePrice: 0.824, pricePrecision: 6 },
  { symbol: "G99-USDT", basePrice: 0.162, pricePrecision: 6 }
];

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_MINUTES: Record<Interval, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

const DAYS = 7;
const TOTAL_1M_CANDLES = DAYS * 24 * 60; // 10,080

interface RawCandle {
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function gaussianRandom(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generates realistic 1-minute candles using a random walk with:
 * - Mean-reversion toward base price
 * - Volatility clustering (GARCH-like)
 * - Intraday volume patterns (higher at market open/close hours)
 * - Multi-scale trends (slow drift + fast noise)
 */
function generate1mCandles(basePrice: number): RawCandle[] {
  const candles: RawCandle[] = [];
  const now = new Date();
  // Align start to the beginning of a minute, 7 days ago
  const startMs =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0
    ).getTime() -
    DAYS * 24 * 60 * 60 * 1000;

  let price = basePrice;
  let volatility = 0.003; // base volatility ~0.3%

  // Slow-moving trend component
  let trendDirection = randomBetween(-1, 1) > 0 ? 1 : -1;
  let trendStrength = randomBetween(0.0001, 0.0004);
  let trendDuration = Math.floor(randomBetween(60, 360));
  let trendCounter = 0;

  for (let i = 0; i < TOTAL_1M_CANDLES; i++) {
    const openTime = new Date(startMs + i * 60_000);
    const closeTime = new Date(startMs + (i + 1) * 60_000 - 1);
    const hourOfDay = openTime.getUTCHours();

    // Update trend periodically
    trendCounter++;
    if (trendCounter >= trendDuration) {
      trendDirection = randomBetween(-1, 1) > 0 ? 1 : -1;
      trendStrength = randomBetween(0.00005, 0.0003);
      trendDuration = Math.floor(randomBetween(60, 480));
      trendCounter = 0;
    }

    // Volatility clustering: slowly adjust volatility
    const volShock = gaussianRandom() * 0.0005;
    volatility = Math.max(0.001, Math.min(0.008, volatility * 0.995 + Math.abs(volShock)));

    // Occasional volatility spikes
    if (Math.random() < 0.005) {
      volatility = randomBetween(0.005, 0.012);
    }

    // Mean reversion toward base price (weak pull)
    const meanReversionForce = (basePrice - price) / basePrice * 0.002;

    // Combined return for this candle
    const trendComponent = trendDirection * trendStrength;
    const noiseComponent = gaussianRandom() * volatility;
    const returnRate = trendComponent + noiseComponent + meanReversionForce;

    const open = price;
    const close = open * (1 + returnRate);

    // Generate intra-candle high/low
    const range = Math.abs(open - close);
    const extraWick = range * randomBetween(0.1, 1.5) + open * volatility * randomBetween(0.1, 0.5);
    const high = Math.max(open, close) + extraWick * randomBetween(0, 1);
    const low = Math.min(open, close) - extraWick * randomBetween(0, 1);

    // Volume: higher during certain hours (simulating Asian/US market overlap)
    let volumeMultiplier = 1.0;
    if ((hourOfDay >= 1 && hourOfDay <= 4) || (hourOfDay >= 14 && hourOfDay <= 17)) {
      volumeMultiplier = randomBetween(1.5, 3.0);
    } else if (hourOfDay >= 8 && hourOfDay <= 10) {
      volumeMultiplier = randomBetween(1.2, 2.0);
    } else {
      volumeMultiplier = randomBetween(0.4, 1.2);
    }

    // Bigger price moves = more volume
    const moveMultiplier = 1 + Math.abs(returnRate) * 50;
    const baseVolume = basePrice < 1 ? randomBetween(5000, 25000) : randomBetween(500, 3000);
    const volume = baseVolume * volumeMultiplier * moveMultiplier;

    candles.push({
      openTime,
      closeTime,
      open: Math.max(open, basePrice * 0.3),
      high: Math.max(high, Math.max(open, close)),
      low: Math.max(Math.min(low, Math.min(open, close)), basePrice * 0.2),
      close: Math.max(close, basePrice * 0.3),
      volume
    });

    price = Math.max(close, basePrice * 0.3);
  }

  return candles;
}

/**
 * Aggregates 1m candles into a higher-interval candle.
 */
function aggregateCandles(source: RawCandle[], intervalMinutes: number): RawCandle[] {
  const result: RawCandle[] = [];

  for (let i = 0; i < source.length; i += intervalMinutes) {
    const slice = source.slice(i, i + intervalMinutes);
    if (slice.length === 0) continue;

    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    result.push({
      openTime: first.openTime,
      closeTime: last.closeTime,
      open: first.open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: last.close,
      volume: slice.reduce((sum, c) => sum + c.volume, 0)
    });
  }

  return result;
}

function toDecimalStr(value: number, precision: number): string {
  return value.toFixed(precision);
}

async function main() {
  const prisma = new PrismaClient();

  try {
    for (const { symbol, basePrice, pricePrecision } of SYMBOLS) {
      console.log(`\nGenerating candles for ${symbol} (base price: ${basePrice})...`);

      // Delete existing internal candles for this symbol
      const deleted = await prisma.internalCandle.deleteMany({
        where: { symbol }
      });
      console.log(`  Deleted ${deleted.count} existing candles`);

      // Generate 1m candles
      const candles1m = generate1mCandles(basePrice);
      console.log(`  Generated ${candles1m.length} 1m candles`);

      // Build all interval candles
      const allRecords: Array<{
        symbol: string;
        interval: string;
        openTime: Date;
        closeTime: Date;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      }> = [];

      for (const interval of INTERVALS) {
        const minutes = INTERVAL_MINUTES[interval];
        const candles = minutes === 1 ? candles1m : aggregateCandles(candles1m, minutes);

        for (const c of candles) {
          allRecords.push({
            symbol,
            interval,
            openTime: c.openTime,
            closeTime: c.closeTime,
            open: toDecimalStr(c.open, pricePrecision),
            high: toDecimalStr(c.high, pricePrecision),
            low: toDecimalStr(c.low, pricePrecision),
            close: toDecimalStr(c.close, pricePrecision),
            volume: toDecimalStr(c.volume, 8)
          });
        }

        console.log(`  ${interval}: ${candles.length} candles`);
      }

      // Batch insert in chunks to avoid overwhelming the DB
      const CHUNK_SIZE = 2000;
      let inserted = 0;
      for (let i = 0; i < allRecords.length; i += CHUNK_SIZE) {
        const chunk = allRecords.slice(i, i + CHUNK_SIZE);
        await prisma.internalCandle.createMany({ data: chunk });
        inserted += chunk.length;
        if (inserted % 10000 < CHUNK_SIZE) {
          console.log(`  Inserted ${inserted}/${allRecords.length} records...`);
        }
      }

      console.log(`  Total: ${allRecords.length} candle records inserted for ${symbol}`);
    }

    console.log("\nCandle seed completed successfully!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
