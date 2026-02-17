import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
  description: "입출금, 자산 현황, 지갑 관리 기능을 안전하게 이용하세요.",
  alternates: {
    canonical: "/wallet"
  }
};

export default function WalletLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
