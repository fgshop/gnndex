import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { Prisma, WalletLedgerEntryType, WithdrawalStatus } from "@prisma/client";
import { Observable, catchError, from, map, of, switchMap, timer } from "rxjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { getCoinConfig, getDefaultNetwork, getNetworkConfig, COIN_NETWORK_CONFIG } from "./coin-network.config";
import { AdjustBalanceDto } from "./dto/adjust-balance.dto";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { ListMyWithdrawalsQueryDto } from "./dto/list-my-withdrawals.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { StreamBalancesQueryDto } from "./dto/stream-balances.dto";

type StreamBalancesEvent = {
  eventId: string;
  eventType: "user.balances.snapshot" | "user.balances.error";
  eventVersion: number;
  occurredAt: string;
  data:
    | Array<{
        asset: string;
        available: string;
        locked: string;
        depositAddress: string | null;
      }>
    | { message: string };
};

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private async resolveUserByEmailOrFail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async getBalancesByUserId(userId: string) {
    const balances = await this.prisma.walletBalance.findMany({
      where: { userId },
      orderBy: { asset: "asc" }
    });

    return balances.map((item) => ({
      asset: item.asset,
      available: item.available.toString(),
      locked: item.locked.toString(),
      depositAddress: item.depositAddress ?? null,
    }));
  }

  async createWallet(userId: string, input: CreateWalletDto) {
    const asset = input.asset.toUpperCase();
    const coinConfig = getCoinConfig(asset);

    if (!coinConfig) {
      throw new BadRequestException(`Unsupported asset: ${asset}`);
    }

    // Resolve network — auto-select first network if not provided
    let resolvedNetwork: string;
    if (coinConfig.type === "native") {
      resolvedNetwork = coinConfig.networks[0].network;
    } else if (!input.network) {
      resolvedNetwork = coinConfig.networks[0].network;
    } else {
      const networkCfg = getNetworkConfig(asset, input.network);
      if (!networkCfg) {
        throw new BadRequestException(
          `Unsupported network "${input.network}" for ${asset}. Supported: ${coinConfig.networks.map((n) => n.network).join(", ")}`
        );
      }
      resolvedNetwork = networkCfg.network;
    }

    const existing = await this.prisma.walletBalance.findUnique({
      where: { userId_asset: { userId, asset } },
    });

    if (existing) {
      const depositAddress =
        existing.depositAddress ?? this.generateDepositAddress(userId, asset, resolvedNetwork);

      if (!existing.depositAddress) {
        await this.prisma.walletBalance.update({
          where: { id: existing.id },
          data: { depositAddress },
        });
      }

      return {
        asset: existing.asset,
        network: resolvedNetwork,
        available: existing.available.toString(),
        locked: existing.locked.toString(),
        depositAddress,
      };
    }

    const depositAddress = this.generateDepositAddress(userId, asset, resolvedNetwork);

    const created = await this.prisma.walletBalance.create({
      data: {
        userId,
        asset,
        available: "0",
        locked: "0",
        depositAddress,
      },
    });

    return {
      asset: created.asset,
      network: resolvedNetwork,
      available: created.available.toString(),
      locked: created.locked.toString(),
      depositAddress,
    };
  }

  getNetworkConfig() {
    return COIN_NETWORK_CONFIG.map((coin) => ({
      asset: coin.asset,
      name: coin.name,
      type: coin.type,
      networks: coin.networks.map((n) => ({
        network: n.network,
        displayName: n.displayName,
        confirmations: n.confirmations,
        minDeposit: n.minDeposit,
        withdrawFee: n.withdrawFee,
      })),
    }));
  }

  private generateDepositAddress(userId: string, asset: string, network: string): string {
    const secret = process.env.JWT_ACCESS_SECRET ?? "gnndex";
    const hash = createHash("sha256")
      .update(`${userId}:${asset}:${network}:${secret}`)
      .digest("hex");

    const networkCfg = getNetworkConfig(asset, network) ?? getDefaultNetwork(asset);
    if (!networkCfg) {
      return "0x" + hash.substring(0, 40);
    }

    const { addressPrefix, addressLength } = networkCfg;

    if (addressPrefix === "") {
      // Base58-like (Solana, etc.) — use hex as-is, trimmed to length
      return hash.substring(0, addressLength);
    }

    return addressPrefix + hash.substring(0, addressLength);
  }

  streamBalances(userId: string, query: StreamBalancesQueryDto): Observable<StreamBalancesEvent> {
    const intervalMs = query.intervalMs ?? 5000;
    let sequence = 0;

    return timer(0, intervalMs).pipe(
      switchMap(() =>
        from(this.getBalancesByUserId(userId)).pipe(
          map((balances) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            return {
              eventId: `balances-${userId}-${occurredAt}-${sequence}`,
              eventType: "user.balances.snapshot" as const,
              eventVersion: 1,
              occurredAt,
              data: balances
            };
          }),
          catchError((error: unknown) => {
            const occurredAt = new Date().toISOString();
            sequence += 1;
            const message =
              error instanceof Error ? error.message : "Failed to stream wallet balances";
            return of({
              eventId: `balances-error-${userId}-${occurredAt}-${sequence}`,
              eventType: "user.balances.error" as const,
              eventVersion: 1,
              occurredAt,
              data: { message }
            });
          })
        )
      )
    );
  }

  async getLedgerByUserId(userId: string, limit = 100) {
    const rows = await this.prisma.walletLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200)
    });

    return rows.map((row) => ({
      id: row.id,
      asset: row.asset,
      entryType: row.entryType,
      amount: row.amount.toString(),
      balanceBefore: row.balanceBefore.toString(),
      balanceAfter: row.balanceAfter.toString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async requestWithdrawal(userId: string, input: RequestWithdrawalDto) {
    const amount = new Prisma.Decimal(input.amount);
    const fee = new Prisma.Decimal(input.fee ?? "0");
    const totalLock = amount.add(fee);

    if (amount.lte(0)) {
      throw new BadRequestException("Withdrawal amount must be greater than zero");
    }
    if (fee.lt(0)) {
      throw new BadRequestException("Withdrawal fee cannot be negative");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.walletBalance.findUnique({
        where: {
          userId_asset: {
            userId,
            asset: input.asset
          }
        }
      });

      if (!balance) {
        throw new BadRequestException(`Balance for ${input.asset} does not exist`);
      }
      if (balance.available.lt(totalLock)) {
        throw new BadRequestException("Insufficient available balance for withdrawal");
      }

      const updated = await tx.walletBalance.update({
        where: { id: balance.id },
        data: {
          available: balance.available.sub(totalLock),
          locked: balance.locked.add(totalLock)
        }
      });

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          asset: input.asset,
          network: input.network,
          address: input.address,
          memo: input.memo,
          amount,
          fee,
          status: WithdrawalStatus.REVIEW_PENDING
        }
      });

      await tx.walletLedger.create({
        data: {
          userId,
          asset: input.asset,
          entryType: WalletLedgerEntryType.WITHDRAWAL,
          amount: totalLock,
          balanceBefore: balance.available,
          balanceAfter: updated.available,
          referenceType: "WITHDRAWAL_REQUEST",
          referenceId: withdrawal.id
        }
      });

      return {
        withdrawalId: withdrawal.id,
        asset: withdrawal.asset,
        network: withdrawal.network,
        amount: withdrawal.amount.toString(),
        fee: withdrawal.fee.toString(),
        address: withdrawal.address,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt.toISOString()
      };
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    await this.auditService.log({
      actorUserId: userId,
      actorEmail: user?.email ?? null,
      action: "WITHDRAWAL_REQUESTED",
      targetType: "WITHDRAWAL",
      targetId: result.withdrawalId,
      metadata: {
        asset: result.asset,
        network: result.network,
        amount: result.amount,
        fee: result.fee
      }
    });

    return result;
  }

  async listWithdrawalsByUserId(userId: string, query: ListMyWithdrawalsQueryDto) {
    const limit = query.limit ?? 50;
    const rows = await this.prisma.withdrawal.findMany({
      where: {
        userId,
        status: query.status ? (query.status as WithdrawalStatus) : undefined
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200)
    });

    return rows.map((row) => ({
      withdrawalId: row.id,
      asset: row.asset,
      network: row.network,
      address: row.address,
      memo: row.memo,
      amount: row.amount.toString(),
      fee: row.fee.toString(),
      txHash: row.txHash,
      status: row.status,
      rejectReason: row.rejectReason,
      failureReason: row.failureReason,
      requestedAt: row.requestedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null
    }));
  }

  async adminAdjustBalance(
    input: AdjustBalanceDto,
    actor?: { userId?: string; email?: string }
  ) {
    const user = await this.resolveUserByEmailOrFail(input.email);

    const delta = new Prisma.Decimal(input.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletBalance.findUnique({
        where: {
          userId_asset: {
            userId: user.id,
            asset: input.asset
          }
        }
      });

      if (!existing && delta.lt(0)) {
        throw new BadRequestException("Cannot create a negative balance");
      }

      const balanceBefore = existing?.available ?? new Prisma.Decimal(0);
      const balanceAfter = balanceBefore.add(delta);

      if (balanceAfter.lt(0)) {
        throw new BadRequestException("Resulting balance cannot be negative");
      }

      const updated = existing
        ? await tx.walletBalance.update({
            where: { id: existing.id },
            data: { available: balanceAfter }
          })
        : await tx.walletBalance.create({
            data: {
              userId: user.id,
              asset: input.asset,
              available: balanceAfter,
              locked: "0"
            }
          });

      await tx.walletLedger.create({
        data: {
          userId: user.id,
          asset: input.asset,
          entryType: WalletLedgerEntryType.ADJUSTMENT,
          amount: delta,
          balanceBefore,
          balanceAfter,
          referenceType: "MANUAL_ADJUST",
          referenceId: input.reason ?? null
        }
      });

      return {
        asset: updated.asset,
        available: updated.available.toString(),
        locked: updated.locked.toString()
      };
    });

    await this.auditService.log({
      actorUserId: actor?.userId ?? null,
      actorEmail: actor?.email ?? null,
      action: "WALLET_ADMIN_ADJUSTED",
      targetType: "WALLET_BALANCE",
      targetId: `${user.id}:${input.asset}`,
      metadata: {
        amount: input.amount,
        reason: input.reason ?? null
      }
    });

    return result;
  }

  async simulateDeposit(userId: string, asset: string, amount: string) {
    const delta = new Prisma.Decimal(amount);
    if (delta.lte(0)) {
      throw new BadRequestException("Amount must be positive");
    }

    const coinCfg = getCoinConfig(asset);
    if (!coinCfg) {
      throw new BadRequestException(`Unsupported asset: ${asset}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletBalance.findUnique({
        where: { userId_asset: { userId, asset } },
      });

      if (!existing) {
        throw new BadRequestException("Wallet not found. Create a wallet first.");
      }

      const balanceBefore = existing.available;
      const balanceAfter = balanceBefore.add(delta);

      const updated = await tx.walletBalance.update({
        where: { id: existing.id },
        data: { available: balanceAfter },
      });

      await tx.walletLedger.create({
        data: {
          userId,
          asset,
          entryType: WalletLedgerEntryType.DEPOSIT,
          amount: delta,
          balanceBefore,
          balanceAfter,
          referenceType: "SIMULATED_DEPOSIT",
          referenceId: null,
        },
      });

      return {
        asset: updated.asset,
        available: updated.available.toString(),
        locked: updated.locked.toString(),
      };
    });

    return result;
  }
}
