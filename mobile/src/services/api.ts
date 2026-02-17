import { createGnndexClient } from "@gnndex/api-client";
import {
  clearMobileSession,
  getMobileSession,
  setMobileSession
} from "../store/auth-storage";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
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
  const session = await getMobileSession();
  const refreshToken = session?.tokens?.refreshToken;
  if (!refreshToken) {
    await clearMobileSession();
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    await clearMobileSession();
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
    await clearMobileSession();
    return null;
  }

  await setMobileSession({
    user: payload.user ?? session?.user,
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
  const accessToken = (await getMobileSession())?.tokens?.accessToken;

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
