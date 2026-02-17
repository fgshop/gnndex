import { FormEvent, useState } from "react";
import { useTranslation } from "../i18n/locale-context";
import { api } from "../lib/api";

export function RiskPolicyPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("trader@gnndex.com");
  const [asset, setAsset] = useState("USDT");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("risk-policy-test");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdjust = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult("");

    const { data, error } = await api.POST("/wallet/admin-adjust", {
      body: { email, asset, amount, reason }
    });

    setLoading(false);

    if (error) {
      setResult(t("risk.adjustFailed"));
      return;
    }

    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <main>
      <h2>{t("risk.title")}</h2>
      <p className="muted">{t("risk.subtitle")}</p>
      <div className="table-card">
        <div className="table-row table-head">
          <span>{t("risk.tablePolicy")}</span>
          <span>{t("risk.tableScope")}</span>
          <span>{t("risk.tableStatus")}</span>
        </div>
        <div className="table-row">
          <span>{t("risk.dailyLimit")}</span>
          <span>{t("risk.dailyLimitScope")}</span>
          <span>{t("common.enabled")}</span>
        </div>
        <div className="table-row">
          <span>{t("risk.loginVelocity")}</span>
          <span>{t("risk.loginVelocityScope")}</span>
          <span>{t("common.enabled")}</span>
        </div>
      </div>
      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleAdjust}>
        <h3>{t("risk.walletAdjustTitle")}</h3>
        <div className="admin-form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("risk.emailPlaceholder")} />
          <input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder={t("risk.assetPlaceholder")} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("risk.amountPlaceholder")} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("risk.reasonPlaceholder")} />
        </div>
        <button className="admin-btn" disabled={loading} type="submit">
          {loading ? t("risk.submitting") : t("risk.apply")}
        </button>
        {result ? <pre className="admin-pre">{result}</pre> : null}
      </form>
    </main>
  );
}
