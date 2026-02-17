import { Suspense } from "react";
import { SupportCenter } from "@/features/support/support-center";

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-[1360px] px-6 py-12">
      <Suspense fallback={<section className="panel">Support 메뉴를 불러오는 중...</section>}>
        <SupportCenter />
      </Suspense>
    </main>
  );
}
