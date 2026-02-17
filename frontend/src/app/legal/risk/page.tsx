"use client";

import { LegalPage } from "../legal-page";

const SECTIONS = [
  { titleKey: "legal.risk.s1", contentKey: "legal.risk.s1.content" },
  { titleKey: "legal.risk.s2", contentKey: "legal.risk.s2.content" },
  { titleKey: "legal.risk.s3", contentKey: "legal.risk.s3.content" },
  { titleKey: "legal.risk.s4", contentKey: "legal.risk.s4.content" },
  { titleKey: "legal.risk.s5", contentKey: "legal.risk.s5.content" },
  { titleKey: "legal.risk.s6", contentKey: "legal.risk.s6.content" },
];

export default function RiskPage() {
  return (
    <main className="min-h-screen px-4 py-10 lg:px-6">
      <LegalPage
        titleKey="legal.risk.title"
        introKey="legal.risk.intro"
        sections={SECTIONS}
        warningKey="legal.risk.warning"
      />
    </main>
  );
}
