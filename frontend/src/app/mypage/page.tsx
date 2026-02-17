import { Suspense } from "react";
import { MyPagePanel } from "@/features/mypage/my-page-panel";

export default function MyPage() {
  return (
    <main className="mx-auto w-full max-w-[1360px] px-6 py-12">
      <Suspense fallback={<section className="panel">마이페이지를 불러오는 중입니다...</section>}>
        <MyPagePanel />
      </Suspense>
    </main>
  );
}
