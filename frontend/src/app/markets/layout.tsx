import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markets",
  description: "코인별 실시간 시세, 24시간 변동률, 거래량을 한눈에 확인하세요.",
  alternates: {
    canonical: "/markets"
  }
};

export default function MarketsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
