"use client";

import { LegalPage } from "../legal-page";

const SECTIONS = [
  { titleKey: "legal.terms.s1", contentKey: "legal.terms.s1.content" },
  { titleKey: "legal.terms.s2", contentKey: "legal.terms.s2.content" },
  { titleKey: "legal.terms.s3", contentKey: "legal.terms.s3.content" },
  { titleKey: "legal.terms.s4", contentKey: "legal.terms.s4.content" },
  { titleKey: "legal.terms.s5", contentKey: "legal.terms.s5.content" },
  { titleKey: "legal.terms.s6", contentKey: "legal.terms.s6.content" },
  { titleKey: "legal.terms.s7", contentKey: "legal.terms.s7.content" },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-10 lg:px-6">
      <LegalPage
        titleKey="legal.terms.title"
        introKey="legal.terms.intro"
        sections={SECTIONS}
      />
    </main>
  );
}
