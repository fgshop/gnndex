export type AuthUser = {
  userId?: string;
  email?: string;
  role?: string;
};

export type AuthTokens = {
  accessToken?: string;
  refreshToken?: string;
  refreshTokenJwt?: string;
  accessTokenTtl?: string;
  refreshTokenExpiresAt?: string;
};

export type AuthSession = {
  user?: AuthUser;
  tokens?: AuthTokens;
};

const SESSION_KEY = "gnndex.auth.session";
const LEGACY_ACCESS_KEY = "gnndex.accessToken";
const LEGACY_REFRESH_KEY = "gnndex.refreshToken";
const AUTH_CHANGED_EVENT = "gnndex-auth-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  const accessToken = window.localStorage.getItem(LEGACY_ACCESS_KEY) ?? undefined;
  const refreshToken = window.localStorage.getItem(LEGACY_REFRESH_KEY) ?? undefined;
  if (accessToken || refreshToken) {
    return {
      tokens: { accessToken, refreshToken }
    };
  }

  return null;
}

export function setStoredSession(session: AuthSession | null) {
  if (!isBrowser()) {
    return;
  }

  if (!session) {
    clearStoredSession();
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  if (session.tokens?.accessToken) {
    window.localStorage.setItem(LEGACY_ACCESS_KEY, session.tokens.accessToken);
  }
  if (session.tokens?.refreshToken) {
    window.localStorage.setItem(LEGACY_REFRESH_KEY, session.tokens.refreshToken);
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearStoredSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getStoredAccessToken(): string | undefined {
  return getStoredSession()?.tokens?.accessToken;
}

export function getStoredRefreshToken(): string | undefined {
  return getStoredSession()?.tokens?.refreshToken;
}

export function updateStoredTokens(tokens: AuthTokens) {
  const current = getStoredSession() ?? {};
  setStoredSession({
    ...current,
    tokens: {
      ...current.tokens,
      ...tokens
    }
  });
}

export function subscribeAuthSessionChanged(handler: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
