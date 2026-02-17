import "reflect-metadata";
import { hash } from "bcryptjs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AdminPermission, PrismaClient } from "@prisma/client";
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

async function requestFirstSseEvent(
  baseUrl: string,
  path: string,
  token: string
): Promise<unknown> {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`
    },
    signal: controller.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`GET ${path} -> ${response.status}: SSE connection failed`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        continue;
      }

      controller.abort();
      return parseJsonSafely(dataLines.join("\n"));
    }
  }

  throw new Error("No SSE event received");
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

type DashboardOverviewResponse = {
  permissions?: {
    orderRead?: boolean;
    withdrawalRead?: boolean;
    auditLogRead?: boolean;
  };
  orders?: {
    permissionDenied?: boolean;
    pagination?: { limit?: number };
    partialError?: { code?: string; message?: string } | null;
  };
  withdrawals?: {
    permissionDenied?: boolean;
    partialError?: { code?: string; message?: string } | null;
  };
  auditLogs?: {
    permissionDenied?: boolean;
    partialError?: { code?: string; message?: string } | null;
  };
};

async function main() {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 100000)}`;
  const password = "GnnDEX!2345";

  const fullEmail = createEmail("admin-overview-full", suffix);
  const orderOnlyEmail = createEmail("admin-overview-order-only", suffix);

  const fullPermissions: AdminPermission[] = ["ORDER_READ", "WITHDRAWAL_READ", "AUDIT_LOG_READ"];
  const orderOnlyPermissions: AdminPermission[] = ["ORDER_READ"];

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
    await seedAdmin(prisma, fullEmail, password, fullPermissions);
    await seedAdmin(prisma, orderOnlyEmail, password, orderOnlyPermissions);

    await app.listen(0, "127.0.0.1");
    const server = app.getHttpServer() as { address: () => { port: number } };
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/v1`;

    const fullToken = await login(baseUrl, fullEmail, password);
    const orderOnlyToken = await login(baseUrl, orderOnlyEmail, password);

    const fullOverview = await requestJson<DashboardOverviewResponse>(
      baseUrl,
      "/admin/dashboard/overview?limit=5",
      { token: fullToken }
    );
    assert(fullOverview.permissions?.orderRead === true, "Full admin should have orderRead=true");
    assert(fullOverview.permissions?.withdrawalRead === true, "Full admin should have withdrawalRead=true");
    assert(fullOverview.permissions?.auditLogRead === true, "Full admin should have auditLogRead=true");
    assert(fullOverview.orders?.permissionDenied === false, "Full admin orders should not be denied");
    assert(fullOverview.orders?.partialError == null, "Full admin orders partialError should be null");
    assert(
      fullOverview.withdrawals?.permissionDenied === false,
      "Full admin withdrawals should not be denied"
    );
    assert(
      fullOverview.withdrawals?.partialError == null,
      "Full admin withdrawals partialError should be null"
    );
    assert(fullOverview.auditLogs?.permissionDenied === false, "Full admin audit logs should not be denied");
    assert(fullOverview.auditLogs?.partialError == null, "Full admin audit logs partialError should be null");
    assert(fullOverview.orders?.pagination?.limit === 5, "Overview query limit should propagate");

    const limitedOverview = await requestJson<DashboardOverviewResponse>(
      baseUrl,
      "/admin/dashboard/overview?limit=5",
      { token: orderOnlyToken }
    );
    assert(limitedOverview.permissions?.orderRead === true, "Order-only admin should have orderRead=true");
    assert(
      limitedOverview.permissions?.withdrawalRead === false,
      "Order-only admin should have withdrawalRead=false"
    );
    assert(limitedOverview.permissions?.auditLogRead === false, "Order-only admin should have auditLogRead=false");
    assert(limitedOverview.orders?.permissionDenied === false, "Order-only admin orders should be visible");
    assert(
      limitedOverview.withdrawals?.permissionDenied === true,
      "Order-only admin withdrawals should be hidden"
    );
    assert(
      limitedOverview.withdrawals?.partialError?.code === "PERMISSION_DENIED",
      "Order-only admin withdrawals should report PERMISSION_DENIED"
    );
    assert(limitedOverview.auditLogs?.permissionDenied === true, "Order-only admin audit logs should be hidden");
    assert(
      limitedOverview.auditLogs?.partialError?.code === "PERMISSION_DENIED",
      "Order-only admin audit logs should report PERMISSION_DENIED"
    );

    const limitedStreamEvent = await requestFirstSseEvent(
      baseUrl,
      "/admin/dashboard/stream?limit=3&intervalMs=1000",
      orderOnlyToken
    );
    const limitedStreamRecord = limitedStreamEvent as {
      eventType?: string;
      eventVersion?: number;
      diff?: {
        changed?: boolean;
      } | null;
      data?: {
        generatedAt?: string;
        orders?: { permissionDenied?: boolean; partialError?: { code?: string } | null };
        withdrawals?: { permissionDenied?: boolean; partialError?: { code?: string } | null };
        auditLogs?: { permissionDenied?: boolean; partialError?: { code?: string } | null };
      };
    };
    assert(
      limitedStreamRecord.eventType === "admin.dashboard.overview.partial",
      "Order-only dashboard stream should emit overview.partial event"
    );
    assert(limitedStreamRecord.eventVersion === 2, "Order-only stream eventVersion should be 2");
    assert(limitedStreamRecord.diff != null, "Order-only stream should include diff payload");
    assert(
      typeof limitedStreamRecord.data?.generatedAt === "string",
      "Order-only stream should include overview payload"
    );
    assert(
      limitedStreamRecord.data?.orders?.permissionDenied === false,
      "Order-only stream orders should remain visible"
    );
    assert(
      limitedStreamRecord.data?.withdrawals?.partialError?.code === "PERMISSION_DENIED",
      "Order-only stream withdrawals should report PERMISSION_DENIED"
    );
    assert(
      limitedStreamRecord.data?.auditLogs?.partialError?.code === "PERMISSION_DENIED",
      "Order-only stream audit logs should report PERMISSION_DENIED"
    );

    const streamEvent = await requestFirstSseEvent(
      baseUrl,
      "/admin/dashboard/stream?limit=3&intervalMs=1000",
      fullToken
    );
    const streamRecord = streamEvent as {
      eventType?: string;
      eventVersion?: number;
      diff?: {
        changed?: boolean;
        sectionChanges?: {
          orders?: boolean;
          withdrawals?: boolean;
          auditLogs?: boolean;
        };
        summaryDelta?: {
          openOrdersLoaded?: number;
          pendingWithdrawalsLoaded?: number;
          riskAlertsLoaded?: number;
          adminActionsLoaded?: number;
          permissionChangesLoaded?: number;
        };
      } | null;
      data?: { generatedAt?: string };
    };
    assert(
      streamRecord.eventType === "admin.dashboard.overview.full" ||
        streamRecord.eventType === "admin.dashboard.overview.partial",
      "Dashboard stream should emit overview.full/overview.partial events"
    );
    assert(streamRecord.eventVersion === 2, "Dashboard stream eventVersion should be 2");
    assert(
      typeof streamRecord.data?.generatedAt === "string",
      "Dashboard stream should include overview payload"
    );
    assert(streamRecord.diff != null, "Dashboard stream should include diff payload");
    assert(
      typeof streamRecord.diff?.changed === "boolean",
      "Dashboard stream diff.changed should be boolean"
    );

    const filteredStreamEvent = await requestFirstSseEvent(
      baseUrl,
      "/admin/dashboard/stream?limit=3&intervalMs=1000&orderStatus=NEW&orderSymbol=BTC-USDT&withdrawalStatus=APPROVED&auditAction=ADMIN",
      fullToken
    );
    const filteredStreamRecord = filteredStreamEvent as {
      eventType?: string;
      eventVersion?: number;
      diff?: {
        summaryDelta?: {
          openOrdersLoaded?: number;
          pendingWithdrawalsLoaded?: number;
          riskAlertsLoaded?: number;
          adminActionsLoaded?: number;
          permissionChangesLoaded?: number;
        };
      } | null;
      data?: { generatedAt?: string };
    };
    assert(
      filteredStreamRecord.eventType === "admin.dashboard.overview.full" ||
        filteredStreamRecord.eventType === "admin.dashboard.overview.partial",
      "Filtered dashboard stream should emit overview.full/overview.partial events"
    );
    assert(filteredStreamRecord.eventVersion === 2, "Filtered dashboard stream eventVersion should be 2");
    assert(
      typeof filteredStreamRecord.data?.generatedAt === "string",
      "Filtered dashboard stream should include overview payload"
    );
    assert(filteredStreamRecord.diff != null, "Filtered dashboard stream should include diff payload");

    await requestExpectFailure(baseUrl, "/admin/dashboard/overview?limit=0", 400, {
      token: fullToken
    });

    console.log("E2E admin dashboard overview flow passed");
    console.log(`- full: ${fullEmail}`);
    console.log(`- order-only: ${orderOnlyEmail}`);
  } finally {
    await app.close();

    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorEmail: fullEmail }, { actorEmail: orderOnlyEmail }]
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [fullEmail, orderOnlyEmail]
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
