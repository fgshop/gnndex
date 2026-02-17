"use client";

import { useTranslation } from "@/i18n/locale-context";
import { LegalPage } from "../legal-page";

const SECTIONS = [
  { titleKey: "legal.fees.s1", contentKey: "legal.fees.s1.content" },
  { titleKey: "legal.fees.s2", contentKey: "legal.fees.s2.content" },
  { titleKey: "legal.fees.s3", contentKey: "legal.fees.s3.content" },
  { titleKey: "legal.fees.s4", contentKey: "legal.fees.s4.content" },
];

const FEE_TIERS = [
  { tier: "1", volume: "< $50K", maker: "0.10%", taker: "0.20%" },
  { tier: "2", volume: "$50K - $500K", maker: "0.08%", taker: "0.18%" },
  { tier: "3", volume: "$500K - $2M", maker: "0.06%", taker: "0.15%" },
  { tier: "4", volume: "> $2M", maker: "0.04%", taker: "0.12%" },
];

function FeeTable() {
  const { t } = useTranslation();

  return (
    <section className="panel overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("legal.fees.s1")}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3">{t("legal.fees.tier")}</th>
              <th className="px-5 py-3">{t("legal.fees.volume")}</th>
              <th className="px-5 py-3 text-right">{t("legal.fees.maker")}</th>
              <th className="px-5 py-3 text-right">{t("legal.fees.taker")}</th>
            </tr>
          </thead>
          <tbody>
            {FEE_TIERS.map((row) => (
              <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors" key={row.tier}>
                <td className="px-5 py-3 font-medium text-foreground">{row.tier}</td>
                <td className="px-5 py-3 text-muted-foreground">{row.volume}</td>
                <td className="px-5 py-3 text-right font-mono text-sm text-emerald-500">{row.maker}</td>
                <td className="px-5 py-3 text-right font-mono text-sm text-foreground">{row.taker}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("legal.fees.s2")}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-500">{t("legal.fees.free")}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("legal.fees.s3")}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{t("legal.fees.varies")}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("legal.fees.s4")}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{t("legal.fees.none")}</p>
        </div>
      </div>
    </section>
  );
}

export default function FeesPage() {
  return (
    <main className="min-h-screen px-4 py-10 lg:px-6">
      <LegalPage
        titleKey="legal.fees.title"
        introKey="legal.fees.intro"
        sections={SECTIONS}
      >
        <FeeTable />
      </LegalPage>
    </main>
  );
}
