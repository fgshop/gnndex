import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AdminAuthSession,
  clearAdminSession,
  getAdminSession,
  setAdminSession,
  subscribeAdminAuthSession
} from "./auth-storage";

type AdminAuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  session: AdminAuthSession | null;
  setSession: (session: AdminAuthSession) => void;
  clearSession: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSessionState] = useState<AdminAuthSession | null>(null);

  useEffect(() => {
    setSessionState(getAdminSession());
    setIsReady(true);

    return subscribeAdminAuthSession(() => {
      setSessionState(getAdminSession());
    });
  }, []);

  const setSession = (next: AdminAuthSession) => {
    setSessionState(next);
    setAdminSession(next);
  };

  const clearSession = () => {
    setSessionState(null);
    clearAdminSession();
  };

  const value = useMemo(
    () => ({
      isReady,
      isAuthenticated: Boolean(session?.tokens?.accessToken),
      session,
      setSession,
      clearSession
    }),
    [isReady, session]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }

  return context;
}
