import type {
  BalancesStreamEvent,
  OrdersStreamEvent,
  OrderViewTab,
  OPEN_ORDER_STATUSES,
  HISTORY_ORDER_STATUSES,
} from "../types/market";

export function formatNumber(
  raw: string | null,
  fractionDigits = 6,
): string {
  if (!raw) {
    return "-";
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return raw;
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function parseApiError(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const payload = input as { message?: string | string[]; error?: string };
  if (Array.isArray(payload.message) && payload.message.length > 0) {
    return payload.message.join(", ");
  }
  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  return fallback;
}

export function toIsoOrUndefined(raw: string): string | undefined {
  if (!raw.trim()) {
    return undefined;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function parseBalancesStreamEvent(
  raw: string,
): BalancesStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BalancesStreamEvent>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      parsed.eventType !== "user.balances.snapshot" &&
      parsed.eventType !== "user.balances.error"
    ) {
      return null;
    }
    return parsed as BalancesStreamEvent;
  } catch {
    return null;
  }
}

export function parseOrdersStreamEvent(
  raw: string,
): OrdersStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OrdersStreamEvent>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      parsed.eventType !== "user.orders.snapshot" &&
      parsed.eventType !== "user.orders.error"
    ) {
      return null;
    }
    return parsed as OrdersStreamEvent;
  } catch {
    return null;
  }
}

export function tabStatuses(
  tab: OrderViewTab,
):
  | Array<
      (typeof OPEN_ORDER_STATUSES)[number] | (typeof HISTORY_ORDER_STATUSES)[number]
    >
  | undefined {
  if (tab === "OPEN") {
    return ["NEW", "PARTIALLY_FILLED"];
  }
  if (tab === "HISTORY") {
    return ["FILLED", "CANCELED", "REJECTED"];
  }
  return undefined;
}
