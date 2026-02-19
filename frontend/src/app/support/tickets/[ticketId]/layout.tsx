import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1:1 문의 상세 | GlobalDEX",
  robots: {
    index: false,
    follow: false
  }
};

export default function SupportTicketDetailLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
