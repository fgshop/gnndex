import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupportNoticeById } from "@/features/support/support-notices";
import { getSiteUrl } from "@/lib/site-url";

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

const backendBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000/v1";

type ApiNotice = {
  id: string;
  title: string;
  summary: string;
  content: string;
  publishedAt?: string | null;
  createdAt: string;
};

async function fetchNotice(id: string): Promise<{ title: string; summary: string; content: string; date: string; id: string } | null> {
  try {
    const res = await fetch(`${backendBase}/notices/${encodeURIComponent(id)}?locale=ko`, {
      next: { revalidate: 60 }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiNotice;
    if (!data?.id) return null;
    return {
      id: data.id,
      title: data.title,
      summary: data.summary,
      content: data.content,
      date: (data.publishedAt ?? data.createdAt).slice(0, 10)
    };
  } catch {
    return null;
  }
}

function toFallback(id: string) {
  const n = getSupportNoticeById(id);
  if (!n) return null;
  return { id: n.id, title: n.title, summary: n.summary, content: n.details.join("\n"), date: n.date };
}

export async function generateMetadata({ params }: NoticeDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const notice = (await fetchNotice(decodedId)) ?? toFallback(decodedId);
  const siteUrl = getSiteUrl();

  if (!notice) {
    return {
      title: "공지사항을 찾을 수 없습니다 | GnnDEX"
    };
  }

  const canonicalPath = `/notice/${encodeURIComponent(decodedId)}`;

  return {
    title: `${notice.title} | GnnDEX 공지사항`,
    description: notice.summary,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: `${notice.title} | GnnDEX 공지사항`,
      description: notice.summary,
      url: `${siteUrl}${canonicalPath}`,
      siteName: "GnnDEX",
      locale: "ko_KR",
      type: "article",
      images: [
        {
          url: `${siteUrl}${canonicalPath}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: notice.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${notice.title} | GnnDEX 공지사항`,
      description: notice.summary,
      images: [`${siteUrl}${canonicalPath}/opengraph-image`]
    }
  };
}

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const notice = (await fetchNotice(decodedId)) ?? toFallback(decodedId);
  const siteUrl = getSiteUrl();
  const canonicalPath = `/notice/${encodeURIComponent(decodedId)}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  if (!notice) {
    notFound();
  }

  const contentLines = notice.content.split("\n").filter(Boolean);

  const noticeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: notice.title,
    description: notice.summary,
    datePublished: `${notice.date}T00:00:00+09:00`,
    dateModified: `${notice.date}T00:00:00+09:00`,
    inLanguage: "ko-KR",
    mainEntityOfPage: canonicalUrl,
    publisher: {
      "@type": "Organization",
      name: "GnnDEX",
      url: siteUrl
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1360px] px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(noticeJsonLd) }}
      />
      <article className="rounded-3xl border border-border bg-card shadow-lg shadow-black/8">
        <header className="border-b border-border bg-muted px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Notice</p>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-foreground">{notice.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>공지번호: {notice.id}</span>
            <span>{notice.date}</span>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <section className="rounded-xl border border-border bg-muted p-4">
            <h2 className="text-sm font-semibold text-foreground">요약</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{notice.summary}</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">상세 안내</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {contentLines.map((line) => (
                <li key={`${notice.id}-${line}`}>- {line}</li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="border-t border-border bg-muted px-6 py-4">
          <Link className="btn-muted !px-3 !py-2 text-sm" href="/support?tab=notice">
            공지사항 목록으로
          </Link>
        </footer>
      </article>
    </main>
  );
}
