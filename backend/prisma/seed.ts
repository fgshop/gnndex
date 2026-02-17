import { readFileSync } from "fs";
import { join } from "path";
import {
  AdminPermission,
  OrderSide,
  OrderStatus,
  OrderType,
  PrismaClient,
  SupportTicketStatus,
  UserRole
} from "@prisma/client";
import { hash } from "bcryptjs";

type MarketSheetRow = {
  symbol: string;
  lastPrice: number;
  volume24h: number;
  change1hPct: number;
  marketCapEstimate: number;
};

const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "USER_READ",
  "ORDER_READ",
  "WALLET_LEDGER_READ",
  "WITHDRAWAL_READ",
  "WITHDRAWAL_APPROVE",
  "WITHDRAWAL_REJECT",
  "WITHDRAWAL_BROADCAST",
  "WITHDRAWAL_CONFIRM",
  "WITHDRAWAL_FAIL",
  "BALANCE_ADJUST",
  "AUDIT_LOG_READ",
  "SUPPORT_TICKET_READ",
  "SUPPORT_TICKET_REPLY",
  "ADMIN_PERMISSION_READ",
  "ADMIN_PERMISSION_WRITE",
  "COMPLIANCE_APPROVE"
];

function parseMarketSheet(): MarketSheetRow[] {
  const sourcePath = join(__dirname, "seed-data", "market-sheet.csv");
  const csv = readFileSync(sourcePath, "utf8").trim();
  const lines = csv.split("\n").map((line) => line.trim());
  const header = lines[0]?.split(",").map((cell) => cell.trim()) ?? [];

  const required = ["symbol", "last_price", "volume_24h", "change_1h_pct", "market_cap_estimate"];
  for (const key of required) {
    if (!header.includes(key)) {
      throw new Error(`Missing column in market sheet: ${key}`);
    }
  }

  const indexMap = new Map(header.map((key, index) => [key, index]));
  const rows: MarketSheetRow[] = [];

  for (const rawLine of lines.slice(1)) {
    if (!rawLine) {
      continue;
    }
    const cells = rawLine.split(",").map((cell) => cell.trim());
    const symbol = cells[indexMap.get("symbol") ?? -1] ?? "";
    const lastPrice = Number(cells[indexMap.get("last_price") ?? -1] ?? Number.NaN);
    const volume24h = Number(cells[indexMap.get("volume_24h") ?? -1] ?? Number.NaN);
    const change1hPct = Number(cells[indexMap.get("change_1h_pct") ?? -1] ?? Number.NaN);
    const marketCapEstimate = Number(cells[indexMap.get("market_cap_estimate") ?? -1] ?? Number.NaN);

    if (!symbol || !Number.isFinite(lastPrice) || !Number.isFinite(volume24h)) {
      continue;
    }

    rows.push({
      symbol,
      lastPrice,
      volume24h,
      change1hPct: Number.isFinite(change1hPct) ? change1hPct : 0,
      marketCapEstimate: Number.isFinite(marketCapEstimate) ? marketCapEstimate : 0
    });
  }

  return rows;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function toDecimal(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits);
}

async function main() {
  const prisma = new PrismaClient();
  const marketRows = parseMarketSheet();
  const passwordHash = await hash("GnnDEX!2345", 10);

  try {
    const admin = await prisma.user.upsert({
      where: { email: "admin@gnndex.com" },
      update: {
        role: UserRole.ADMIN,
        passwordHash
      },
      create: {
        email: "admin@gnndex.com",
        role: UserRole.ADMIN,
        passwordHash,
        security: { create: {} }
      }
    });

    const trader = await prisma.user.upsert({
      where: { email: "trader@gnndex.com" },
      update: {
        role: UserRole.USER,
        passwordHash
      },
      create: {
        email: "trader@gnndex.com",
        role: UserRole.USER,
        passwordHash,
        security: { create: {} }
      }
    });

    const maker = await prisma.user.upsert({
      where: { email: "liquidity@gnndex.com" },
      update: {
        role: UserRole.USER,
        passwordHash
      },
      create: {
        email: "liquidity@gnndex.com",
        role: UserRole.USER,
        passwordHash,
        security: { create: {} }
      }
    });

    for (const userId of [admin.id, trader.id, maker.id]) {
      await prisma.userSecurity.upsert({
        where: { userId },
        update: {},
        create: { userId }
      });
    }

    for (const permission of ALL_ADMIN_PERMISSIONS) {
      await prisma.adminPermissionGrant.upsert({
        where: {
          userId_permission: {
            userId: admin.id,
            permission
          }
        },
        update: {},
        create: {
          userId: admin.id,
          permission,
          grantedByUserId: admin.id
        }
      });
    }

    const seedBalances = [
      { asset: "USDT", admin: 500000, trader: 120000, maker: 350000 },
      { asset: "BTC", admin: 8, trader: 2.1, maker: 5.5 },
      { asset: "ETH", admin: 120, trader: 35, maker: 95 },
      { asset: "SOL", admin: 1400, trader: 520, maker: 980 },
      { asset: "XRP", admin: 160000, trader: 52000, maker: 94000 },
      { asset: "SBK", admin: 320000, trader: 120000, maker: 250000 },
      { asset: "G99", admin: 840000, trader: 300000, maker: 620000 }
    ];

    for (const row of seedBalances) {
      await prisma.walletBalance.upsert({
        where: { userId_asset: { userId: admin.id, asset: row.asset } },
        update: { available: toDecimal(row.admin, 8), locked: "0" },
        create: {
          userId: admin.id,
          asset: row.asset,
          available: toDecimal(row.admin, 8),
          locked: "0"
        }
      });
      await prisma.walletBalance.upsert({
        where: { userId_asset: { userId: trader.id, asset: row.asset } },
        update: { available: toDecimal(row.trader, 8), locked: "0" },
        create: {
          userId: trader.id,
          asset: row.asset,
          available: toDecimal(row.trader, 8),
          locked: "0"
        }
      });
      await prisma.walletBalance.upsert({
        where: { userId_asset: { userId: maker.id, asset: row.asset } },
        update: { available: toDecimal(row.maker, 8), locked: "0" },
        create: {
          userId: maker.id,
          asset: row.asset,
          available: toDecimal(row.maker, 8),
          locked: "0"
        }
      });
    }

    const preferredListings = new Set([
      "BTC-USDT",
      "ETH-USDT",
      "SOL-USDT",
      "XRP-USDT",
      "SBK-USDT",
      "G99-USDT"
    ]);
    const listingRows = marketRows.filter((row) => preferredListings.has(row.symbol));
    for (const [index, row] of listingRows.entries()) {
      const [baseAssetRaw, quoteAssetRaw] = row.symbol.split("-");
      const baseAsset = baseAssetRaw || row.symbol;
      const quoteAsset = quoteAssetRaw || "USDT";
      await prisma.coinListing.upsert({
        where: { symbol: row.symbol },
        update: {
          baseAsset,
          quoteAsset,
          isActive: true,
          displayOrder: index,
          chartSource: row.symbol === "SBK-USDT" || row.symbol === "G99-USDT" ? "INTERNAL" : "BINANCE"
        },
        create: {
          symbol: row.symbol,
          baseAsset,
          quoteAsset,
          isActive: true,
          displayOrder: index,
          chartSource: row.symbol === "SBK-USDT" || row.symbol === "G99-USDT" ? "INTERNAL" : "BINANCE"
        }
      });
    }

    const symbols = marketRows.map((row) => row.symbol);
    await prisma.order.deleteMany({
      where: {
        userId: { in: [trader.id, maker.id] },
        symbol: { in: symbols }
      }
    });

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const seedOrders: Array<{
      userId: string;
      symbol: string;
      side: OrderSide;
      type: OrderType;
      price: string;
      quantity: string;
      status: OrderStatus;
      createdAt: Date;
    }> = [];

    for (const row of marketRows) {
      const steps = 120;
      const intervalMs = Math.floor(twentyFourHoursMs / steps);
      const baseQuantityPerOrder = row.volume24h / Math.max(row.lastPrice, 1) / steps;
      const directionalBias = row.change1hPct / 100;

      for (let i = 0; i < steps; i += 1) {
        const timeOffset = twentyFourHoursMs - intervalMs * i;
        const timestamp = new Date(now - timeOffset);
        const wave = Math.sin(i / 8) * 0.0075;
        const trend = directionalBias * (i / steps) * 0.22;
        const noise = randomBetween(-0.0035, 0.0035);
        const ratio = 1 + wave + trend + noise;
        const computedPrice = Math.max(row.lastPrice * ratio, row.lastPrice * 0.45);
        const quantity = baseQuantityPerOrder * randomBetween(0.62, 1.38);

        const isBuy = i % 2 === 0;
        const status: OrderStatus =
          i > steps - 6
            ? "NEW"
            : i % 5 === 0
              ? "PARTIALLY_FILLED"
              : "FILLED";

        seedOrders.push({
          userId: isBuy ? trader.id : maker.id,
          symbol: row.symbol,
          side: isBuy ? "BUY" : "SELL",
          type: "LIMIT",
          price: toDecimal(computedPrice, row.lastPrice >= 100 ? 2 : 6),
          quantity: toDecimal(Math.max(quantity, 0.0001), 8),
          status,
          createdAt: timestamp
        });
      }
    }

    if (seedOrders.length > 0) {
      await prisma.order.createMany({
        data: seedOrders
      });
    }

    const supportSeeds: Array<{
      id: string;
      category: string;
      subject: string;
      content: string;
      contactEmail: string;
      status: SupportTicketStatus;
      adminReply: string | null;
      repliedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [
      {
        id: "seed-ticket-001",
        category: "DEPOSIT_WITHDRAWAL",
        subject: "USDT 입금 반영 문의",
        content: "TRC20 입금이 완료되었는데 잔액 반영이 지연되고 있습니다. 확인 요청드립니다.",
        contactEmail: "trader@gnndex.com",
        status: "ANSWERED",
        adminReply: "네트워크 혼잡 구간으로 반영이 지연되었습니다. 현재 정상 반영 완료되었습니다.",
        repliedAt: new Date(now - 2 * 60 * 60 * 1000),
        createdAt: new Date(now - 5 * 60 * 60 * 1000),
        updatedAt: new Date(now - 2 * 60 * 60 * 1000)
      },
      {
        id: "seed-ticket-002",
        category: "ACCOUNT",
        subject: "신규 로그인 기기 알림 확인 요청",
        content: "등록하지 않은 기기에서 로그인 알림이 감지되어 계정 상태 확인을 요청합니다.",
        contactEmail: "trader@gnndex.com",
        status: "IN_REVIEW",
        adminReply: null,
        repliedAt: null,
        createdAt: new Date(now - 90 * 60 * 1000),
        updatedAt: new Date(now - 45 * 60 * 1000)
      }
    ];

    for (const ticket of supportSeeds) {
      await prisma.supportTicket.upsert({
        where: { id: ticket.id },
        update: {
          category: ticket.category,
          subject: ticket.subject,
          content: ticket.content,
          contactEmail: ticket.contactEmail,
          status: ticket.status,
          adminReply: ticket.adminReply,
          repliedAt: ticket.repliedAt,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt
        },
        create: {
          id: ticket.id,
          userId: trader.id,
          category: ticket.category,
          subject: ticket.subject,
          content: ticket.content,
          contactEmail: ticket.contactEmail,
          status: ticket.status,
          adminReply: ticket.adminReply,
          repliedAt: ticket.repliedAt,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorEmail: "admin@gnndex.com",
        action: "SEED_DATA_APPLIED",
        targetType: "SYSTEM",
        metadata: {
          symbols: symbols.length,
          orders: seedOrders.length,
          at: new Date().toISOString()
        }
      }
    });

    console.log("Seed completed");
    console.log(`- users: admin@gnndex.com, trader@gnndex.com, liquidity@gnndex.com`);
    console.log(`- symbols: ${symbols.length}`);
    console.log(`- seeded orders: ${seedOrders.length}`);
    console.log(`- support tickets: ${supportSeeds.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
