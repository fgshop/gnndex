import { AdminPermission, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

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
  "ADMIN_PERMISSION_WRITE"
];

async function main() {
  const email = process.argv[2] ?? "admin@gnndex.com";
  const password = process.argv[3] ?? "GlobalDEX!2345";

  const prisma = new PrismaClient();
  const passwordHash = await hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      passwordHash
    },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      security: { create: {} },
      balances: {
        create: [
          { asset: "USDT", available: "10000", locked: "0" },
          { asset: "BTC", available: "1", locked: "0" }
        ]
      }
    }
  });

  for (const permission of ALL_ADMIN_PERMISSIONS) {
    await prisma.adminPermissionGrant.upsert({
      where: {
        userId_permission: {
          userId: user.id,
          permission
        }
      },
      update: {},
      create: {
        userId: user.id,
        permission
      }
    });
  }

  await prisma.$disconnect();
  console.log(`Admin user ready: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
