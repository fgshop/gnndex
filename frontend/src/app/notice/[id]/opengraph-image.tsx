import { ImageResponse } from "next/og";
import { getSupportNoticeById } from "@/features/support/support-notices";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

type NoticeOgImageProps = {
  params: Promise<{ id: string }>;
};

const backendBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000/v1";

type ApiNotice = {
  id: string;
  title: string;
  summary: string;
  publishedAt?: string | null;
  createdAt: string;
};

async function fetchNoticeForOg(id: string): Promise<{ title: string; summary: string; date: string } | null> {
  try {
    const res = await fetch(`${backendBase}/notices/${encodeURIComponent(id)}?locale=ko`);
    if (!res.ok) return null;
    const data = (await res.json()) as ApiNotice;
    if (!data?.id) return null;
    return {
      title: data.title,
      summary: data.summary,
      date: (data.publishedAt ?? data.createdAt).slice(0, 10)
    };
  } catch {
    return null;
  }
}

export default async function NoticeOpenGraphImage({ params }: NoticeOgImageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const apiNotice = await fetchNoticeForOg(decodedId);
  const fallback = getSupportNoticeById(decodedId);

  const title = apiNotice?.title ?? fallback?.title ?? "GnnDEX 공지사항";
  const summary = apiNotice?.summary ?? fallback?.summary ?? "거래소 운영 공지와 점검 정보를 확인하세요.";
  const date = apiNotice?.date ?? fallback?.date ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px",
          background: "linear-gradient(145deg, #111827 0%, #1e3a8a 60%, #1d4ed8 100%)",
          color: "#f8fafc"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 12,
            border: "1px solid rgba(226,232,240,0.45)",
            background: "rgba(15,23,42,0.32)",
            padding: "8px 14px",
            fontSize: 22,
            fontWeight: 700
          }}
        >
          GnnDEX Notice
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.14 }}>{title}</div>
          <div style={{ fontSize: 31, lineHeight: 1.35, opacity: 0.94 }}>{summary}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, opacity: 0.92 }}>
          <span>{decodedId}</span>
          <span>{date}</span>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
