import { Suspense } from "react";
import { WalletPanel } from "@/features/wallet/wallet-panel";

export default function WalletPage() {
  return (
    <main className="mx-auto w-full max-w-[1360px] px-6 py-12">
      <Suspense fallback={<section className="panel">지갑 화면을 불러오는 중입니다...</section>}>
        <WalletPanel />
      </Suspense>
    </main>
  );
}
