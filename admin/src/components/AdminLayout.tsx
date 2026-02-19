import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "../features/auth/auth-context";
import { usePermissions, hasPermission } from "./PermissionGate";
import type { AdminPermission } from "./PermissionGate";
import { api } from "../lib/api";
import { LOCALE_META, type Locale, useTranslation } from "../i18n/locale-context";

type NavItem = {
  to: string;
  labelKey: string;
  icon: string;
  require?: AdminPermission | AdminPermission[];
  requireAny?: AdminPermission[];
};

type NavSection = {
  titleKey: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    titleKey: "admin.nav.overview",
    items: [
      { to: "/dashboard", labelKey: "admin.nav.dashboard", icon: "\u25A3" }
    ]
  },
  {
    titleKey: "admin.nav.operations",
    items: [
      { to: "/users", labelKey: "admin.nav.users", icon: "\u25CB", require: "USER_READ" },
      { to: "/orders", labelKey: "admin.nav.orders", icon: "\u25A1", require: "ORDER_READ" },
      {
        to: "/deposits",
        labelKey: "admin.nav.deposits",
        icon: "\u2193",
        require: "DEPOSIT_READ"
      },
      {
        to: "/withdrawals",
        labelKey: "admin.nav.withdrawals",
        icon: "\u2191",
        require: "WITHDRAWAL_READ"
      },
      {
        to: "/wallet-ledger",
        labelKey: "admin.nav.walletLedger",
        icon: "\u2261",
        require: "WALLET_LEDGER_READ"
      },
      {
        to: "/coin-listings",
        labelKey: "admin.nav.coinListings",
        icon: "\u25C8",
        require: "ADMIN_PERMISSION_READ"
      }
    ]
  },
  {
    titleKey: "admin.nav.administration",
    items: [
      {
        to: "/notices",
        labelKey: "admin.nav.notices",
        icon: "\u2637",
        require: "NOTICE_READ"
      },
      {
        to: "/permissions",
        labelKey: "admin.nav.permissions",
        icon: "\u26BF",
        require: "ADMIN_PERMISSION_READ"
      },
      { to: "/audit-logs", labelKey: "admin.nav.auditLogs", icon: "\u2637", require: "AUDIT_LOG_READ" }
    ]
  },
  {
    titleKey: "admin.nav.supportRisk",
    items: [
      { to: "/support-tickets", labelKey: "admin.nav.supportTickets", icon: "\u2709" },
      { to: "/risk", labelKey: "admin.nav.riskPolicy", icon: "\u26A0" },
      { to: "/compliance", labelKey: "admin.nav.compliance", icon: "\u2696" }
    ]
  }
];

const unsafeApi = api as unknown as {
  GET: (path: string, options?: unknown) => Promise<{ data?: unknown; error?: unknown }>;
};

export function AdminLayout() {
  const { session, setSession, clearSession } = useAdminAuth();
  const { locale, setLocale, t } = useTranslation();
  const permissions = usePermissions();
  const hasUnknownPermissions =
    session?.user?.role === "ADMIN" &&
    !Array.isArray((session as Record<string, unknown> | null)?.permissions);

  useEffect(() => {
    if (!hasUnknownPermissions || !session?.tokens?.accessToken) {
      return;
    }

    let active = true;
    void unsafeApi.GET("/admin/me/permissions").then(({ data, error }) => {
      if (!active || error || !data || typeof data !== "object") {
        return;
      }

      const payload = data as { permissions?: string[] };
      if (!Array.isArray(payload.permissions)) {
        return;
      }

      setSession({
        ...(session ?? {}),
        permissions: payload.permissions
      });
    });

    return () => {
      active = false;
    };
  }, [hasUnknownPermissions, session, setSession]);

  const handleLogout = async () => {
    const refreshToken = session?.tokens?.refreshToken;
    if (refreshToken) {
      await api.POST("/auth/logout", { body: { refreshToken } });
    }
    clearSession();
  };

  const isVisible = (item: NavItem): boolean => {
    if (hasUnknownPermissions) {
      return true;
    }
    if (item.require) {
      return hasPermission(permissions, item.require);
    }
    if (item.requireAny) {
      return item.requireAny.some((p) => permissions.includes(p));
    }
    return true;
  };

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <h1>{t("admin.brand")}</h1>
        <p className="admin-sidebar-subtitle">{t("admin.subtitle")}</p>
        <nav>
          {navSections.map((section) => {
            const visibleItems = section.items.filter(isVisible);
            if (visibleItems.length === 0) {
              return null;
            }
            return (
              <div key={section.titleKey}>
                <div className="admin-nav-section">{t(section.titleKey)}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`}
                  >
                    <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>
                      {item.icon}
                    </span>
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="admin-session-box">
          <label style={{ display: "block", marginBottom: 6 }}>
            {t("lang.select")}
          </label>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            style={{ width: "100%", marginBottom: 10 }}
          >
            {LOCALE_META.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.flag} {entry.label}
              </option>
            ))}
          </select>
          <p>{session?.user?.email ?? t("admin.noSession")}</p>
          <button className="admin-btn secondary" onClick={handleLogout} type="button" style={{ marginTop: 0 }}>
            {t("admin.logout")}
          </button>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
