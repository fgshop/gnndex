"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/i18n/locale-context";
import { LanguageSelector } from "@/components/language-selector";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/markets", labelKey: "nav.markets" },
  { href: "/trade", labelKey: "nav.trade" },
  { href: "/wallet", labelKey: "nav.wallet" },
  { href: "/mypage", labelKey: "nav.account" },
  { href: "/support", labelKey: "nav.support" },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <button
      aria-label={t("theme.toggle")}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:text-foreground hover:bg-secondary"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      type="button"
    >
      <svg
        className={cn(
          "absolute h-[18px] w-[18px] transition-all duration-300",
          resolvedTheme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <svg
        className={cn(
          "absolute h-[18px] w-[18px] transition-all duration-300",
          resolvedTheme === "dark" ? "-rotate-90 scale-0" : "rotate-0 scale-100"
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { isReady, isAuthenticated, session, clearSession } = useAuth();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const refreshToken = session?.tokens?.refreshToken;
    if (refreshToken) {
      await api.POST("/auth/logout", { body: { refreshToken } });
    }
    clearSession();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/25">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight font-[var(--font-display)]">
            Gnn<span className="text-primary">DEX</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {t(item.labelKey)}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1.05rem] h-[2px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right section: Language → Auth/User → Theme (far right) */}
        <div className="flex items-center gap-2.5">
          <LanguageSelector />

          {isReady && !isAuthenticated && (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/auth/login" className="btn-ghost !px-4 !py-2 text-sm">
                {t("auth.login")}
              </Link>
              <Link href="/auth/register" className="btn-primary !px-4 !py-2 text-sm">
                {t("auth.signup")}
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="relative hidden sm:block group">
              <button
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-secondary"
                type="button"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {session?.user?.email?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <span className="hidden max-w-32 truncate text-sm text-muted-foreground lg:block">
                  {session?.user?.email ?? t("auth.signedIn")}
                </span>
                <svg className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Hover dropdown */}
              <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/10">
                  {/* User info */}
                  <div className="border-b border-border px-3 py-2.5 mb-1">
                    <p className="truncate text-sm font-medium text-foreground">{session?.user?.email ?? "-"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{session?.user?.role ?? "USER"}</p>
                  </div>

                  {/* Mypage menu items */}
                  <Link
                    href="/mypage"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                      <rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" />
                    </svg>
                    {t("mypage.tab.overview")}
                  </Link>
                  <Link
                    href="/mypage?tab=assets"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                    </svg>
                    {t("mypage.tab.assets")}
                  </Link>
                  <Link
                    href="/mypage?tab=activity"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                      <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
                    </svg>
                    {t("mypage.tab.activity")}
                  </Link>
                  <Link
                    href="/mypage?tab=security"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    {t("mypage.tab.security")}
                  </Link>

                  {/* Divider + Logout */}
                  <div className="mt-1 border-t border-border pt-1">
                    <button
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onClick={handleLogout}
                      type="button"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                      {t("auth.logout")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ThemeToggle />

          {/* Mobile toggle */}
          <button
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 pb-4 pt-2 md:hidden animate-slide-up">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          {isReady && !isAuthenticated && (
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Link href="/auth/login" className="btn-secondary w-full justify-center" onClick={() => setMobileOpen(false)}>
                {t("auth.login")}
              </Link>
              <Link href="/auth/register" className="btn-primary w-full justify-center" onClick={() => setMobileOpen(false)}>
                {t("auth.signup")}
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center gap-2.5 px-2 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {session?.user?.email?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{session?.user?.email}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.role ?? "USER"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Link href="/mypage" className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMobileOpen(false)}>
                  {t("mypage.tab.overview")}
                </Link>
                <Link href="/mypage?tab=assets" className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMobileOpen(false)}>
                  {t("mypage.tab.assets")}
                </Link>
                <Link href="/mypage?tab=activity" className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMobileOpen(false)}>
                  {t("mypage.tab.activity")}
                </Link>
                <Link href="/mypage?tab=security" className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary" onClick={() => setMobileOpen(false)}>
                  {t("mypage.tab.security")}
                </Link>
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <button className="w-full rounded-lg px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10" onClick={handleLogout} type="button">
                  {t("auth.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
