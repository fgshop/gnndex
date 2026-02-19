import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { TopNav } from "@/components/top-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/features/auth/auth-context";
import { LocaleProvider } from "@/i18n/locale-context";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GlobalDEX | Global Digital Asset Exchange",
    template: "%s | GlobalDEX"
  },
  description: "글로벌 디지털 자산 거래소 GlobalDEX. 실시간 시세, 안정적인 거래, 보안 중심 운영.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "GlobalDEX | Global Digital Asset Exchange",
    description: "글로벌 디지털 자산 거래소 GlobalDEX. 실시간 시세, 안정적인 거래, 보안 중심 운영.",
    url: siteUrl,
    siteName: "GlobalDEX",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "GlobalDEX Global Digital Asset Exchange"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "GlobalDEX | Global Digital Asset Exchange",
    description: "글로벌 디지털 자산 거래소 GlobalDEX. 실시간 시세, 안정적인 거래, 보안 중심 운영.",
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <div className="app-grid-bg">
                <TopNav />
                {children}
                <SiteFooter />
              </div>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
