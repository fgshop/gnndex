import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import {
  AdminPermission,
  OrderStatus,
  Prisma,
  SupportTicketStatus,
  UserRole,
  UserStatus,
  WalletLedgerEntryType,
  WithdrawalStatus
} from "@prisma/client";
import { randomBytes } from "crypto";
import { Observable, catchError, from, map, of, switchMap, timer } from "rxjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { BroadcastWithdrawalDto } from "./dto/broadcast-withdrawal.dto";
import { CreateCoinListingDto } from "./dto/create-coin-listing.dto";
import { CreateDashboardShareLinkDto } from "./dto/create-dashboard-share-link.dto";
import { DashboardOverviewQueryDto } from "./dto/dashboard-overview.dto";
import { FailWithdrawalDto } from "./dto/fail-withdrawal.dto";
import { ListAdminPermissionsQueryDto } from "./dto/list-admin-permissions.dto";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.dto";
import { ListOrdersQueryDto } from "./dto/list-orders.dto";
import { ListUsersQueryDto } from "./dto/list-users.dto";
import { ListSupportTicketsQueryDto } from "./dto/list-support-tickets.dto";
import { ListWalletLedgerQueryDto } from "./dto/list-wallet-ledger.dto";
import { ListWithdrawalsQueryDto } from "./dto/list-withdrawals.dto";
import { RejectWithdrawalDto } from "./dto/reject-withdrawal.dto";
import { StreamDashboardOverviewQueryDto } from "./dto/stream-dashboard-overview.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { UpdateAdminPermissionsDto } from "./dto/update-admin-permissions.dto";
import { UpdateCoinListingDto } from "./dto/update-coin-listing.dto";
import { UpsertCoinCandlesDto } from "./dto/upsert-coin-candles.dto";
import { ListDepositsQueryDto } from "./dto/list-deposits.dto";
import { CreateAdminDepositDto } from "./dto/create-admin-deposit.dto";

type StreamDashboardOverviewEvent = {
  eventId: string;
  eventType:
    | "admin.dashboard.overview.full"
    | "admin.dashboard.overview.partial"
    | "admin.dashboard.error";
  eventVersion: number;
  occurredAt: string;
  diff: DashboardOverviewDiff | null;
  data:
    | Awaited<ReturnType<AdminService["getDashboardOverview"]>>
    | {
        message: string;
      };
};

type DashboardOverviewDiff = {
  changed: boolean;
  sectionChanges: {
    orders: boolean;
    withdrawals: boolean;
    auditLogs: boolean;
  };
  summaryDelta: {
    openOrdersLoaded: number;
    pendingWithdrawalsLoaded: number;
    riskAlertsLoaded: number;
    adminActionsLoaded: number;
    permissionChangesLoaded: number;
  };
};

type DashboardSectionError = {
  code: "PERMISSION_DENIED" | "SECTION_LOAD_FAILED";
  message: string;
};

type DashboardSharePayload = {
  orderStatus?: string;
  orderSymbol?: string;
  withdrawalStatus?: string;
  auditAction?: string;
  presetSlot?: "default" | "risk-watch" | "compliance";
};

const ORDER_STATUS_VALUES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PARTIALLY_FILLED,
  OrderStatus.FILLED,
  OrderStatus.CANCELED,
  OrderStatus.REJECTED
];

const WITHDRAWAL_STATUS_VALUES: WithdrawalStatus[] = [
  WithdrawalStatus.REQUESTED,
  WithdrawalStatus.REVIEW_PENDING,
  WithdrawalStatus.APPROVED,
  WithdrawalStatus.REJECTED,
  WithdrawalStatus.BROADCASTED,
  WithdrawalStatus.CONFIRMED,
  WithdrawalStatus.FAILED
];

const DASHBOARD_SHARE_CODE_LENGTH = 10;
const DASHBOARD_SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const DASHBOARD_SHARE_DEFAULT_EXPIRES_MINUTES = 60 * 24;
const COIN_CHART_SOURCES = new Set(["BINANCE", "INTERNAL"]);
const INTERNAL_DEFAULT_LISTING_SYMBOLS = new Set(["SBK-USDT", "G99-USDT"]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private parseListingSymbol(symbolInput: string): {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
  } {
    const symbol = symbolInput.trim().toUpperCase();
    const [baseAsset, quoteAsset] = symbol.split("-");
    if (!baseAsset || !quoteAsset) {
      throw new BadRequestException("Invalid symbol format, expected BASE-QUOTE");
    }
    if (quoteAsset !== "USDT" && quoteAsset !== "KRW") {
      throw new BadRequestException("Only USDT or KRW quote asset is supported");
    }
    return { symbol, baseAsset, quoteAsset };
  }

  private normalizeChartSource(input?: string | null, fallback = "BINANCE"): string {
    const normalized = input?.trim().toUpperCase() || fallback;
    if (!COIN_CHART_SOURCES.has(normalized)) {
      throw new BadRequestException("chartSource must be BINANCE or INTERNAL");
    }
    return normalized;
  }

  private async resolveAdminEmail(adminUserId: string): Promise<string | null> {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true }
    });

    return admin?.email ?? null;
  }

  private randomDashboardShareCode(length = DASHBOARD_SHARE_CODE_LENGTH): string {
    const bytes = randomBytes(length);
    let code = "";

    for (let i = 0; i < length; i += 1) {
      code += DASHBOARD_SHARE_CODE_ALPHABET[bytes[i] % DASHBOARD_SHARE_CODE_ALPHABET.length];
    }

    return code;
  }

  private normalizeDashboardSharePayload(input: CreateDashboardShareLinkDto): DashboardSharePayload {
    const normalize = (value?: string): string | undefined => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return undefined;
      }
      return trimmed;
    };
    const presetSlot = input.presetSlot;

    const payload: DashboardSharePayload = {
      orderStatus: normalize(input.orderStatus),
      orderSymbol: normalize(input.orderSymbol),
      withdrawalStatus: normalize(input.withdrawalStatus),
      auditAction: normalize(input.auditAction),
      ...(presetSlot && presetSlot !== "default" ? { presetSlot } : {})
    };

    const hasActiveFilters =
      Boolean(payload.orderStatus) ||
      Boolean(payload.orderSymbol) ||
      Boolean(payload.withdrawalStatus) ||
      Boolean(payload.auditAction) ||
      Boolean(payload.presetSlot);
    if (!hasActiveFilters) {
      throw new BadRequestException(
        "At least one dashboard filter or non-default presetSlot is required"
      );
    }

    return payload;
  }

  private buildDashboardOverviewDiff(
    previous: Awaited<ReturnType<AdminService["getDashboardOverview"]>> | null,
    current: Awaited<ReturnType<AdminService["getDashboardOverview"]>>
  ): DashboardOverviewDiff {
    if (!previous) {
      return {
        changed: false,
        sectionChanges: {
          orders: false,
          withdrawals: false,
          auditLogs: false
        },
        summaryDelta: {
          openOrdersLoaded: 0,
          pendingWithdrawalsLoaded: 0,
          riskAlertsLoaded: 0,
          adminActionsLoaded: 0,
          permissionChangesLoaded: 0
        }
      };
    }

    const ordersChanged =
      previous.orders.items.length !== current.orders.items.length ||
      previous.orders.permissionDenied !== current.orders.permissionDenied ||
      (previous.orders.partialError?.code ?? null) !== (current.orders.partialError?.code ?? null) ||
      (previous.orders.items[0]?.orderId ?? null) !== (current.orders.items[0]?.orderId ?? null);
    const withdrawalsChanged =
      previous.withdrawals.items.length !== current.withdrawals.items.length ||
      previous.withdrawals.permissionDenied !== current.withdrawals.permissionDenied ||
      (previous.withdrawals.partialError?.code ?? null) !==
        (current.withdrawals.partialError?.code ?? null) ||
      (previous.withdrawals.items[0]?.withdrawalId ?? null) !==
        (current.withdrawals.items[0]?.withdrawalId ?? null);
    const auditLogsChanged =
      previous.auditLogs.items.length !== current.auditLogs.items.length ||
      previous.auditLogs.permissionDenied !== current.auditLogs.permissionDenied ||
      (previous.auditLogs.partialError?.code ?? null) !==
        (current.auditLogs.partialError?.code ?? null) ||
      (previous.auditLogs.items[0]?.id ?? null) !== (current.auditLogs.items[0]?.id ?? null);

    return {
      changed: ordersChanged || withdrawalsChanged || auditLogsChanged,
      sectionChanges: {
        orders: ordersChanged,
        withdrawals: withdrawalsChanged,
        auditLogs: auditLogsChanged
      },
      summaryDelta: {
        openOrdersLoaded: current.summary.openOrdersLoaded - previous.summary.openOrdersLoaded,
        pendingWithdrawalsLoaded:
          current.summary.pendingWithdrawalsLoaded - previous.summary.pendingWithdrawalsLoaded,
        riskAlertsLoaded: current.summary.riskAlertsLoaded - previous.summary.riskAlertsLoaded,
        adminActionsLoaded: current.summary.adminActionsLoaded - previous.summary.adminActionsLoaded,
        permissionChangesLoaded:
          current.summary.permissionChangesLoaded - previous.summary.permissionChangesLoaded
      }
    };
  }

  async createDashboardShareLink(input: CreateDashboardShareLinkDto, adminUserId: string) {
    const payload = this.normalizeDashboardSharePayload(input);
    const expiresInMinutes = input.expiresInMinutes ?? DASHBOARD_SHARE_DEFAULT_EXPIRES_MINUTES;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    let created:
      | {
          id: string;
          code: string;
          expiresAt: Date;
          createdAt: Date;
        }
      | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.randomDashboardShareCode();
      const existing = await this.prisma.dashboardShareLink.findUnique({
        where: { code },
        select: { id: true }
      });

      if (existing) {
        continue;
      }

      created = await this.prisma.dashboardShareLink.create({
        data: {
          code,
          createdByUserId: adminUserId,
          payload: payload as Prisma.InputJsonValue,
          expiresAt
        },
        select: {
          id: true,
          code: true,
          expiresAt: true,
          createdAt: true
        }
      });
      break;
    }

    if (!created) {
      throw new InternalServerErrorException("Failed to create dashboard share link");
    }

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_DASHBOARD_SHARE_LINK_CREATED",
      targetType: "DASHBOARD_SHARE_LINK",
      targetId: created.id,
      metadata: {
        code: created.code,
        expiresAt: created.expiresAt.toISOString(),
        payload
      }
    });

    return {
      shareCode: created.code,
      sharePath: `/admin/dashboard?share=${created.code}`,
      expiresAt: created.expiresAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      payload
    };
  }

  async getDashboardShareLink(shareCode: string, adminUserId: string) {
    const code = shareCode.trim();
    if (!code) {
      throw new BadRequestException("shareCode is required");
    }

    const link = await this.prisma.dashboardShareLink.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        payload: true,
        expiresAt: true,
        createdAt: true
      }
    });

    if (!link) {
      throw new NotFoundException("Dashboard share link not found");
    }

    const now = new Date();
    if (link.expiresAt.getTime() <= now.getTime()) {
      throw new GoneException("Dashboard share link expired");
    }

    await this.prisma.dashboardShareLink.update({
      where: { id: link.id },
      data: { lastAccessedAt: now }
    });

    const payload =
      typeof link.payload === "object" && link.payload !== null
        ? (link.payload as DashboardSharePayload)
        : ({} as DashboardSharePayload);

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_DASHBOARD_SHARE_LINK_RESOLVED",
      targetType: "DASHBOARD_SHARE_LINK",
      targetId: link.id,
      metadata: {
        code: link.code
      }
    });

    return {
      shareCode: link.code,
      expiresAt: link.expiresAt.toISOString(),
      createdAt: link.createdAt.toISOString(),
      payload
    };
  }

  async getDashboardOverview(query: DashboardOverviewQueryDto, adminUserId: string) {
    const limit = query.limit ?? 10;
    const orderStatusFilter = query.orderStatus?.trim().toUpperCase() ?? "";
    const orderSymbolFilter = query.orderSymbol?.trim().toUpperCase() ?? "";
    const withdrawalStatusFilter = query.withdrawalStatus?.trim().toUpperCase() ?? "";
    const auditActionFilter = query.auditAction?.trim().toUpperCase() ?? "";
    const exactOrderStatus = ORDER_STATUS_VALUES.find((status) => status === orderStatusFilter);
    const exactWithdrawalStatus = WITHDRAWAL_STATUS_VALUES.find(
      (status) => status === withdrawalStatusFilter
    );
    const permissions = await this.prisma.adminPermissionGrant.findMany({
      where: { userId: adminUserId },
      select: { permission: true }
    });
    const granted = new Set(permissions.map((row) => row.permission));

    const fallbackPagination = {
      page: 1,
      limit,
      total: 0,
      totalPages: 1
    };
    const toErrorMessage = (error: unknown, fallback: string): string =>
      error instanceof Error && error.message ? error.message : fallback;
    const permissionError = (permission: string): DashboardSectionError => ({
      code: "PERMISSION_DENIED",
      message: `Missing permission: ${permission}`
    });
    const sectionLoadError = (error: unknown, fallback: string): DashboardSectionError => ({
      code: "SECTION_LOAD_FAILED",
      message: toErrorMessage(error, fallback)
    });

    const [ordersResult, withdrawalsResult, auditLogsResult] = await Promise.all([
      (async () => {
        if (!granted.has(AdminPermission.ORDER_READ)) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: true,
            partialError: permissionError("ORDER_READ")
          };
        }

        try {
          const payload = await this.listOrders({
            page: 1,
            limit,
            symbol: orderSymbolFilter || undefined,
            status: exactOrderStatus
          });
          return {
            ...payload,
            permissionDenied: false,
            partialError: null
          };
        } catch (error) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: false,
            partialError: sectionLoadError(error, "Failed to load orders section")
          };
        }
      })(),
      (async () => {
        if (!granted.has(AdminPermission.WITHDRAWAL_READ)) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: true,
            partialError: permissionError("WITHDRAWAL_READ")
          };
        }

        try {
          const payload = await this.listWithdrawals({
            page: 1,
            limit,
            status: exactWithdrawalStatus
          });
          return {
            ...payload,
            permissionDenied: false,
            partialError: null
          };
        } catch (error) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: false,
            partialError: sectionLoadError(error, "Failed to load withdrawals section")
          };
        }
      })(),
      (async () => {
        if (!granted.has(AdminPermission.AUDIT_LOG_READ)) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: true,
            partialError: permissionError("AUDIT_LOG_READ")
          };
        }

        try {
          const payload = await this.listAuditLogs({
            page: 1,
            limit,
            action: auditActionFilter || undefined
          });
          return {
            ...payload,
            permissionDenied: false,
            partialError: null
          };
        } catch (error) {
          return {
            items: [],
            pagination: fallbackPagination,
            permissionDenied: false,
            partialError: sectionLoadError(error, "Failed to load audit logs section")
          };
        }
      })()
    ]);

    const filteredOrders = ordersResult.items.filter((item) => {
      const matchesStatus = !orderStatusFilter || item.status.toUpperCase().includes(orderStatusFilter);
      const matchesSymbol = !orderSymbolFilter || item.symbol.toUpperCase().includes(orderSymbolFilter);
      return matchesStatus && matchesSymbol;
    });
    const filteredWithdrawals = withdrawalsResult.items.filter((item) => {
      if (!withdrawalStatusFilter) {
        return true;
      }
      return item.status.toUpperCase().includes(withdrawalStatusFilter);
    });
    const filteredAuditLogs = auditLogsResult.items.filter((item) => {
      if (!auditActionFilter) {
        return true;
      }
      return (item.action ?? "").toUpperCase().includes(auditActionFilter);
    });

    const summary = {
      openOrdersLoaded: filteredOrders.filter(
        (item) => item.status === "NEW" || item.status === "PARTIALLY_FILLED"
      ).length,
      pendingWithdrawalsLoaded: filteredWithdrawals.filter((item) =>
        ["REQUESTED", "REVIEW_PENDING", "APPROVED", "BROADCASTED"].includes(item.status)
      ).length,
      riskAlertsLoaded: filteredWithdrawals.filter(
        (item) => item.status === "FAILED" || item.status === "REJECTED"
      ).length,
      adminActionsLoaded: filteredAuditLogs.length,
      permissionChangesLoaded: filteredAuditLogs.filter(
        (item) => item.action === "ADMIN_PERMISSIONS_UPDATED"
      ).length
    };

    return {
      generatedAt: new Date().toISOString(),
      permissions: {
        orderRead: granted.has(AdminPermission.ORDER_READ),
        withdrawalRead: granted.has(AdminPermission.WITHDRAWAL_READ),
        auditLogRead: granted.has(AdminPermission.AUDIT_LOG_READ)
      },
      summary,
      orders: {
        items: filteredOrders,
        pagination: ordersResult.pagination,
        permissionDenied: ordersResult.permissionDenied,
        partialError: ordersResult.partialError
      },
      withdrawals: {
        items: filteredWithdrawals,
        pagination: withdrawalsResult.pagination,
        permissionDenied: withdrawalsResult.permissionDenied,
        partialError: withdrawalsResult.partialError
      },
      auditLogs: {
        items: filteredAuditLogs,
        pagination: auditLogsResult.pagination,
        permissionDenied: auditLogsResult.permissionDenied,
        partialError: auditLogsResult.partialError
      }
    };
  }

  streamDashboardOverview(
    query: StreamDashboardOverviewQueryDto,
    adminUserId: string
  ): Observable<StreamDashboardOverviewEvent> {
    const intervalMs = query.intervalMs ?? 5000;
    const listQuery: DashboardOverviewQueryDto = {
      limit: query.limit,
      orderStatus: query.orderStatus,
      orderSymbol: query.orderSymbol,
      withdrawalStatus: query.withdrawalStatus,
      auditAction: query.auditAction
    };
    let sequence = 0;
    let previousPayload: Awaited<ReturnType<AdminService["getDashboardOverview"]>> | null = null;

    return timer(0, intervalMs).pipe(
      switchMap(() =>
        from(this.getDashboardOverview(listQuery, adminUserId)).pipe(
          map((payload) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            const diff = this.buildDashboardOverviewDiff(previousPayload, payload);
            previousPayload = payload;
            const hasPartial =
              payload.orders.partialError !== null ||
              payload.withdrawals.partialError !== null ||
              payload.auditLogs.partialError !== null;
            return {
              eventId: `admin-dashboard-${adminUserId}-${occurredAt}-${sequence}`,
              eventType: hasPartial
                ? ("admin.dashboard.overview.partial" as const)
                : ("admin.dashboard.overview.full" as const),
              eventVersion: 2,
              occurredAt,
              diff,
              data: payload
            };
          }),
          catchError((error: unknown) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            return of({
              eventId: `admin-dashboard-error-${adminUserId}-${occurredAt}-${sequence}`,
              eventType: "admin.dashboard.error" as const,
              eventVersion: 2,
              occurredAt,
              diff: null,
              data: {
                message:
                  error instanceof Error ? error.message : "Failed to stream dashboard overview"
              }
            });
          })
        )
      )
    );
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.UserWhereInput = {
      email: query.email ? { contains: query.email } : undefined,
      status: query.status ? (query.status as UserStatus) : undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          security: {
            select: {
              twoFactorEnabled: true
            }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map((user) => ({
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        twoFactorEnabled: user.security?.twoFactorEnabled ?? false,
        createdAt: user.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async listOrders(query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      symbol: query.symbol ? { contains: query.symbol } : undefined,
      status: query.status ? (query.status as OrderStatus) : undefined,
      user: query.email
        ? {
            email: {
              contains: query.email
            }
          }
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: items.map((order) => ({
        orderId: order.id,
        email: order.user.email,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: order.price?.toString() ?? null,
        quantity: order.quantity.toString(),
        createdAt: order.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async getMyPermissions(adminUserId: string) {
    const grants = await this.prisma.adminPermissionGrant.findMany({
      where: { userId: adminUserId },
      select: { permission: true },
      orderBy: { permission: "asc" }
    });

    return {
      permissions: grants.map((row) => row.permission)
    };
  }

  async listCoinListings() {
    const rows = await this.prisma.coinListing.findMany({
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

    return {
      items: rows.map((row) => ({
        symbol: row.symbol,
        baseAsset: row.baseAsset,
        quoteAsset: row.quoteAsset,
        chartSource: row.chartSource.trim().toUpperCase(),
        isActive: row.isActive,
        displayOrder: row.displayOrder,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      })),
      total: rows.length
    };
  }

  async createCoinListing(input: CreateCoinListingDto, adminUserId: string) {
    const { symbol, baseAsset, quoteAsset } = this.parseListingSymbol(input.symbol);
    const chartSource = this.normalizeChartSource(
      input.chartSource,
      INTERNAL_DEFAULT_LISTING_SYMBOLS.has(symbol) ? "INTERNAL" : "BINANCE"
    );
    const isActive = input.isActive ?? true;
    const displayOrder = input.displayOrder ?? 0;

    const listing = await this.prisma.coinListing.upsert({
      where: { symbol },
      create: {
        symbol,
        baseAsset,
        quoteAsset,
        chartSource,
        isActive,
        displayOrder
      },
      update: {
        baseAsset,
        quoteAsset,
        chartSource,
        isActive,
        displayOrder
      },
      select: {
        id: true,
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

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_COIN_LISTING_UPSERTED",
      targetType: "COIN_LISTING",
      targetId: listing.id,
      metadata: {
        symbol,
        chartSource,
        isActive,
        displayOrder
      }
    });

    return {
      symbol: listing.symbol,
      baseAsset: listing.baseAsset,
      quoteAsset: listing.quoteAsset,
      chartSource: listing.chartSource.trim().toUpperCase(),
      isActive: listing.isActive,
      displayOrder: listing.displayOrder,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString()
    };
  }

  async updateCoinListing(symbolInput: string, input: UpdateCoinListingDto, adminUserId: string) {
    const { symbol } = this.parseListingSymbol(symbolInput);
    const existing = await this.prisma.coinListing.findUnique({
      where: { symbol },
      select: {
        id: true,
        symbol: true,
        baseAsset: true,
        quoteAsset: true,
        chartSource: true,
        isActive: true,
        displayOrder: true
      }
    });
    if (!existing) {
      throw new NotFoundException("Coin listing not found");
    }

    const data: Prisma.CoinListingUpdateInput = {};
    if (typeof input.chartSource === "string") {
      data.chartSource = this.normalizeChartSource(input.chartSource);
    }
    if (typeof input.isActive === "boolean") {
      data.isActive = input.isActive;
    }
    if (typeof input.displayOrder === "number") {
      data.displayOrder = input.displayOrder;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No coin listing fields to update");
    }

    const updated = await this.prisma.coinListing.update({
      where: { symbol },
      data,
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

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_COIN_LISTING_UPDATED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {
        previous: {
          chartSource: existing.chartSource,
          isActive: existing.isActive,
          displayOrder: existing.displayOrder
        },
        next: {
          chartSource: updated.chartSource,
          isActive: updated.isActive,
          displayOrder: updated.displayOrder
        }
      }
    });

    return {
      symbol: updated.symbol,
      baseAsset: updated.baseAsset,
      quoteAsset: updated.quoteAsset,
      chartSource: updated.chartSource.trim().toUpperCase(),
      isActive: updated.isActive,
      displayOrder: updated.displayOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async upsertCoinCandles(symbolInput: string, input: UpsertCoinCandlesDto, adminUserId: string) {
    const { symbol, baseAsset, quoteAsset } = this.parseListingSymbol(symbolInput);
    const interval = input.interval;
    const replaceExisting = input.replaceExisting ?? false;
    const candles = input.candles;

    const normalizedRows = candles.map((row) => {
      const openTime = new Date(row.openTime);
      const closeTime = new Date(row.closeTime);
      if (Number.isNaN(openTime.getTime()) || Number.isNaN(closeTime.getTime())) {
        throw new BadRequestException("Invalid candle time format");
      }
      if (openTime.getTime() >= closeTime.getTime()) {
        throw new BadRequestException("openTime must be before closeTime");
      }

      const open = new Prisma.Decimal(row.open);
      const high = new Prisma.Decimal(row.high);
      const low = new Prisma.Decimal(row.low);
      const close = new Prisma.Decimal(row.close);
      const volume = new Prisma.Decimal(row.volume);

      if (high.lt(low)) {
        throw new BadRequestException("candle high must be >= low");
      }
      if (open.lt(low) || open.gt(high) || close.lt(low) || close.gt(high)) {
        throw new BadRequestException("open/close must be within high-low range");
      }
      if (volume.lt(0)) {
        throw new BadRequestException("volume must be >= 0");
      }

      return {
        symbol,
        interval,
        openTime,
        closeTime,
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume: volume.toString()
      };
    });

    const dedupedMap = new Map<string, (typeof normalizedRows)[number]>();
    for (const row of normalizedRows) {
      dedupedMap.set(row.openTime.toISOString(), row);
    }
    const dedupedRows = [...dedupedMap.values()];

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.coinListing.upsert({
        where: { symbol },
        create: {
          symbol,
          baseAsset,
          quoteAsset,
          chartSource: "INTERNAL",
          isActive: true,
          displayOrder: 0
        },
        update: {
          baseAsset,
          quoteAsset,
          chartSource: "INTERNAL"
        }
      });

      if (replaceExisting) {
        await tx.internalCandle.deleteMany({
          where: { symbol, interval }
        });
      }

      const writeResult = await tx.internalCandle.createMany({
        data: dedupedRows,
        skipDuplicates: true
      });

      return {
        inserted: writeResult.count,
        received: candles.length,
        deduped: dedupedRows.length
      };
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_COIN_CANDLES_UPSERTED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {
        symbol,
        interval,
        replaceExisting,
        received: result.received,
        deduped: result.deduped,
        inserted: result.inserted
      }
    });

    return {
      symbol,
      interval,
      replaceExisting,
      received: result.received,
      deduped: result.deduped,
      inserted: result.inserted
    };
  }

  async listAdminPermissions(query: ListAdminPermissionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.UserWhereInput = {
      role: UserRole.ADMIN,
      email: query.email ? { contains: query.email } : undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          adminPermissions: {
            select: { permission: true },
            orderBy: { permission: "asc" }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map((user) => ({
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.adminPermissions.map((grant) => grant.permission)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async updateAdminPermissions(
    userId: string,
    input: UpdateAdminPermissionsDto,
    adminUserId: string
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminPermissions: {
          select: { permission: true }
        }
      }
    });

    if (!target) {
      throw new NotFoundException("Target admin user not found");
    }
    if (target.role !== UserRole.ADMIN) {
      throw new BadRequestException("Permissions can be assigned only to ADMIN role users");
    }

    const previousPermissions = target.adminPermissions
      .map((grant) => grant.permission)
      .sort();
    const nextPermissions = Array.from(new Set(input.permissions)).sort() as AdminPermission[];
    const hasWritePermission = nextPermissions.includes(AdminPermission.ADMIN_PERMISSION_WRITE);

    if (target.id === adminUserId && !hasWritePermission) {
      throw new BadRequestException(
        "You cannot remove ADMIN_PERMISSION_WRITE from your own account"
      );
    }

    if (!hasWritePermission) {
      const otherWriteHolders = await this.prisma.adminPermissionGrant.count({
        where: {
          permission: AdminPermission.ADMIN_PERMISSION_WRITE,
          userId: {
            not: target.id
          },
          user: {
            role: UserRole.ADMIN
          }
        }
      });

      if (otherWriteHolders === 0) {
        throw new BadRequestException(
          "At least one admin must retain ADMIN_PERMISSION_WRITE"
        );
      }
    }

    const updatedPermissions = await this.prisma.$transaction(async (tx) => {
      await tx.adminPermissionGrant.deleteMany({
        where: { userId: target.id }
      });

      if (nextPermissions.length > 0) {
        await tx.adminPermissionGrant.createMany({
          data: nextPermissions.map((permission) => ({
            userId: target.id,
            permission,
            grantedByUserId: adminUserId
          })),
          skipDuplicates: true
        });
      }

      const grants = await tx.adminPermissionGrant.findMany({
        where: { userId: target.id },
        select: { permission: true },
        orderBy: { permission: "asc" }
      });

      return grants.map((grant) => grant.permission);
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_PERMISSIONS_UPDATED",
      targetType: "USER",
      targetId: target.id,
      metadata: {
        previousPermissions,
        nextPermissions: updatedPermissions
      }
    });

    return {
      userId: target.id,
      email: target.email,
      permissions: updatedPermissions
    };
  }

  async listWalletLedger(query: ListWalletLedgerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletLedgerWhereInput = {
      asset: query.asset ? { equals: query.asset } : undefined,
      entryType: query.entryType ? query.entryType : undefined,
      user: query.email
        ? {
            email: {
              contains: query.email
            }
          }
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      this.prisma.walletLedger.count({ where })
    ]);

    return {
      items: items.map((ledger) => ({
        id: ledger.id,
        email: ledger.user.email,
        asset: ledger.asset,
        entryType: ledger.entryType,
        amount: ledger.amount.toString(),
        balanceBefore: ledger.balanceBefore.toString(),
        balanceAfter: ledger.balanceAfter.toString(),
        referenceType: ledger.referenceType,
        referenceId: ledger.referenceId,
        createdAt: ledger.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async listWithdrawals(query: ListWithdrawalsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromRequestedAt = query.fromRequestedAt ? new Date(query.fromRequestedAt) : undefined;
    const toRequestedAt = query.toRequestedAt ? new Date(query.toRequestedAt) : undefined;

    if (fromRequestedAt && toRequestedAt && fromRequestedAt.getTime() > toRequestedAt.getTime()) {
      throw new BadRequestException("fromRequestedAt must be less than or equal to toRequestedAt");
    }

    const where: Prisma.WithdrawalWhereInput = {
      asset: query.asset ? { equals: query.asset } : undefined,
      network: query.network ? { equals: query.network } : undefined,
      status: query.status ? (query.status as WithdrawalStatus) : undefined,
      requestedAt: fromRequestedAt || toRequestedAt ? { gte: fromRequestedAt, lte: toRequestedAt } : undefined,
      user: query.email
        ? {
            email: {
              contains: query.email
            }
          }
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      this.prisma.withdrawal.count({ where })
    ]);

    return {
      items: items.map((row) => ({
        withdrawalId: row.id,
        email: row.user.email,
        asset: row.asset,
        network: row.network,
        amount: row.amount.toString(),
        fee: row.fee.toString(),
        address: row.address,
        status: row.status,
        txHash: row.txHash,
        rejectReason: row.rejectReason,
        failureReason: row.failureReason,
        reviewedByUserId: row.reviewedByUserId,
        requestedAt: row.requestedAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        broadcastedAt: row.broadcastedAt?.toISOString() ?? null,
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        failedAt: row.failedAt?.toISOString() ?? null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async approveWithdrawal(withdrawalId: string, adminUserId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }
    if (
      withdrawal.status !== WithdrawalStatus.REQUESTED &&
      withdrawal.status !== WithdrawalStatus.REVIEW_PENDING
    ) {
      throw new BadRequestException("Only pending withdrawals can be approved");
    }

    const approved = await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: WithdrawalStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId
      }
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "WITHDRAWAL_APPROVED",
      targetType: "WITHDRAWAL",
      targetId: approved.id,
      metadata: {
        previousStatus: withdrawal.status,
        nextStatus: approved.status
      }
    });

    return {
      withdrawalId: approved.id,
      status: approved.status,
      reviewedAt: approved.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: approved.reviewedByUserId
    };
  }

  async rejectWithdrawal(
    withdrawalId: string,
    input: RejectWithdrawalDto,
    adminUserId: string
  ) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }
    if (
      withdrawal.status !== WithdrawalStatus.REQUESTED &&
      withdrawal.status !== WithdrawalStatus.REVIEW_PENDING
    ) {
      throw new BadRequestException("Only pending withdrawals can be rejected");
    }

    const rejected = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.walletBalance.findUnique({
        where: {
          userId_asset: {
            userId: withdrawal.userId,
            asset: withdrawal.asset
          }
        }
      });

      if (!balance) {
        throw new BadRequestException("Wallet balance is missing");
      }

      const unlockAmount = withdrawal.amount.add(withdrawal.fee);
      if (balance.locked.lt(unlockAmount)) {
        throw new BadRequestException("Insufficient locked balance to reject withdrawal");
      }

      const updatedBalance = await tx.walletBalance.update({
        where: { id: balance.id },
        data: {
          available: balance.available.add(unlockAmount),
          locked: balance.locked.sub(unlockAmount)
        }
      });

      const row = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.REJECTED,
          rejectReason: input.reason,
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId
        }
      });

      await tx.walletLedger.create({
        data: {
          userId: withdrawal.userId,
          asset: withdrawal.asset,
          entryType: WalletLedgerEntryType.ADJUSTMENT,
          amount: unlockAmount,
          balanceBefore: balance.available,
          balanceAfter: updatedBalance.available,
          referenceType: "WITHDRAWAL_REJECT_UNLOCK",
          referenceId: withdrawal.id
        }
      });

      return row;
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "WITHDRAWAL_REJECTED",
      targetType: "WITHDRAWAL",
      targetId: rejected.id,
      metadata: {
        previousStatus: withdrawal.status,
        nextStatus: rejected.status,
        rejectReason: rejected.rejectReason
      }
    });

    return {
      withdrawalId: rejected.id,
      status: rejected.status,
      rejectReason: rejected.rejectReason,
      reviewedAt: rejected.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: rejected.reviewedByUserId
    };
  }

  async broadcastWithdrawal(
    withdrawalId: string,
    input: BroadcastWithdrawalDto,
    adminUserId: string
  ) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }
    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED withdrawals can be broadcasted");
    }

    const broadcasted = await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: WithdrawalStatus.BROADCASTED,
        txHash: input.txHash,
        broadcastedAt: new Date(),
        reviewedByUserId: adminUserId
      }
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "WITHDRAWAL_BROADCASTED",
      targetType: "WITHDRAWAL",
      targetId: broadcasted.id,
      metadata: {
        previousStatus: withdrawal.status,
        nextStatus: broadcasted.status,
        txHash: broadcasted.txHash
      }
    });

    return {
      withdrawalId: broadcasted.id,
      status: broadcasted.status,
      txHash: broadcasted.txHash,
      broadcastedAt: broadcasted.broadcastedAt?.toISOString() ?? null
    };
  }

  async confirmWithdrawal(withdrawalId: string, adminUserId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }
    if (
      withdrawal.status !== WithdrawalStatus.BROADCASTED &&
      withdrawal.status !== WithdrawalStatus.APPROVED
    ) {
      throw new BadRequestException("Only APPROVED/BROADCASTED withdrawals can be confirmed");
    }

    const total = withdrawal.amount.add(withdrawal.fee);

    const confirmed = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.walletBalance.findUnique({
        where: {
          userId_asset: {
            userId: withdrawal.userId,
            asset: withdrawal.asset
          }
        }
      });

      if (!balance) {
        throw new BadRequestException("Wallet balance is missing");
      }
      if (balance.locked.lt(total)) {
        throw new BadRequestException("Insufficient locked balance to confirm withdrawal");
      }

      await tx.walletBalance.update({
        where: { id: balance.id },
        data: {
          locked: balance.locked.sub(total)
        }
      });

      await tx.walletLedger.create({
        data: {
          userId: withdrawal.userId,
          asset: withdrawal.asset,
          entryType: WalletLedgerEntryType.WITHDRAWAL,
          amount: total,
          balanceBefore: balance.available,
          balanceAfter: balance.available,
          referenceType: "WITHDRAWAL_CONFIRMED",
          referenceId: withdrawal.id
        }
      });

      return tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.CONFIRMED,
          confirmedAt: new Date(),
          reviewedByUserId: adminUserId
        }
      });
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "WITHDRAWAL_CONFIRMED",
      targetType: "WITHDRAWAL",
      targetId: confirmed.id,
      metadata: {
        previousStatus: withdrawal.status,
        nextStatus: confirmed.status
      }
    });

    return {
      withdrawalId: confirmed.id,
      status: confirmed.status,
      confirmedAt: confirmed.confirmedAt?.toISOString() ?? null
    };
  }

  async failWithdrawal(withdrawalId: string, input: FailWithdrawalDto, adminUserId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }
    if (
      withdrawal.status !== WithdrawalStatus.APPROVED &&
      withdrawal.status !== WithdrawalStatus.BROADCASTED
    ) {
      throw new BadRequestException("Only APPROVED/BROADCASTED withdrawals can be failed");
    }

    const total = withdrawal.amount.add(withdrawal.fee);

    const failed = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.walletBalance.findUnique({
        where: {
          userId_asset: {
            userId: withdrawal.userId,
            asset: withdrawal.asset
          }
        }
      });

      if (!balance) {
        throw new BadRequestException("Wallet balance is missing");
      }
      if (balance.locked.lt(total)) {
        throw new BadRequestException("Insufficient locked balance to fail withdrawal");
      }

      const updatedBalance = await tx.walletBalance.update({
        where: { id: balance.id },
        data: {
          available: balance.available.add(total),
          locked: balance.locked.sub(total)
        }
      });

      await tx.walletLedger.create({
        data: {
          userId: withdrawal.userId,
          asset: withdrawal.asset,
          entryType: WalletLedgerEntryType.ADJUSTMENT,
          amount: total,
          balanceBefore: balance.available,
          balanceAfter: updatedBalance.available,
          referenceType: "WITHDRAWAL_FAILED_UNLOCK",
          referenceId: withdrawal.id
        }
      });

      return tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: input.reason,
          failedAt: new Date(),
          reviewedByUserId: adminUserId
        }
      });
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "WITHDRAWAL_FAILED",
      targetType: "WITHDRAWAL",
      targetId: failed.id,
      metadata: {
        previousStatus: withdrawal.status,
        nextStatus: failed.status,
        failureReason: failed.failureReason
      }
    });

    return {
      withdrawalId: failed.id,
      status: failed.status,
      failureReason: failed.failureReason,
      failedAt: failed.failedAt?.toISOString() ?? null
    };
  }

  async listAuditLogs(query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.AuditLogWhereInput = {
      action: query.action ? { contains: query.action } : undefined,
      targetType: query.targetType ? { contains: query.targetType } : undefined,
      actorEmail: query.actorEmail ? { contains: query.actorEmail } : undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        actorEmail: row.actorEmail,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async listSupportTickets(query: ListSupportTicketsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.SupportTicketWhereInput = {
      status: query.status || undefined,
      category: query.category ? { equals: query.category.trim().toUpperCase() } : undefined,
      subject: query.subject ? { contains: query.subject } : undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined,
      user: query.email
        ? {
            email: {
              contains: query.email
            }
          }
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      this.prisma.supportTicket.count({ where })
    ]);

    return {
      items: items.map((row) => ({
        ticketId: row.id,
        userId: row.userId,
        email: row.user.email,
        category: row.category,
        subject: row.subject,
        content: row.content,
        contactEmail: row.contactEmail,
        status: row.status,
        adminReply: row.adminReply,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        repliedAt: row.repliedAt?.toISOString() ?? null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async listDeposits(query: ListDepositsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.WalletLedgerWhereInput = {
      entryType: WalletLedgerEntryType.DEPOSIT,
      asset: query.asset ? { equals: query.asset } : undefined,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined,
      user: query.email
        ? {
            email: {
              contains: query.email
            }
          }
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      this.prisma.walletLedger.count({ where })
    ]);

    return {
      items: items.map((ledger) => ({
        id: ledger.id,
        email: ledger.user.email,
        asset: ledger.asset,
        entryType: ledger.entryType,
        amount: ledger.amount.toString(),
        balanceBefore: ledger.balanceBefore.toString(),
        balanceAfter: ledger.balanceAfter.toString(),
        referenceType: ledger.referenceType,
        referenceId: ledger.referenceId,
        createdAt: ledger.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async createAdminDeposit(input: CreateAdminDepositDto, adminUserId: string) {
    const delta = new Prisma.Decimal(input.amount);
    if (delta.lte(0)) {
      throw new BadRequestException("Amount must be positive");
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true }
    });

    if (!targetUser) {
      throw new NotFoundException("User not found with the provided email");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.walletBalance.upsert({
        where: { userId_asset: { userId: targetUser.id, asset: input.asset } },
        create: {
          userId: targetUser.id,
          asset: input.asset,
          available: delta,
          locked: new Prisma.Decimal(0)
        },
        update: {}
      });

      const balanceBefore = balance.available;
      const balanceAfter = balanceBefore.add(delta);

      const updated = await tx.walletBalance.update({
        where: { id: balance.id },
        data: { available: balanceAfter }
      });

      await tx.walletLedger.create({
        data: {
          userId: targetUser.id,
          asset: input.asset,
          entryType: WalletLedgerEntryType.DEPOSIT,
          amount: delta,
          balanceBefore,
          balanceAfter,
          referenceType: "ADMIN_DEPOSIT",
          referenceId: null
        }
      });

      return {
        asset: updated.asset,
        available: updated.available.toString(),
        locked: updated.locked.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString()
      };
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "ADMIN_DEPOSIT_CREATED",
      targetType: "WALLET_BALANCE",
      targetId: targetUser.id,
      metadata: {
        targetEmail: targetUser.email,
        asset: input.asset,
        amount: input.amount,
        reason: input.reason ?? null,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter
      }
    });

    return {
      email: targetUser.email,
      asset: result.asset,
      amount: input.amount,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter
    };
  }

  async updateSupportTicket(ticketId: string, input: UpdateSupportTicketDto, adminUserId: string) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!existing) {
      throw new NotFoundException("Support ticket not found");
    }

    const normalizedReply = input.adminReply.trim();
    if (!normalizedReply) {
      throw new BadRequestException("adminReply is required");
    }

    const nextStatus = input.status ?? SupportTicketStatus.ANSWERED;
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        adminReply: normalizedReply,
        repliedAt: new Date()
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "SUPPORT_TICKET_UPDATED",
      targetType: "SUPPORT_TICKET",
      targetId: updated.id,
      metadata: {
        previousStatus: existing.status,
        nextStatus: updated.status
      }
    });

    return {
      ticketId: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      category: updated.category,
      subject: updated.subject,
      content: updated.content,
      contactEmail: updated.contactEmail,
      status: updated.status,
      adminReply: updated.adminReply,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      repliedAt: updated.repliedAt?.toISOString() ?? null
    };
  }
}
