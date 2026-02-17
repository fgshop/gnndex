"use client";

import { LegalPage } from "../legal-page";

const SECTIONS = [
  { titleKey: "legal.privacy.s1", contentKey: "legal.privacy.s1.content" },
  { titleKey: "legal.privacy.s2", contentKey: "legal.privacy.s2.content" },
  { titleKey: "legal.privacy.s3", contentKey: "legal.privacy.s3.content" },
  { titleKey: "legal.privacy.s4", contentKey: "legal.privacy.s4.content" },
  { titleKey: "legal.privacy.s5", contentKey: "legal.privacy.s5.content" },
  { titleKey: "legal.privacy.s6", contentKey: "legal.privacy.s6.content" },
  { titleKey: "legal.privacy.s7", contentKey: "legal.privacy.s7.content" },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10 lg:px-6">
      <LegalPage
        titleKey="legal.privacy.title"
        introKey="legal.privacy.intro"
        sections={SECTIONS}
      />
    </main>
  );
}
