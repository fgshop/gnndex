import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { RequestTradeSimulatorLiveApprovalDto } from "./dto/request-trade-simulator-live-approval.dto";
import { ReviewTradeSimulatorLiveApprovalDto } from "./dto/review-trade-simulator-live-approval.dto";
import { UpdateTradeSimulatorDto } from "./dto/update-trade-simulator.dto";

const FEATURE_NAME = "test-trade-simulator";
const MODE_SIMULATION_ONLY = "SIMULATION_ONLY";
const MODE_LIVE_MARKET = "LIVE_MARKET";
const MODE_OPTIONS = [MODE_SIMULATION_ONLY, MODE_LIVE_MARKET] as const;
const LIVE_APPROVAL_STATUS_PENDING = "PENDING";
const LIVE_APPROVAL_STATUS_APPROVED = "APPROVED";
const LIVE_APPROVAL_STATUS_REJECTED = "REJECTED";
const ALLOWED_INTERVALS = [1, 3, 5, 10, 15, 20, 30, 60] as const;
const DEFAULT_INTERVALS = [1, 3, 5, 10, 15, 20, 30, 60];
const DEFAULT_LOG_LIMIT = 30;
const MAX_LOG_LIMIT = 200;
const DEFAULT_APPROVAL_LOG_LIMIT = 20;
const MAX_APPROVAL_LOG_LIMIT = 100;
const LIVE_APPROVAL_EXPIRES_HOURS = 24;
const MAX_LOG_ROWS_PER_SYMBOL = 400;
const LOG_STATUS_SIMULATED = "SIMULATED";
const LOG_STATUS_LIVE_DRYRUN = "LIVE_DRYRUN";

@Injectable()
export class TradeSimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private normalizeSymbol(symbolInput: string): string {
    return symbolInput.trim().toUpperCase();
  }

  private sanitizeIntervals(raw: unknown): number[] {
    if (!Array.isArray(raw)) {
      return [...DEFAULT_INTERVALS];
    }

    const deduped = new Set<number>();
    for (const value of raw) {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        continue;
      }
      if (!ALLOWED_INTERVALS.includes(num as (typeof ALLOWED_INTERVALS)[number])) {
        continue;
      }
      deduped.add(num);
      if (deduped.size >= ALLOWED_INTERVALS.length) {
        break;
      }
    }

    if (deduped.size === 0) {
      return [...DEFAULT_INTERVALS];
    }

    return [...deduped].sort((a, b) => a - b);
  }

  private randomInterval(intervals: number[]): number {
    const list = intervals.length > 0 ? intervals : [...DEFAULT_INTERVALS];
    const idx = Math.floor(Math.random() * list.length);
    return list[idx] ?? list[0] ?? 1;
  }

  private normalizeMode(raw: unknown): string {
    const value = typeof raw === "string" ? raw.trim().toUpperCase() : MODE_SIMULATION_ONLY;
    if ((MODE_OPTIONS as readonly string[]).includes(value)) {
      return value;
    }
    return MODE_SIMULATION_ONLY;
  }

  private normalizeReviewDecision(raw: string): "APPROVE" | "REJECT" {
    const decision = raw.trim().toUpperCase();
    if (decision === "APPROVE" || decision === "REJECT") {
      return decision;
    }
    throw new BadRequestException("decision must be APPROVE or REJECT");
  }

  private isProductionRuntime(): boolean {
    return process.env.NODE_ENV === "production";
  }

  private isLiveExecutionRuntimeAllowed(): boolean {
    return !this.isProductionRuntime();
  }

  private normalizeReason(raw: string, field: "reason" | "reviewReason"): string {
    const value = raw.trim();
    if (!value) {
      throw new BadRequestException(`${field} is required`);
    }
    return value;
  }

  private async getActiveLiveApproval(symbol: string) {
    const now = new Date();
    return this.prisma.tradeSimulationComplianceRequest.findFirst({
      where: {
        symbol,
        status: LIVE_APPROVAL_STATUS_APPROVED,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      orderBy: [{ reviewedAt: "desc" }, { requestedAt: "desc" }],
      select: {
        id: true
      }
    });
  }

  private async canExecuteLiveMode(symbol: string): Promise<boolean> {
    if (!this.isLiveExecutionRuntimeAllowed()) {
      return false;
    }
    const approval = await this.getActiveLiveApproval(symbol);
    return Boolean(approval);
  }

  private toApprovalResponse(
    row: {
      id: string;
      symbol: string;
      requestedMode: string;
      status: string;
      requestedByUserId: string;
      requestedReason: string;
      reviewedByUserId: string | null;
      reviewReason: string | null;
      requestedAt: Date;
      reviewedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      requestedByUser: { email: string } | null;
      reviewedByUser: { email: string } | null;
    },
    now = new Date()
  ) {
    return {
      id: row.id,
      symbol: row.symbol,
      requestedMode: this.normalizeMode(row.requestedMode),
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      requestedByEmail: row.requestedByUser?.email ?? null,
      requestedReason: row.requestedReason,
      reviewedByUserId: row.reviewedByUserId,
      reviewedByEmail: row.reviewedByUser?.email ?? null,
      reviewReason: row.reviewReason,
      requestedAt: row.requestedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      isActive: row.status === LIVE_APPROVAL_STATUS_APPROVED && (row.expiresAt === null || row.expiresAt > now)
    };
  }

  private clearTimer(symbol: string) {
    const timer = this.timers.get(symbol);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(symbol);
    }
  }

  private async ensureListing(symbol: string) {
    const listing = await this.prisma.coinListing.findUnique({
      where: { symbol },
      select: { symbol: true }
    });
    if (!listing) {
      throw new NotFoundException("Coin listing not found");
    }
  }

  private async ensureConfig(symbol: string) {
    return this.prisma.tradeSimulationConfig.upsert({
      where: { symbol },
      create: {
        symbol,
        feature: FEATURE_NAME,
        mode: MODE_SIMULATION_ONLY,
        isEnabled: false,
        intervalPool: DEFAULT_INTERVALS as unknown as Prisma.InputJsonValue,
        nextRunAt: null,
        lastRunAt: null,
        runCount: 0
      },
      update: {
        feature: FEATURE_NAME
      }
    });
  }

  private async pruneLogs(symbol: string) {
    const count = await this.prisma.tradeSimulationLog.count({ where: { symbol } });
    if (count <= MAX_LOG_ROWS_PER_SYMBOL) {
      return;
    }

    const overflow = count - MAX_LOG_ROWS_PER_SYMBOL;
    const staleRows = await this.prisma.tradeSimulationLog.findMany({
      where: { symbol },
      orderBy: { createdAt: "asc" },
      take: overflow,
      select: { id: true }
    });

    if (staleRows.length === 0) {
      return;
    }

    await this.prisma.tradeSimulationLog.deleteMany({
      where: {
        id: { in: staleRows.map((row) => row.id) }
      }
    });
  }

  private async scheduleNextRandom(symbolInput: string) {
    const symbol = this.normalizeSymbol(symbolInput);
    const config = await this.prisma.tradeSimulationConfig.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        isEnabled: true,
        mode: true,
        intervalPool: true
      }
    });

    if (!config || !config.isEnabled) {
      this.clearTimer(symbol);
      return {
        selectedIntervalMin: null,
        nextRunAt: null
      };
    }

    const mode = this.normalizeMode(config.mode);
    if (mode !== MODE_SIMULATION_ONLY && mode !== MODE_LIVE_MARKET) {
      await this.prisma.tradeSimulationConfig.update({ where: { symbol }, data: { isEnabled: false, nextRunAt: null } });
      this.clearTimer(symbol);
      return {
        selectedIntervalMin: null,
        nextRunAt: null
      };
    }

    if (mode === MODE_LIVE_MARKET) {
      const canExecuteLive = await this.canExecuteLiveMode(symbol);
      if (!canExecuteLive) {
        await this.prisma.tradeSimulationConfig.update({
          where: { symbol },
          data: { isEnabled: false, nextRunAt: null }
        });
        this.clearTimer(symbol);
        return {
          selectedIntervalMin: null,
          nextRunAt: null
        };
      }
    }

    const intervals = this.sanitizeIntervals(config.intervalPool);
    const selectedIntervalMin = this.randomInterval(intervals);
    const nextRunAt = new Date(Date.now() + selectedIntervalMin * 60 * 1000);

    await this.prisma.tradeSimulationConfig.update({
      where: { symbol },
      data: { nextRunAt }
    });

    this.clearTimer(symbol);
    const timer = setTimeout(() => {
      void this.executeSimulation(symbol, selectedIntervalMin, nextRunAt);
    }, selectedIntervalMin * 60 * 1000);
    this.timers.set(symbol, timer);

    return {
      selectedIntervalMin,
      nextRunAt: nextRunAt.toISOString()
    };
  }

  private async executeSimulation(symbolInput: string, selectedIntervalMin: number, scheduledAt: Date) {
    const symbol = this.normalizeSymbol(symbolInput);
    this.timers.delete(symbol);

    const config = await this.prisma.tradeSimulationConfig.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        isEnabled: true,
        mode: true
      }
    });

    if (!config || !config.isEnabled) {
      return;
    }

    const mode = this.normalizeMode(config.mode);
    if (mode !== MODE_SIMULATION_ONLY && mode !== MODE_LIVE_MARKET) {
      await this.prisma.tradeSimulationConfig.update({ where: { symbol }, data: { isEnabled: false, nextRunAt: null } });
      return;
    }

    if (mode === MODE_LIVE_MARKET) {
      const canExecuteLive = await this.canExecuteLiveMode(symbol);
      if (!canExecuteLive) {
        await this.prisma.tradeSimulationConfig.update({
          where: { symbol },
          data: { isEnabled: false, nextRunAt: null }
        });
        return;
      }
    }

    const executedAt = new Date();
    const logStatus = mode === MODE_LIVE_MARKET ? LOG_STATUS_LIVE_DRYRUN : LOG_STATUS_SIMULATED;
    const logMessage =
      mode === MODE_LIVE_MARKET
        ? "Live-mode cycle executed in development runtime only. No real market/orderbook mutation was applied."
        : "Simulation event executed. Real market/orderbook was not modified.";

    await this.prisma.$transaction(async (tx) => {
      await tx.tradeSimulationLog.create({
        data: {
          symbol,
          selectedIntervalMin,
          scheduledAt,
          executedAt,
          status: logStatus,
          message: logMessage
        }
      });

      await tx.tradeSimulationConfig.update({
        where: { symbol },
        data: {
          lastRunAt: executedAt,
          nextRunAt: null,
          runCount: { increment: 1 }
        }
      });
    });

    await this.pruneLogs(symbol);
    await this.scheduleNextRandom(symbol);
  }

  async onModuleInit() {
    const configs = await this.prisma.tradeSimulationConfig.findMany({
      where: { isEnabled: true },
      select: { symbol: true }
    });

    for (const row of configs) {
      await this.scheduleNextRandom(row.symbol);
    }
  }

  onModuleDestroy() {
    for (const symbol of this.timers.keys()) {
      this.clearTimer(symbol);
    }
  }

  async getStatus(symbolInput: string, limit?: number) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);
    const config = await this.ensureConfig(symbol);

    const logsLimit = Math.min(Math.max(limit ?? DEFAULT_LOG_LIMIT, 1), MAX_LOG_LIMIT);
    const logs = await this.prisma.tradeSimulationLog.findMany({
      where: { symbol },
      orderBy: { createdAt: "desc" },
      take: logsLimit,
      select: {
        id: true,
        selectedIntervalMin: true,
        scheduledAt: true,
        executedAt: true,
        status: true,
        message: true,
        createdAt: true
      }
    });

    const mode = this.normalizeMode(config.mode);
    const intervals = this.sanitizeIntervals(config.intervalPool);

    return {
      symbol,
      feature: FEATURE_NAME,
      enabled: config.isEnabled,
      mode,
      modeOptions: [...MODE_OPTIONS],
      modeLiveMarketAvailable: true,
      modeLiveMarketRuntimeAllowed: this.isLiveExecutionRuntimeAllowed(),
      intervalCandidates: intervals,
      allowedIntervals: [...ALLOWED_INTERVALS],
      nextRunAt: config.nextRunAt?.toISOString() ?? null,
      lastRunAt: config.lastRunAt?.toISOString() ?? null,
      runCount: config.runCount,
      timerActive: this.timers.has(symbol),
      logs: logs.map((row) => ({
        id: row.id,
        selectedIntervalMin: row.selectedIntervalMin,
        scheduledAt: row.scheduledAt.toISOString(),
        executedAt: row.executedAt.toISOString(),
        status: row.status,
        message: row.message,
        createdAt: row.createdAt.toISOString()
      }))
    };
  }

  async getLiveApprovalStatus(symbolInput: string, limit?: number) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);
    const config = await this.ensureConfig(symbol);

    const historyLimit = Math.min(
      Math.max(limit ?? DEFAULT_APPROVAL_LOG_LIMIT, 1),
      MAX_APPROVAL_LOG_LIMIT
    );

    const [pendingRequest, activeApproval, history] = await this.prisma.$transaction([
      this.prisma.tradeSimulationComplianceRequest.findFirst({
        where: { symbol, status: LIVE_APPROVAL_STATUS_PENDING },
        orderBy: [{ requestedAt: "desc" }],
        include: {
          requestedByUser: { select: { email: true } },
          reviewedByUser: { select: { email: true } }
        }
      }),
      this.prisma.tradeSimulationComplianceRequest.findFirst({
        where: {
          symbol,
          status: LIVE_APPROVAL_STATUS_APPROVED,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        orderBy: [{ reviewedAt: "desc" }, { requestedAt: "desc" }],
        include: {
          requestedByUser: { select: { email: true } },
          reviewedByUser: { select: { email: true } }
        }
      }),
      this.prisma.tradeSimulationComplianceRequest.findMany({
        where: { symbol },
        orderBy: [{ requestedAt: "desc" }],
        take: historyLimit,
        include: {
          requestedByUser: { select: { email: true } },
          reviewedByUser: { select: { email: true } }
        }
      })
    ]);

    const mode = this.normalizeMode(config.mode);
    const now = new Date();
    const executionAvailable =
      mode === MODE_LIVE_MARKET &&
      Boolean(activeApproval) &&
      this.isLiveExecutionRuntimeAllowed();

    return {
      symbol,
      mode,
      modeRequiresApproval: mode === MODE_LIVE_MARKET,
      pendingRequest: pendingRequest ? this.toApprovalResponse(pendingRequest, now) : null,
      activeApproval: activeApproval ? this.toApprovalResponse(activeApproval, now) : null,
      executionAvailable,
      history: history.map((row) => this.toApprovalResponse(row, now))
    };
  }

  async updateSettings(symbolInput: string, input: UpdateTradeSimulatorDto, adminUserId: string) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);

    const existing = await this.ensureConfig(symbol);
    const normalizedMode = this.normalizeMode(input.mode ?? existing.mode);

    const nextIntervals = input.intervalCandidates
      ? this.sanitizeIntervals(input.intervalCandidates)
      : this.sanitizeIntervals(existing.intervalPool);

    let enabled = typeof input.enabled === "boolean" ? input.enabled : existing.isEnabled;
    if (normalizedMode === MODE_LIVE_MARKET) {
      enabled = false;
    }

    const updated = await this.prisma.tradeSimulationConfig.update({
      where: { symbol },
      data: {
        mode: normalizedMode,
        intervalPool: nextIntervals as unknown as Prisma.InputJsonValue,
        isEnabled: enabled,
        nextRunAt: enabled ? undefined : null
      },
      select: {
        symbol: true,
        isEnabled: true,
        mode: true,
        intervalPool: true,
        nextRunAt: true,
        lastRunAt: true,
        runCount: true
      }
    });

    if (enabled) {
      await this.scheduleNextRandom(symbol);
    } else {
      this.clearTimer(symbol);
      await this.prisma.tradeSimulationConfig.update({
        where: { symbol },
        data: { nextRunAt: null }
      });
    }

    await this.auditService.log({
      actorUserId: adminUserId,
      action: "ADMIN_TEST_TRADE_SIMULATOR_UPDATED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {
        enabled,
        intervalCandidates: nextIntervals,
        mode: normalizedMode
      }
    });

    return {
      symbol: updated.symbol,
      enabled: updated.isEnabled,
      mode: normalizedMode,
      intervalCandidates: nextIntervals,
      nextRunAt: updated.nextRunAt?.toISOString() ?? null,
      lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      runCount: updated.runCount
    };
  }

  async start(symbolInput: string, adminUserId: string) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);

    const config = await this.prisma.tradeSimulationConfig.upsert({
      where: { symbol },
      create: {
        symbol,
        feature: FEATURE_NAME,
        mode: MODE_SIMULATION_ONLY,
        isEnabled: true,
        intervalPool: DEFAULT_INTERVALS as unknown as Prisma.InputJsonValue
      },
      update: {
        isEnabled: true
      }
    });

    const mode = this.normalizeMode(config.mode);
    if (mode === MODE_LIVE_MARKET) {
      const liveApproval = await this.getActiveLiveApproval(symbol);
      if (!liveApproval) {
        await this.prisma.tradeSimulationConfig.update({
          where: { symbol },
          data: { isEnabled: false, nextRunAt: null }
        });
        throw new BadRequestException(
          "LIVE_MARKET mode requires compliance approval first. Request and approve before start."
        );
      }
      if (!this.isLiveExecutionRuntimeAllowed()) {
        await this.prisma.tradeSimulationConfig.update({
          where: { symbol },
          data: { isEnabled: false, nextRunAt: null }
        });
        throw new BadRequestException(
          "LIVE_MARKET mode is blocked in production runtime. It is only allowed in development runtime."
        );
      }

      const liveSchedule = await this.scheduleNextRandom(symbol);
      await this.auditService.log({
        actorUserId: adminUserId,
        action: "ADMIN_TEST_TRADE_SIMULATOR_STARTED",
        targetType: "COIN_LISTING",
        targetId: symbol,
        metadata: {
          ...liveSchedule,
          mode: MODE_LIVE_MARKET,
          runtime: process.env.NODE_ENV ?? "undefined"
        }
      });

      return {
        symbol,
        enabled: true,
        mode: MODE_LIVE_MARKET,
        ...liveSchedule
      };
    }

    if (mode !== MODE_SIMULATION_ONLY) {
      await this.prisma.tradeSimulationConfig.update({
        where: { symbol },
        data: { isEnabled: false, nextRunAt: null }
      });
      throw new BadRequestException("Unsupported simulator mode.");
    }

    const schedule = await this.scheduleNextRandom(symbol);

    await this.auditService.log({
      actorUserId: adminUserId,
      action: "ADMIN_TEST_TRADE_SIMULATOR_STARTED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: schedule
    });

    return {
      symbol,
      enabled: true,
      ...schedule
    };
  }

  async stop(symbolInput: string, adminUserId: string) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);

    this.clearTimer(symbol);

    await this.prisma.tradeSimulationConfig.upsert({
      where: { symbol },
      create: {
        symbol,
        feature: FEATURE_NAME,
        mode: MODE_SIMULATION_ONLY,
        isEnabled: false,
        intervalPool: DEFAULT_INTERVALS as unknown as Prisma.InputJsonValue,
        nextRunAt: null
      },
      update: {
        isEnabled: false,
        mode: MODE_SIMULATION_ONLY,
        nextRunAt: null
      }
    });

    await this.auditService.log({
      actorUserId: adminUserId,
      action: "ADMIN_TEST_TRADE_SIMULATOR_STOPPED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {}
    });

    return {
      symbol,
      enabled: false,
      nextRunAt: null
    };
  }

  async requestLiveApproval(
    symbolInput: string,
    input: RequestTradeSimulatorLiveApprovalDto,
    adminUserId: string
  ) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);
    const config = await this.ensureConfig(symbol);

    if (this.normalizeMode(config.mode) !== MODE_LIVE_MARKET) {
      throw new BadRequestException(
        "Set simulator mode to LIVE_MARKET first, then submit compliance approval request."
      );
    }

    const existingPending = await this.prisma.tradeSimulationComplianceRequest.findFirst({
      where: { symbol, status: LIVE_APPROVAL_STATUS_PENDING },
      select: { id: true }
    });
    if (existingPending) {
      throw new BadRequestException("A pending live approval request already exists for this symbol.");
    }

    const reason = this.normalizeReason(input.reason, "reason");

    const created = await this.prisma.tradeSimulationComplianceRequest.create({
      data: {
        symbol,
        requestedMode: MODE_LIVE_MARKET,
        status: LIVE_APPROVAL_STATUS_PENDING,
        requestedByUserId: adminUserId,
        requestedReason: reason
      },
      include: {
        requestedByUser: { select: { email: true } },
        reviewedByUser: { select: { email: true } }
      }
    });

    this.clearTimer(symbol);
    await this.prisma.tradeSimulationConfig.update({
      where: { symbol },
      data: { isEnabled: false, nextRunAt: null }
    });

    await this.auditService.log({
      actorUserId: adminUserId,
      action: "ADMIN_TEST_TRADE_LIVE_APPROVAL_REQUESTED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {
        requestId: created.id,
        requestedMode: MODE_LIVE_MARKET,
        reason
      }
    });

    return {
      symbol,
      request: this.toApprovalResponse(created)
    };
  }

  async reviewLiveApproval(
    symbolInput: string,
    requestId: string,
    input: ReviewTradeSimulatorLiveApprovalDto,
    adminUserId: string
  ) {
    const symbol = this.normalizeSymbol(symbolInput);
    await this.ensureListing(symbol);

    const decision = this.normalizeReviewDecision(input.decision);
    const reviewReason = input.reason?.trim() ? input.reason.trim() : null;
    if (decision === "REJECT" && !reviewReason) {
      throw new BadRequestException("reason is required when rejecting approval.");
    }

    const existing = await this.prisma.tradeSimulationComplianceRequest.findFirst({
      where: { id: requestId, symbol },
      include: {
        requestedByUser: { select: { email: true } },
        reviewedByUser: { select: { email: true } }
      }
    });
    if (!existing) {
      throw new NotFoundException("Live approval request not found");
    }
    if (existing.status !== LIVE_APPROVAL_STATUS_PENDING) {
      throw new BadRequestException("Only pending approval requests can be reviewed.");
    }
    if (existing.requestedByUserId === adminUserId) {
      throw new BadRequestException("Requester cannot approve/reject their own live request.");
    }

    const now = new Date();
    const nextStatus =
      decision === "APPROVE" ? LIVE_APPROVAL_STATUS_APPROVED : LIVE_APPROVAL_STATUS_REJECTED;
    const expiresAt =
      decision === "APPROVE"
        ? new Date(now.getTime() + LIVE_APPROVAL_EXPIRES_HOURS * 60 * 60 * 1000)
        : null;

    const updated = await this.prisma.tradeSimulationComplianceRequest.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewedByUserId: adminUserId,
        reviewReason,
        reviewedAt: now,
        expiresAt
      },
      include: {
        requestedByUser: { select: { email: true } },
        reviewedByUser: { select: { email: true } }
      }
    });

    if (nextStatus !== LIVE_APPROVAL_STATUS_APPROVED) {
      this.clearTimer(symbol);
      await this.prisma.tradeSimulationConfig.update({
        where: { symbol },
        data: { isEnabled: false, nextRunAt: null }
      });
    }

    await this.auditService.log({
      actorUserId: adminUserId,
      action:
        nextStatus === LIVE_APPROVAL_STATUS_APPROVED
          ? "ADMIN_TEST_TRADE_LIVE_APPROVAL_APPROVED"
          : "ADMIN_TEST_TRADE_LIVE_APPROVAL_REJECTED",
      targetType: "COIN_LISTING",
      targetId: symbol,
      metadata: {
        requestId: existing.id,
        requestedByUserId: existing.requestedByUserId,
        decision,
        reviewReason,
        expiresAt: expiresAt?.toISOString() ?? null
      }
    });

    return {
      symbol,
      request: this.toApprovalResponse(updated)
    };
  }
}
