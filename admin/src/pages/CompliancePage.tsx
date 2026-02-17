import { useTranslation } from "../i18n/locale-context";

export function CompliancePage() {
  const { t } = useTranslation();

  return (
    <main>
      <h2>{t("compliance.title")}</h2>
      <p className="muted">{t("compliance.subtitle")}</p>
      <div className="stats-grid">
        <article className="stat-card">
          <p>{t("compliance.amlQueue")}</p>
          <strong>14</strong>
        </article>
        <article className="stat-card">
          <p>{t("compliance.sanctionHits")}</p>
          <strong>2</strong>
        </article>
        <article className="stat-card">
          <p>{t("compliance.casesClosed7d")}</p>
          <strong>39</strong>
        </article>
      </div>
    </main>
  );
}
