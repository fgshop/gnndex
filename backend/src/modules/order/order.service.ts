import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma, WalletLedgerEntryType } from "@prisma/client";
import { Observable, catchError, from, map, of, switchMap, timer } from "rxjs";
import { PrismaService } from "../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders.dto";
import { StreamOrdersQueryDto } from "./dto/stream-orders.dto";

type StreamOrdersEvent = {
  eventId: string;
  eventType: "user.orders.snapshot" | "user.orders.error";
  eventVersion: number;
  occurredAt: string;
  data:
    | {
        items: Array<{
          orderId: string;
          symbol: string;
          side: "BUY" | "SELL";
          type: "MARKET" | "LIMIT" | "STOP_LIMIT";
          price: string | null;
          quantity: string;
          status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
          createdAt: string;
        }>;
        page: number;
        limit: number;
        total: number;
      }
    | { message: string };
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSymbol(value: string): string {
    return value.trim().toUpperCase();
  }

  private serializeOrder(order: {
    id: string;
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    price: Prisma.Decimal | null;
    quantity: Prisma.Decimal;
    status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
    createdAt: Date;
  }) {
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price?.toString() ?? null,
      quantity: order.quantity.toString(),
      status: order.status,
      createdAt: order.createdAt.toISOString()
    };
  }

  private parseSymbol(symbolInput: string): { symbol: string; baseAsset: string; quoteAsset: string } {
    const symbol = this.normalizeSymbol(symbolInput);
    const [baseAsset, quoteAsset] = symbol.split("-");
    if (!baseAsset || !quoteAsset) {
      throw new BadRequestException("Invalid symbol format, expected BASE-QUOTE");
    }

    return { symbol, baseAsset, quoteAsset };
  }

  private normalizeCreateSymbol(symbolInput: string): string {
    const { symbol, quoteAsset } = this.parseSymbol(symbolInput);
    if (quoteAsset !== "USDT") {
      throw new BadRequestException("Only USDT quote markets are supported");
    }
    return symbol;
  }

  private normalizeOrderQuerySymbol(raw?: string): string | undefined {
    if (!raw?.trim()) {
      return undefined;
    }
    const normalized = this.normalizeSymbol(raw);
    const parts = normalized.split("-");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return normalized;
    }
    if (parts[1] === "KRW") {
      return `${parts[0]}-USDT`;
    }
    return normalized;
  }

  private async lockBalanceForOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CreateOrderDto
  ) {
    const { baseAsset, quoteAsset } = this.parseSymbol(input.symbol);
    const quantity = new Prisma.Decimal(input.quantity);
    const price = input.price ? new Prisma.Decimal(input.price) : null;

    if (input.side === "BUY" && !price) {
      throw new BadRequestException("price is required for BUY orders");
    }

    const lockAsset = input.side === "BUY" ? quoteAsset : baseAsset;
    const lockAmount =
      input.side === "BUY" ? price!.mul(quantity) : new Prisma.Decimal(input.quantity);

    const balance = await tx.walletBalance.findUnique({
      where: {
        userId_asset: {
          userId,
          asset: lockAsset
        }
      }
    });

    if (!balance) {
      throw new BadRequestException(`Balance for ${lockAsset} does not exist`);
    }
    if (balance.available.lt(lockAmount)) {
      throw new BadRequestException("Insufficient available balance");
    }

    const updated = await tx.walletBalance.update({
      where: { id: balance.id },
      data: {
        available: balance.available.sub(lockAmount),
        locked: balance.locked.add(lockAmount)
      }
    });

    await tx.walletLedger.create({
      data: {
        userId,
        asset: lockAsset,
        entryType: WalletLedgerEntryType.ORDER_LOCK,
        amount: lockAmount,
        balanceBefore: balance.available,
        balanceAfter: updated.available,
        referenceType: "ORDER",
        referenceId: "PENDING_CREATE"
      }
    });
  }

  private async unlockBalanceForOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      userId: string;
      symbol: string;
      side: "BUY" | "SELL";
      price: Prisma.Decimal | null;
      quantity: Prisma.Decimal;
    }
  ) {
    const { baseAsset, quoteAsset } = this.parseSymbol(order.symbol);
    const unlockAsset = order.side === "BUY" ? quoteAsset : baseAsset;
    const unlockAmount =
      order.side === "BUY"
        ? (order.price ?? new Prisma.Decimal(0)).mul(order.quantity)
        : order.quantity;

    const balance = await tx.walletBalance.findUnique({
      where: {
        userId_asset: {
          userId: order.userId,
          asset: unlockAsset
        }
      }
    });

    if (!balance) {
      throw new BadRequestException(`Balance for ${unlockAsset} does not exist`);
    }
    if (balance.locked.lt(unlockAmount)) {
      throw new BadRequestException("Insufficient locked balance");
    }

    const updated = await tx.walletBalance.update({
      where: { id: balance.id },
      data: {
        available: balance.available.add(unlockAmount),
        locked: balance.locked.sub(unlockAmount)
      }
    });

    await tx.walletLedger.create({
      data: {
        userId: order.userId,
        asset: unlockAsset,
        entryType: WalletLedgerEntryType.ORDER_UNLOCK,
        amount: unlockAmount,
        balanceBefore: balance.available,
        balanceAfter: updated.available,
        referenceType: "ORDER",
        referenceId: order.id
      }
    });
  }

  async createOrder(userId: string, input: CreateOrderDto) {
    const normalizedSymbol = this.normalizeCreateSymbol(input.symbol);
    const normalizedInput: CreateOrderDto = {
      ...input,
      symbol: normalizedSymbol
    };
    const order = await this.prisma.$transaction(async (tx) => {
      await this.lockBalanceForOrder(tx, userId, normalizedInput);
      const created = await tx.order.create({
        data: {
          userId,
          symbol: normalizedInput.symbol,
          side: normalizedInput.side,
          type: normalizedInput.type,
          price: normalizedInput.price,
          quantity: normalizedInput.quantity
        }
      });

      return created;
    });

    return this.serializeOrder(order);
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { orderId, status: "NOT_FOUND" as const };
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("Cannot cancel another user's order");
    }
    if (order.status !== "NEW" && order.status !== "PARTIALLY_FILLED") {
      throw new BadRequestException("Only open orders can be canceled");
    }

    const canceled = await this.prisma.$transaction(async (tx) => {
      await this.unlockBalanceForOrder(tx, order);
      return tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELED" }
      });
    });

    return {
      orderId: canceled.id,
      status: canceled.status
    };
  }

  async listOrders(userId: string, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const normalizedSymbol = this.normalizeOrderQuerySymbol(query.symbol);
    const sortBy = query.sortBy ?? "CREATED_AT";
    const sortOrder: Prisma.SortOrder = query.sortOrder === "ASC" ? "asc" : "desc";
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const requestedStatuses = query.statuses?.length
      ? Array.from(new Set(query.statuses)) as OrderStatus[]
      : undefined;
    let statusFilter: Prisma.OrderWhereInput["status"] | undefined;
    if (requestedStatuses?.length) {
      if (query.status) {
        const merged = requestedStatuses.filter((status) => status === query.status);
        statusFilter = merged.length === 1 ? merged[0] : { in: [] };
      } else {
        statusFilter = { in: requestedStatuses };
      }
    } else {
      statusFilter = query.status || undefined;
    }

    const where: Prisma.OrderWhereInput = {
      userId,
      symbol: normalizedSymbol || undefined,
      status: statusFilter,
      side: query.side || undefined,
      type: query.type || undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined
    };
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      sortBy === "PRICE"
        ? { price: sortOrder }
        : sortBy === "QUANTITY"
          ? { quantity: sortOrder }
          : { createdAt: sortOrder };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map((order) => this.serializeOrder(order)),
      page,
      limit,
      total
    };
  }

  streamOrders(userId: string, query: StreamOrdersQueryDto): Observable<StreamOrdersEvent> {
    const intervalMs = query.intervalMs ?? 5000;
    const listQuery: ListOrdersQueryDto = {
      page: query.page,
      limit: query.limit,
      symbol: query.symbol,
      status: query.status,
      statuses: query.statuses,
      side: query.side,
      type: query.type,
      fromCreatedAt: query.fromCreatedAt,
      toCreatedAt: query.toCreatedAt,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };
    let sequence = 0;

    return timer(0, intervalMs).pipe(
      switchMap(() =>
        from(this.listOrders(userId, listQuery)).pipe(
          map((orders) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            return {
              eventId: `orders-${userId}-${occurredAt}-${sequence}`,
              eventType: "user.orders.snapshot" as const,
              eventVersion: 1,
              occurredAt,
              data: orders
            };
          }),
          catchError((error: unknown) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            const message =
              error instanceof Error ? error.message : "Failed to stream user orders";
            return of({
              eventId: `orders-error-${userId}-${occurredAt}-${sequence}`,
              eventType: "user.orders.error" as const,
              eventVersion: 1,
              occurredAt,
              data: { message }
            });
          })
        )
      )
    );
  }
}
