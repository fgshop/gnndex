import { createGnndexClient } from "@gnndex/api-client";
import {
  clearAdminSession,
  getAdminSession,
  setAdminSession
} from "../features/auth/auth-storage";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";
const baseUrl = apiBaseUrl;
let refreshInFlight: Promise<string | null> | null = null;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function shouldSkipRefresh(url: string): boolean {
  return ["/auth/login", "/auth/refresh", "/auth/register"].some((path) => url.includes(path));
}

async function refreshAccessToken(): Promise<string | null> {
  const session = getAdminSession();
  const refreshToken = session?.tokens?.refreshToken;

  if (!refreshToken) {
    clearAdminSession();
    return null;
  }

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearAdminSession();
    return null;
  }

  const payload = (await response.json()) as {
    user?: { userId?: string; email?: string; role?: string };
    permissions?: string[];
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
      refreshTokenJwt?: string;
      accessTokenTtl?: string;
      refreshTokenExpiresAt?: string;
    };
  };

  if (!payload.tokens?.accessToken) {
    clearAdminSession();
    return null;
  }

  setAdminSession({
    user: payload.user ?? session?.user,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : session?.permissions,
    tokens: {
      ...session?.tokens,
      ...payload.tokens
    }
  });

  return payload.tokens.accessToken;
}

async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);
  const headers = new Headers(init?.headers ?? {});
  const accessToken = getAdminSession()?.tokens?.accessToken;

  if (
    init?.body &&
    !headers.has("Content-Type") &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers
  });

  if (response.status !== 401 || shouldSkipRefresh(url)) {
    return response;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  const newAccessToken = await refreshInFlight;
  if (!newAccessToken) {
    return response;
  }

  const retryHeaders = new Headers(init?.headers ?? {});
  retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);

  return fetch(input, {
    ...init,
    headers: retryHeaders
  });
}

export const api = createGnndexClient(baseUrl, {
  fetch: fetchWithAuth
});
