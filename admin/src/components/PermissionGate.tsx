import type { ReactNode } from "react";
import { useAdminAuth } from "../features/auth/auth-context";

export type AdminPermission =
  | "USER_READ"
  | "ORDER_READ"
  | "WALLET_LEDGER_READ"
  | "WITHDRAWAL_READ"
  | "WITHDRAWAL_APPROVE"
  | "WITHDRAWAL_REJECT"
  | "WITHDRAWAL_BROADCAST"
  | "WITHDRAWAL_CONFIRM"
  | "WITHDRAWAL_FAIL"
  | "BALANCE_ADJUST"
  | "AUDIT_LOG_READ"
  | "SUPPORT_TICKET_READ"
  | "SUPPORT_TICKET_REPLY"
  | "ADMIN_PERMISSION_READ"
  | "ADMIN_PERMISSION_WRITE"
  | "COMPLIANCE_APPROVE";

type PermissionGateProps = {
  require?: AdminPermission | AdminPermission[];
  requireAny?: AdminPermission[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function usePermissions(): AdminPermission[] {
  const { session } = useAdminAuth();
  const raw = (session as Record<string, unknown> | null)?.permissions;
  if (Array.isArray(raw)) {
    return raw as AdminPermission[];
  }
  return [];
}

export function hasPermission(
  userPermissions: AdminPermission[],
  required: AdminPermission | AdminPermission[]
): boolean {
  if (Array.isArray(required)) {
    return required.every((p) => userPermissions.includes(p));
  }
  return userPermissions.includes(required);
}

export function hasAnyPermission(
  userPermissions: AdminPermission[],
  required: AdminPermission[]
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function PermissionGate({
  require,
  requireAny,
  fallback = null,
  children
}: PermissionGateProps) {
  const permissions = usePermissions();

  if (require && !hasPermission(permissions, require)) {
    return <>{fallback}</>;
  }

  if (requireAny && !hasAnyPermission(permissions, requireAny)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
