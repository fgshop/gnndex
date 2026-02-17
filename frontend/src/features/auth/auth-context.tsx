"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthSession,
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  subscribeAuthSessionChanged
} from "./auth-storage";

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSessionState] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSessionState(getStoredSession());
    setIsReady(true);

    return subscribeAuthSessionChanged(() => {
      setSessionState(getStoredSession());
    });
  }, []);

  const setSession = (next: AuthSession) => {
    setSessionState(next);
    setStoredSession(next);
  };

  const clearSession = () => {
    setSessionState(null);
    clearStoredSession();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      isAuthenticated: Boolean(session?.tokens?.accessToken),
      setSession,
      clearSession
    }),
    [isReady, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
