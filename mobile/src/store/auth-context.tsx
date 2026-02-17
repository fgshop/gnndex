import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import {
  MobileAuthSession,
  clearMobileSession,
  getMobileSession,
  setMobileSession
} from "./auth-storage";

type MobileAuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  session: MobileAuthSession | null;
  login: (args: { email: string; password: string; twoFactorCode?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  setSession: (session: MobileAuthSession) => Promise<void>;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSessionState] = useState<MobileAuthSession | null>(null);

  useEffect(() => {
    const run = async () => {
      const next = await getMobileSession();
      setSessionState(next);
      setIsReady(true);
    };

    run().catch(() => {
      setSessionState(null);
      setIsReady(true);
    });
  }, []);

  const setSession = async (next: MobileAuthSession) => {
    setSessionState(next);
    await setMobileSession(next);
  };

  const login: MobileAuthContextValue["login"] = async ({
    email,
    password,
    twoFactorCode
  }) => {
    const { data, error } = await api.POST("/auth/login", {
      body: {
        email,
        password,
        twoFactorCode
      }
    });

    if (error || !data) {
      return false;
    }

    const payload = data as MobileAuthSession;
    await setSession(payload);
    return true;
  };

  const logout = async () => {
    const refreshToken = session?.tokens?.refreshToken;
    if (refreshToken) {
      await api.POST("/auth/logout", {
        body: { refreshToken }
      });
    }

    setSessionState(null);
    await clearMobileSession();
  };

  const value = useMemo(
    () => ({
      isReady,
      isAuthenticated: Boolean(session?.tokens?.accessToken),
      session,
      login,
      logout,
      setSession
    }),
    [isReady, session]
  );

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error("useMobileAuth must be used within MobileAuthProvider");
  }

  return context;
}
