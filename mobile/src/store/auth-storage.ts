import * as SecureStore from "expo-secure-store";

export type MobileAuthSession = {
  user?: { userId?: string; email?: string; role?: string };
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    refreshTokenJwt?: string;
    accessTokenTtl?: string;
    refreshTokenExpiresAt?: string;
  };
};

const SESSION_KEY = "gnndex.mobile.auth.session";

export async function getMobileSession(): Promise<MobileAuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MobileAuthSession;
  } catch {
    return null;
  }
}

export async function setMobileSession(session: MobileAuthSession | null) {
  if (!session) {
    await clearMobileSession();
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearMobileSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
