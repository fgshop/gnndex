import "reflect-metadata";
import { hash } from "bcryptjs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AdminPermission, PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

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
  "ADMIN_PERMISSION_READ",
  "ADMIN_PERMISSION_WRITE"
];

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createEmail(prefix: string, suffix: string): string {
  return `${prefix}.${suffix}@gnndex.e2e.local`;
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
    const record = payload as { message?: string | string[]; error?: string; code?: string };
    if (Array.isArray(record.message) && record.message.length > 0) {
      return record.message.join(", ");
    }
    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.length > 0) {
      return record.error;
    }
    if (typeof record.code === "string" && record.code.length > 0) {
      return record.code;
    }
  }

  return String(payload);
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  const text = await response.text();
  const payload = parseJsonSafely(text);

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${getErrorMessage(payload)}`);
  }

  return payload as T;
}

async function requestExpectFailure(
  baseUrl: string,
  path: string,
  expectedStatus: number,
  init: RequestInit & { token?: string } = {}
) {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });
  const text = await response.text();
  const payload = parseJsonSafely(text);

  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${path} expected ${expectedStatus}, got ${response.status}: ${getErrorMessage(payload)}`
    );
  }

  return payload;
}

async function login(baseUrl: string, email: string, password: string): Promise<Tokens> {
  const payload = await requestJson<{
    tokens?: { accessToken?: string; refreshToken?: string };
  }>(baseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  const accessToken = payload.tokens?.accessToken;
  const refreshToken = payload.tokens?.refreshToken;
  assert(accessToken, `Login failed: missing access token for ${email}`);
  assert(refreshToken, `Login failed: missing refresh token for ${email}`);

  return { accessToken, refreshToken };
}

async function seedAdmin(
  prisma: PrismaClient,
  email: string,
  password: string,
  permissions: AdminPermission[]
) {
  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      security: { create: {} },
      balances: {
        create: [
          { asset: "USDT", available: "0", locked: "0" },
          { asset: "BTC", available: "0", locked: "0" }
        ]
      }
    }
  });

  if (permissions.length > 0) {
    await prisma.adminPermissionGrant.createMany({
      data: permissions.map((permission) => ({
        userId: user.id,
        permission
      }))
    });
  }

  return user;
}

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 100000)}`;

  const adminActorEmail = createEmail("admin-actor", suffix);
  const adminTargetEmail = createEmail("admin-target", suffix);
  const adminLimitedEmail = createEmail("admin-limited", suffix);
  const traderEmail = createEmail("trader", suffix);
  const password = "GlobalDEX!2345";

  let actorUserId: string | null = null;
  let targetUserId: string | null = null;
  let withdrawalId: string | null = null;

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
    const actor = await seedAdmin(prisma, adminActorEmail, password, ALL_ADMIN_PERMISSIONS);
    actorUserId = actor.id;
    const target = await seedAdmin(prisma, adminTargetEmail, password, ["USER_READ"]);
    targetUserId = target.id;
    await seedAdmin(prisma, adminLimitedEmail, password, ["USER_READ"]);

    await app.listen(0, "127.0.0.1");
    const server = app.getHttpServer() as { address: () => { port: number } };
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/v1`;

    const adminTokens = await login(baseUrl, adminActorEmail, password);
    const limitedAdminTokens = await login(baseUrl, adminLimitedEmail, password);

    await requestExpectFailure(
      baseUrl,
      "/admin/orders?page=1&limit=5",
      403,
      {
        token: limitedAdminTokens.accessToken
      }
    );

    const registerResponse = await requestJson<{ user?: { userId?: string }; tokens?: Tokens }>(
      baseUrl,
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ email: traderEmail, password })
      }
    );
    void registerResponse.user?.userId;
    const traderAccessToken = registerResponse.tokens?.accessToken;
    assert(traderAccessToken, "Trader register did not return access token");

    await requestJson(baseUrl, "/wallet/admin-adjust", {
      method: "POST",
      token: adminTokens.accessToken,
      body: JSON.stringify({
        email: traderEmail,
        asset: "USDT",
        amount: "300.00",
        reason: "E2E funding"
      })
    });

    const withdrawal = await requestJson<{ withdrawalId?: string; status?: string }>(
      baseUrl,
      "/wallet/withdrawals",
      {
        method: "POST",
        token: traderAccessToken,
        body: JSON.stringify({
          asset: "USDT",
          network: "ETH-ERC20",
          address: "0x1111111111111111111111111111111111111111",
          amount: "120.50",
          fee: "0.50"
        })
      }
    );
    assert(withdrawal.withdrawalId, "Withdrawal request did not return withdrawalId");
    withdrawalId = withdrawal.withdrawalId;

    await requestJson(baseUrl, `/admin/withdrawals/${withdrawalId}/approve`, {
      method: "POST",
      token: adminTokens.accessToken
    });

    await requestJson(baseUrl, `/admin/withdrawals/${withdrawalId}/broadcast`, {
      method: "POST",
      token: adminTokens.accessToken,
      body: JSON.stringify({ txHash: `0xe2e${suffix.replace(/\./g, "")}` })
    });

    const confirmResult = await requestJson<{ status?: string }>(
      baseUrl,
      `/admin/withdrawals/${withdrawalId}/confirm`,
      {
        method: "POST",
        token: adminTokens.accessToken
      }
    );
    assert(confirmResult.status === "CONFIRMED", "Withdrawal was not confirmed");

    await requestExpectFailure(
      baseUrl,
      `/admin/withdrawals/${withdrawalId}/confirm`,
      400,
      {
        method: "POST",
        token: adminTokens.accessToken
      }
    );

    await requestExpectFailure(
      baseUrl,
      `/admin/withdrawals/${withdrawalId}/fail`,
      400,
      {
        method: "POST",
        token: adminTokens.accessToken,
        body: JSON.stringify({ reason: "Invalid post-confirm fail attempt" })
      }
    );

    const permissionList = await requestJson<{
      items?: Array<{ userId?: string; email?: string; permissions?: string[] }>;
    }>(baseUrl, `/admin/permissions/users?email=${encodeURIComponent(adminTargetEmail)}`, {
      token: adminTokens.accessToken
    });
    const permissionTarget = permissionList.items?.find((item) => item.email === adminTargetEmail);
    assert(permissionTarget?.userId === targetUserId, "Permission target user lookup failed");
    assert(
      permissionTarget.permissions?.includes("USER_READ"),
      "Initial target permission USER_READ missing"
    );

    const updatedPermissions = ["USER_READ", "WITHDRAWAL_READ", "AUDIT_LOG_READ"];
    const patchResult = await requestJson<{ permissions?: string[] }>(
      baseUrl,
      `/admin/permissions/users/${targetUserId}`,
      {
        method: "PATCH",
        token: adminTokens.accessToken,
        body: JSON.stringify({ permissions: updatedPermissions })
      }
    );
    assert(
      updatedPermissions.every((permission) => patchResult.permissions?.includes(permission)),
      "Permission patch result mismatch"
    );

    const selfDowngradePermissions = ALL_ADMIN_PERMISSIONS.filter(
      (permission) => permission !== "ADMIN_PERMISSION_WRITE"
    );
    assert(actorUserId, "Actor user id is missing");
    await requestExpectFailure(
      baseUrl,
      `/admin/permissions/users/${actorUserId}`,
      400,
      {
        method: "PATCH",
        token: adminTokens.accessToken,
        body: JSON.stringify({ permissions: selfDowngradePermissions })
      }
    );

    const permissionAuditLogs = await requestJson<{
      items?: Array<{
        action?: string;
        targetId?: string | null;
        metadata?: { previousPermissions?: string[]; nextPermissions?: string[] };
      }>;
    }>(
      baseUrl,
      `/admin/audit-logs?action=ADMIN_PERMISSIONS_UPDATED&targetType=USER&limit=30&page=1`,
      {
        token: adminTokens.accessToken
      }
    );

    const permissionAudit = permissionAuditLogs.items?.find((item) => item.targetId === targetUserId);
    assert(permissionAudit, "Permission update audit log not found");
    assert(
      permissionAudit.metadata?.nextPermissions?.includes("WITHDRAWAL_READ"),
      "Permission audit log missing nextPermissions update"
    );

    const withdrawalAuditLogs = await requestJson<{
      items?: Array<{ action?: string; targetId?: string | null }>;
    }>(
      baseUrl,
      `/admin/audit-logs?action=WITHDRAWAL_CONFIRMED&targetType=WITHDRAWAL&limit=30&page=1`,
      {
        token: adminTokens.accessToken
      }
    );
    const withdrawalAudit = withdrawalAuditLogs.items?.find((item) => item.targetId === withdrawalId);
    assert(withdrawalAudit, "Withdrawal confirm audit log not found");

    console.log("E2E admin flow passed");
    console.log(`- trader: ${traderEmail}`);
    console.log(`- withdrawal: ${withdrawalId}`);
    console.log(`- permission target: ${adminTargetEmail}`);
  } finally {
    await app.close();

    const cleanupOrConditions: Array<{ actorEmail?: string; targetId?: string }> = [
      { actorEmail: adminActorEmail },
      { actorEmail: traderEmail },
      { actorEmail: adminTargetEmail }
    ];
    if (withdrawalId) {
      cleanupOrConditions.push({ targetId: withdrawalId });
    }
    if (targetUserId) {
      cleanupOrConditions.push({ targetId: targetUserId });
    }

    await prisma.auditLog.deleteMany({
      where: {
        OR: cleanupOrConditions
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminActorEmail, adminTargetEmail, adminLimitedEmail, traderEmail]
        }
      }
    });

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
