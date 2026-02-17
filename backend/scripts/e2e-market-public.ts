import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function parseJsonSafely(input: string): unknown {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function getErrorMessage(payload: unknown): string {
  if (!payload) {
    return "empty response";
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "object") {
    const record = payload as { message?: string | string[]; error?: string };
    if (Array.isArray(record.message) && record.message.length > 0) {
      return record.message.join(", ");
    }
    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.length > 0) {
      return record.error;
    }
  }
  return String(payload);
}

async function requestJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const payload = parseJsonSafely(text);

  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}: ${getErrorMessage(payload)}`);
  }

  return payload as T;
}

async function requestExpectFailure(baseUrl: string, path: string, expectedStatus: number) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const payload = parseJsonSafely(text);

  if (response.status !== expectedStatus) {
    throw new Error(
      `GET ${path} expected ${expectedStatus}, got ${response.status}: ${getErrorMessage(payload)}`
    );
  }
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  try {
    await app.listen(0, "127.0.0.1");
    const server = app.getHttpServer() as { address: () => { port: number } };
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/v1`;

    const tickers = await requestJson<
      Array<{
        symbol?: string;
        lastPrice?: string | null;
        volume24h?: string;
      }>
    >(baseUrl, "/market/tickers?limit=5");
    assert(Array.isArray(tickers), "Tickers must be an array");

    const symbol = tickers[0]?.symbol ?? "BTC-USDT";
    const orderbook = await requestJson<{
      symbol?: string;
      bids?: Array<{ price?: string; quantity?: string }>;
      asks?: Array<{ price?: string; quantity?: string }>;
    }>(baseUrl, `/market/orderbook/${encodeURIComponent(symbol)}?limit=10`);

    assert(orderbook.symbol === symbol, "Orderbook symbol mismatch");
    assert(Array.isArray(orderbook.bids), "Orderbook bids must be an array");
    assert(Array.isArray(orderbook.asks), "Orderbook asks must be an array");

    const candles = await requestJson<
      Array<{
        symbol?: string;
        interval?: string;
        open?: string;
        close?: string;
      }>
    >(baseUrl, `/market/candles?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=30`);
    assert(Array.isArray(candles), "Candles must be an array");

    await requestExpectFailure(
      baseUrl,
      `/market/candles?symbol=${encodeURIComponent(symbol)}&interval=2m`,
      400
    );

    console.log("E2E market public API flow passed");
    console.log(`- symbol: ${symbol}`);
    console.log(`- tickers returned: ${tickers.length}`);
    console.log(`- candles returned: ${candles.length}`);
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

