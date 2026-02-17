import { AdminPermission, PrismaClient } from "@prisma/client";

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
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage: npm --workspace backend run admin:promote -- <email>");
  }

  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email },
      data: { role: "ADMIN" }
    });

    for (const permission of ALL_ADMIN_PERMISSIONS) {
      await tx.adminPermissionGrant.upsert({
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
  });

  console.log(`Promoted ${email} to ADMIN with full permissions`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
