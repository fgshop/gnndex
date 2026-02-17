import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "고객센터",
  description: "공지사항, FAQ, 1:1 문의를 통해 GnnDEX 고객지원을 이용하세요.",
  alternates: {
    canonical: "/support"
  }
};

export default function SupportLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
