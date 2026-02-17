export type AdminAuthSession = {
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

const SESSION_KEY = "gnndex.admin.auth.session";
const AUTH_CHANGED_EVENT = "gnndex-admin-auth-changed";

export function getAdminSession(): AdminAuthSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminAuthSession;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminAuthSession | null) {
  if (!session) {
    clearAdminSession();
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAdminSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeAdminAuthSession(handler: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
