import { createGnndexClient } from "@gnndex/api-client";
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredSession,
  setStoredSession,
  updateStoredTokens
} from "@/features/auth/auth-storage";

// Use relative path so all requests go through Next.js rewrites (no CORS issues).
// next.config.mjs proxies /v1/* to the actual backend based on NEXT_PUBLIC_API_BASE_URL.
export const apiBaseUrl = "/v1";
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

async function attemptRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredSession();
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const payload = (await response.json()) as {
    user?: { userId?: string; email?: string; role?: string };
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
      refreshTokenJwt?: string;
      accessTokenTtl?: string;
      refreshTokenExpiresAt?: string;
    };
  };

  if (!payload.tokens?.accessToken) {
    clearStoredSession();
    return null;
  }

  updateStoredTokens(payload.tokens);
  const current = getStoredSession();
  setStoredSession({
    user: payload.user ?? current?.user,
    tokens: {
      ...current?.tokens,
      ...payload.tokens
    }
  });

  return payload.tokens.accessToken;
}

async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);
  const headers = new Headers(init?.headers ?? {});
  const accessToken = getStoredAccessToken();

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
    refreshInFlight = attemptRefreshToken().finally(() => {
      refreshInFlight = null;
    });
  }

  const refreshedAccessToken = await refreshInFlight;
  if (!refreshedAccessToken) {
    return response;
  }

  const retryHeaders = new Headers(init?.headers ?? {});
  retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);

  return fetch(input, {
    ...init,
    headers: retryHeaders
  });
}

export const api = createGnndexClient(apiBaseUrl, {
  fetch: fetchWithAuth
});
