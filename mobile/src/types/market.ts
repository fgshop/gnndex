export type BalanceRow = {
  asset: string;
  available: string;
  locked: string;
};

export type TickerRow = {
  symbol: string;
  lastPrice: string | null;
  changePercent24h: string | null;
};

export type OrderbookLevel = {
  price: string;
  quantity: string;
};

export type OrderbookPayload = {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  updatedAt: string;
};

export type CandleRow = {
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

export type OrderRow = {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  price: string | null;
  quantity: string;
  status:
    | "NEW"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "NOT_FOUND";
  createdAt?: string;
};

export type OrdersListPayload = {
  items?: OrderRow[];
  page?: number;
  limit?: number;
  total?: number;
};

export type OrdersStreamEvent = {
  eventId: string;
  eventType: "user.orders.snapshot" | "user.orders.error";
  eventVersion: number;
  occurredAt: string;
  data: OrdersListPayload | { message?: string };
};

export type BalancesStreamEvent = {
  eventId: string;
  eventType: "user.balances.snapshot" | "user.balances.error";
  eventVersion: number;
  occurredAt: string;
  data: BalanceRow[] | { message?: string };
};

export const SYMBOL_OPTIONS = ["BTC-USDT", "ETH-USDT", "SOL-USDT"] as const;
export const ORDER_TYPES = ["LIMIT", "MARKET", "STOP_LIMIT"] as const;
export const ORDER_VIEW_TABS = ["OPEN", "HISTORY", "ALL"] as const;
export const ORDER_SORT_OPTIONS = ["NEWEST", "OLDEST"] as const;
export const ORDER_STATUS_FILTERS = [
  "ALL",
  "NEW",
  "PARTIALLY_FILLED",
  "FILLED",
  "CANCELED",
  "REJECTED",
] as const;
export const ORDER_PAGE_SIZE = 8;
export const OPEN_ORDER_STATUSES = ["NEW", "PARTIALLY_FILLED"] as const;
export const HISTORY_ORDER_STATUSES = [
  "FILLED",
  "CANCELED",
  "REJECTED",
] as const;

export type OrderViewTab = (typeof ORDER_VIEW_TABS)[number];
export type OrderSortOption = (typeof ORDER_SORT_OPTIONS)[number];
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
export type SymbolOption = (typeof SYMBOL_OPTIONS)[number];
