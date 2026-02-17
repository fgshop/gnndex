"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";
import { useTranslation } from "@/i18n/locale-context";

type RegisterResult = {
  user?: { email?: string; userId?: string; role?: string; status?: string };
  tokens?: { accessToken?: string; refreshToken?: string };
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

/* ── Password strength ── */

type PasswordStrength = "empty" | "weak" | "medium" | "strong";

function evaluatePasswordStrength(pw: string): PasswordStrength {
  if (!pw) return "empty";

  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;

  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

const STRENGTH_CONFIG: Record<Exclude<PasswordStrength, "empty">, { labelKey: string; width: string; color: string }> = {
  weak: { labelKey: "auth.register.strengthWeak", width: "w-1/3", color: "bg-destructive" },
  medium: { labelKey: "auth.register.strengthMedium", width: "w-2/3", color: "bg-amber-500" },
  strong: { labelKey: "auth.register.strengthStrong", width: "w-full", color: "bg-emerald-500" },
};

/* ── SVG icons ── */

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <rect height="16" rx="2" width="20" x="2" y="4" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <rect height="11" rx="2" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
      <span className="font-[var(--font-display)] text-2xl font-bold text-primary-foreground">G</span>
    </div>
  );
}

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(t("auth.register.errorEmailRequired"));
      return;
    }
    if (!password) {
      setErrorMessage(t("auth.register.errorPasswordRequired"));
      return;
    }
    if (password.length < 8) {
      setErrorMessage(t("auth.register.errorPasswordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("auth.register.errorPasswordsMismatch"));
      return;
    }
    if (!acceptedTerms) {
      setErrorMessage(t("auth.register.errorTermsRequired"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as RegisterResult | unknown;

      if (!response.ok) {
        setErrorMessage(toErrorMessage(payload, t("auth.register.errorRegistrationFailed")));
        return;
      }

      if (!payload || typeof payload !== "object") {
        setErrorMessage(t("auth.register.errorUnexpected"));
        return;
      }

      setSuccessMessage(t("auth.register.success"));
      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch {
      setErrorMessage(t("auth.register.errorNetwork"));
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
          {t("auth.register.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.register.subtitle")}
        </p>
      </div>

      {/* Success message */}
      {successMessage ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircleIcon className="mt-0.5 shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
        </div>
      ) : null}

      {/* Error */}
      {errorMessage ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-destructive/20 text-center text-[10px] font-bold leading-4 text-destructive">
            !
          </div>
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      ) : null}

      {/* Form */}
      <form className="space-y-5" onSubmit={onSubmit}>
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="register-email">
            {t("auth.register.emailLabel")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <EnvelopeIcon />
            </span>
            <input
              autoComplete="email"
              className="input-field pl-10"
              id="register-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.register.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="register-password">
            {t("auth.register.passwordLabel")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <LockIcon />
            </span>
            <input
              autoComplete="new-password"
              className="input-field pl-10 pr-11"
              id="register-password"
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.register.passwordPlaceholder")}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? t("auth.register.hidePassword") : t("auth.register.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              type="button"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {/* Strength indicator */}
          {passwordStrength !== "empty" ? (
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${STRENGTH_CONFIG[passwordStrength].width} ${STRENGTH_CONFIG[passwordStrength].color}`}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("auth.register.passwordStrength")}{" "}
                <span
                  className={
                    passwordStrength === "strong"
                      ? "font-medium text-emerald-500"
                      : passwordStrength === "medium"
                        ? "font-medium text-amber-500"
                        : "font-medium text-destructive"
                  }
                >
                  {t(STRENGTH_CONFIG[passwordStrength].labelKey)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Confirm password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="register-confirm">
            {t("auth.register.confirmPasswordLabel")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <LockIcon />
            </span>
            <input
              autoComplete="new-password"
              className={`input-field pl-10 pr-11 ${
                passwordsMismatch
                  ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                  : passwordsMatch
                    ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    : ""
              }`}
              id="register-confirm"
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("auth.register.confirmPasswordPlaceholder")}
              required
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              aria-label={showConfirmPassword ? t("auth.register.hidePassword") : t("auth.register.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              tabIndex={-1}
              type="button"
            >
              {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {passwordsMismatch ? (
            <p className="mt-1.5 text-xs text-destructive">{t("auth.register.passwordsDoNotMatch")}</p>
          ) : null}
          {passwordsMatch ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-500">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              {t("auth.register.passwordsMatch")}
            </p>
          ) : null}
        </div>

        {/* Terms */}
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              checked={acceptedTerms}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm leading-relaxed text-muted-foreground">
              {t("auth.register.termsAgree")}{" "}
              <Link className="font-medium text-primary hover:text-primary/80" href="/legal/terms" target="_blank">
                {t("auth.register.termsOfService")}
              </Link>{" "}
              {t("auth.register.termsAnd")}{" "}
              <Link className="font-medium text-primary hover:text-primary/80" href="/legal/privacy" target="_blank">
                {t("auth.register.privacyPolicy")}
              </Link>
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          className="btn-primary w-full py-3"
          disabled={loading || !acceptedTerms}
          type="submit"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="animate-spin" />
              {t("auth.register.submitting")}
            </span>
          ) : (
            t("auth.register.submit")
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("auth.register.alreadyRegistered")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        <Link
          className="font-semibold text-primary transition-colors hover:text-primary/80"
          href="/auth/login"
        >
          {t("auth.register.signInToAccount")}
        </Link>
      </p>
    </section>
  );
}
