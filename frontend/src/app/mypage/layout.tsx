import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Page",
  description: "내 계정, 보안 설정, 활동 내역을 확인하고 관리하세요.",
  alternates: {
    canonical: "/mypage"
  }
};

export default function MyPageLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
