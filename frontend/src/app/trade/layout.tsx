import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade",
  description: "실시간 차트, 호가창, 주문 패널을 통해 디지털 자산을 거래하세요.",
  alternates: {
    canonical: "/trade"
  }
};

export default function TradeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
