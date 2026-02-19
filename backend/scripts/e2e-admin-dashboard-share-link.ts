import "reflect-metadata";
import { hash } from "bcryptjs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

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
}

async function seedAdmin(prisma: PrismaClient, email: string, password: string) {
  const passwordHash = await hash(password, 10);
  return prisma.user.create({
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

type CreateShareLinkResponse = {
  shareCode?: string;
  sharePath?: string;
  expiresAt?: string;
  createdAt?: string;
  payload?: {
    orderStatus?: string;
    orderSymbol?: string;
    withdrawalStatus?: string;
    auditAction?: string;
    presetSlot?: string;
  };
};

type GetShareLinkResponse = {
  shareCode?: string;
  expiresAt?: string;
  createdAt?: string;
  payload?: {
    orderStatus?: string;
    orderSymbol?: string;
    withdrawalStatus?: string;
    auditAction?: string;
    presetSlot?: string;
  };
};

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 100000)}`;
  const password = "GlobalDEX!2345";
  const ownerEmail = createEmail("admin-share-owner", suffix);
  const viewerEmail = createEmail("admin-share-viewer", suffix);

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
    await seedAdmin(prisma, ownerEmail, password);
    await seedAdmin(prisma, viewerEmail, password);

    await app.listen(0, "127.0.0.1");
    const server = app.getHttpServer() as { address: () => { port: number } };
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/v1`;

    const ownerToken = await login(baseUrl, ownerEmail, password);
    const viewerToken = await login(baseUrl, viewerEmail, password);

    const created = await requestJson<CreateShareLinkResponse>(baseUrl, "/admin/dashboard/share-links", {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({
        orderStatus: "NEW",
        orderSymbol: "BTC-USDT",
        withdrawalStatus: "APPROVED",
        auditAction: "ADMIN_PERMISSIONS_UPDATED",
        presetSlot: "risk-watch",
        expiresInMinutes: 30
      })
    });

    assert(typeof created.shareCode === "string" && created.shareCode.length > 0, "shareCode should exist");
    assert(created.sharePath === `/admin/dashboard?share=${created.shareCode}`, "sharePath should match code");
    assert(created.payload?.orderStatus === "NEW", "Created payload.orderStatus should match");
    assert(created.payload?.presetSlot === "risk-watch", "Created payload.presetSlot should match");
    assert(typeof created.expiresAt === "string", "Created expiresAt should exist");

    const resolved = await requestJson<GetShareLinkResponse>(
      baseUrl,
      `/admin/dashboard/share-links/${created.shareCode}`,
      {
        token: viewerToken
      }
    );

    assert(resolved.shareCode === created.shareCode, "Resolved shareCode should match");
    assert(resolved.payload?.orderStatus === "NEW", "Resolved payload.orderStatus should match");
    assert(resolved.payload?.orderSymbol === "BTC-USDT", "Resolved payload.orderSymbol should match");
    assert(resolved.payload?.withdrawalStatus === "APPROVED", "Resolved withdrawalStatus should match");
    assert(
      resolved.payload?.auditAction === "ADMIN_PERMISSIONS_UPDATED",
      "Resolved payload.auditAction should match"
    );
    assert(resolved.payload?.presetSlot === "risk-watch", "Resolved payload.presetSlot should match");

    await requestExpectFailure(baseUrl, "/admin/dashboard/share-links", 400, {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({})
    });

    await prisma.dashboardShareLink.update({
      where: { code: created.shareCode as string },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    await requestExpectFailure(baseUrl, `/admin/dashboard/share-links/${created.shareCode}`, 410, {
      token: ownerToken
    });

    console.log("E2E admin dashboard share-link flow passed");
    console.log(`- owner: ${ownerEmail}`);
    console.log(`- viewer: ${viewerEmail}`);
  } finally {
    await app.close();

    await prisma.dashboardShareLink.deleteMany({
      where: {
        createdByUser: {
          email: {
            in: [ownerEmail, viewerEmail]
          }
        }
      }
    });

    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorEmail: ownerEmail }, { actorEmail: viewerEmail }]
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [ownerEmail, viewerEmail]
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
