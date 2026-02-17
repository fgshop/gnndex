import "reflect-metadata";
import { hash } from "bcryptjs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AdminPermission, PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

const FULL_ADMIN_PERMISSIONS: AdminPermission[] = [
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

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
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

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  const payload = parseJsonSafely(text);

  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${path} expected ${expectedStatus}, got ${response.status}: ${getErrorMessage(payload)}`
    );
  }

  return payload;
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
      data: permissions.map((permission) => ({ userId: user.id, permission }))
    });
  }

  return user;
}

async function login(baseUrl: string, email: string, password: string) {
  const payload = await requestJson<{
    tokens?: { accessToken?: string };
  }>(baseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const accessToken = payload.tokens?.accessToken;
  assert(accessToken, `Missing access token for ${email}`);
  return accessToken;
}

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 100000)}`;
  const password = "GnnDEX!2345";

  const writerEmail = createEmail("admin-writer", suffix);
  const limitedEmail = createEmail("admin-limited", suffix);

  let writerUserId: string | null = null;
  let limitedUserId: string | null = null;

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
    const writer = await seedAdmin(prisma, writerEmail, password, FULL_ADMIN_PERMISSIONS);
    writerUserId = writer.id;
    const limited = await seedAdmin(prisma, limitedEmail, password, ["USER_READ"]);
    limitedUserId = limited.id;

    await app.listen(0, "127.0.0.1");
    const server = app.getHttpServer() as { address: () => { port: number } };
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/v1`;

    const writerToken = await login(baseUrl, writerEmail, password);
    const limitedToken = await login(baseUrl, limitedEmail, password);

    await requestExpectFailure(baseUrl, "/admin/permissions/users?page=1&limit=5", 403, {
      token: limitedToken
    });

    const promotedPermissions = [
      "USER_READ",
      "ADMIN_PERMISSION_READ"
    ];
    await requestJson<{ permissions?: string[] }>(
      baseUrl,
      `/admin/permissions/users/${limitedUserId}`,
      {
        method: "PATCH",
        token: writerToken,
        body: JSON.stringify({ permissions: promotedPermissions })
      }
    );

    const selfDowngrade = FULL_ADMIN_PERMISSIONS.filter(
      (permission) => permission !== "ADMIN_PERMISSION_WRITE"
    );
    await requestExpectFailure(
      baseUrl,
      `/admin/permissions/users/${writerUserId}`,
      400,
      {
        method: "PATCH",
        token: writerToken,
        body: JSON.stringify({ permissions: selfDowngrade })
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
      { token: writerToken }
    );

    const audit = permissionAuditLogs.items?.find((item) => item.targetId === limitedUserId);
    assert(audit, "Permission update audit entry not found for limited admin");
    assert(
      audit.metadata?.nextPermissions?.includes("ADMIN_PERMISSION_READ"),
      "Permission update audit missing ADMIN_PERMISSION_READ"
    );

    console.log("E2E permission guard flow passed");
    console.log(`- writer: ${writerEmail}`);
    console.log(`- limited: ${limitedEmail}`);
  } finally {
    await app.close();

    const cleanupOrConditions: Array<{ actorEmail?: string; targetId?: string }> = [
      { actorEmail: writerEmail },
      { actorEmail: limitedEmail }
    ];
    if (writerUserId) {
      cleanupOrConditions.push({ targetId: writerUserId });
    }
    if (limitedUserId) {
      cleanupOrConditions.push({ targetId: limitedUserId });
    }

    await prisma.auditLog.deleteMany({
      where: { OR: cleanupOrConditions }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [writerEmail, limitedEmail]
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
