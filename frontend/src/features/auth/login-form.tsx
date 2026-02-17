"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useTranslation } from "@/i18n/locale-context";
import { apiBaseUrl } from "@/lib/api";

type LoginResult = {
  user?: { email?: string; userId?: string; role?: string };
  tokens?: { accessToken?: string; refreshToken?: string };
  requiresTwoFactor?: boolean;
};

function toErrorMessage(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const record = input as { message?: string | string[]; error?: string };
  if (Array.isArray(record.message) && record.message.length > 0) {
    return record.message.join(", ");
  }
  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message;
  }
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error;
  }

  return fallback;
}

/* ── SVG icons ── */

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="16" rx="2" width="20" x="2" y="4" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="11" rx="2" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="20"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
      <span className="font-[var(--font-display)] text-2xl font-bold text-primary-foreground">
        C
      </span>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(t("auth.login.errorEmailRequired"));
      return;
    }
    if (!password) {
      setErrorMessage(t("auth.login.errorPasswordRequired"));
      return;
    }
    if (requiresTwoFactor && !twoFactorCode.trim()) {
      setErrorMessage(t("auth.login.errorTwoFactorRequired"));
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          twoFactorCode: twoFactorCode.trim() || undefined,
          userAgent: navigator.userAgent,
        }),
      });
      const payload = (await response.json().catch(() => null)) as LoginResult | unknown;

      if (!response.ok) {
        /* Check if 2FA is required based on status or response body */
        const body = payload as { requiresTwoFactor?: boolean; message?: string };
        if (body?.requiresTwoFactor || response.status === 428) {
          setRequiresTwoFactor(true);
          setErrorMessage("");
          return;
        }
        setErrorMessage(toErrorMessage(payload, t("auth.login.errorInvalidCredentials")));
        return;
      }

      if (!payload || typeof payload !== "object") {
        setErrorMessage(t("auth.login.errorUnexpected"));
        return;
      }

      const loginResult = payload as LoginResult;
      if (loginResult.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setErrorMessage("");
        return;
      }

      setSession({
        user: loginResult.user,
        tokens: loginResult.tokens,
      });
      router.push("/");
    } catch {
      setErrorMessage(t("auth.login.errorNetwork"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel animate-fade-up mx-auto w-full max-w-[440px] p-8 sm:p-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <LogoMark />
        <h1 className="mt-5 font-[var(--font-display)] text-2xl font-bold tracking-tight text-foreground">
          {t("auth.login.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.login.subtitle")}
        </p>
      </div>

      {/* Error */}
      {errorMessage ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-destructive/20 text-center text-[10px] font-bold leading-4 text-destructive">
            !
          </div>
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      ) : null}

      {/* 2FA prompt */}
      {requiresTwoFactor && !errorMessage ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <ShieldIcon className="mt-0.5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            {t("auth.login.twoFactorPrompt")}
          </p>
        </div>
      ) : null}

      {/* Form */}
      <form className="space-y-5" onSubmit={onSubmit}>
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="login-email">
            {t("auth.login.emailLabel")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <EnvelopeIcon />
            </span>
            <input
              autoComplete="email"
              className="input-field pl-10"
              id="login-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.login.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="login-password">
            {t("auth.login.passwordLabel")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <LockIcon />
            </span>
            <input
              autoComplete="current-password"
              className="input-field pl-10 pr-11"
              id="login-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.login.passwordPlaceholder")}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              type="button"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* 2FA Code */}
        {requiresTwoFactor ? (
          <div className="animate-fade-up">
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="login-2fa">
              {t("auth.login.verificationCodeLabel")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ShieldIcon />
              </span>
              <input
                autoComplete="one-time-code"
                autoFocus
                className="input-field pl-10 font-mono tracking-[0.3em]"
                id="login-2fa"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                value={twoFactorCode}
              />
            </div>
          </div>
        ) : null}

        {/* Remember & Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              checked={rememberMe}
              className="h-4 w-4 rounded border-border accent-primary"
              onChange={(e) => setRememberMe(e.target.checked)}
              type="checkbox"
            />
            {t("auth.login.rememberMe")}
          </label>
          <Link
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
            href="/auth/forgot-password"
          >
            {t("auth.login.forgotPassword")}
          </Link>
        </div>

        {/* Submit */}
        <button className="btn-primary w-full py-3" disabled={loading} type="submit">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="animate-spin" />
              {t("auth.login.submitting")}
            </span>
          ) : (
            t("auth.login.submit")
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("auth.login.newToGnndex")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        <Link
          className="font-semibold text-primary transition-colors hover:text-primary/80"
          href="/auth/register"
        >
          {t("auth.login.createFreeAccount")}
        </Link>
        {" "}{t("auth.login.startTrading")}
      </p>
    </section>
  );
}
