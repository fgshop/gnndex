import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../features/auth/auth-context";

export function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthenticated, session } = useAdminAuth();

  if (!isReady) {
    return <div style={{ padding: 20 }}>Checking session...</div>;
  }

  if (!isAuthenticated || session?.user?.role !== "ADMIN") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
