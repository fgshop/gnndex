import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../features/auth/auth-context";
import { LOCALE_META, type Locale, useTranslation } from "../i18n/locale-context";
import { apiBaseUrl } from "../lib/api";
import { getApiErrorMessage } from "../lib/api-error";

const TEMP_ADMIN_EMAIL = "admin@gnndex.com";
const TEMP_ADMIN_PASSWORD = "GlobalDEX!2345";

function toHttpErrorMessage(status: number, payload: unknown, fallback: string): string {
  const detail = getApiErrorMessage(payload, fallback);
  return `${detail} (HTTP ${status})`;
}

export function AdminLoginPage() {
  const { locale, setLocale, t } = useTranslation();
  const navigate = useNavigate();
  const { setSession } = useAdminAuth();
  const [email, setEmail] = useState(TEMP_ADMIN_EMAIL);
  const [password, setPassword] = useState(TEMP_ADMIN_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          twoFactorCode: code || undefined,
          userAgent: navigator.userAgent
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            user?: { userId?: string; email?: string; role?: string };
            permissions?: string[];
            tokens?: {
              accessToken?: string;
              refreshToken?: string;
              refreshTokenJwt?: string;
            };
          }
        | unknown;

      if (!response.ok) {
        setMessage(toHttpErrorMessage(response.status, payload, t("auth.loginFailed")));
        return;
      }
      if (!payload || typeof payload !== "object") {
        setMessage(t("auth.loginFailedEmpty"));
        return;
      }

      const loginResult = payload as {
        user?: { userId?: string; email?: string; role?: string };
        permissions?: string[];
        tokens?: {
          accessToken?: string;
          refreshToken?: string;
          refreshTokenJwt?: string;
        };
      };

      if (loginResult.user?.role !== "ADMIN") {
        setMessage(t("auth.adminRequired"));
        return;
      }

      setSession({
        user: loginResult.user,
        permissions: Array.isArray(loginResult.permissions) ? loginResult.permissions : [],
        tokens: loginResult.tokens
      });
      navigate("/dashboard", { replace: true });
    } catch {
      setMessage(t("auth.loginFailedApi", { url: apiBaseUrl }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-wrap">
      <section className="admin-login-card">
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>{t("lang.select")}</label>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            style={{ width: "100%" }}
          >
            {LOCALE_META.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.flag} {entry.label}
              </option>
            ))}
          </select>
        </div>
        <h2>{t("auth.title")}</h2>
        <p className="muted">{t("auth.subtitle")}</p>
        <p className="muted" style={{ marginTop: 4 }}>
          {t("auth.apiTarget")}: <code>{apiBaseUrl}</code>
        </p>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")} />
          <div className="admin-password-input">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
            <button
              className="admin-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
            >
              {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            </button>
          </div>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("auth.twoFactorPlaceholder")} />
          <button className="admin-btn" disabled={loading} type="submit">
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>
        <div className="admin-temp-credentials">
          <p>{t("auth.tempCredentials")}</p>
          <p>
            ID: <code>{TEMP_ADMIN_EMAIL}</code>
          </p>
          <p>
            PW: <code>{TEMP_ADMIN_PASSWORD}</code>
          </p>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </section>
    </main>
  );
}
