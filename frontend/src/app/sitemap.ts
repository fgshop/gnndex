import type { MetadataRoute } from "next";
import { SUPPORT_NOTICE_ROWS } from "@/features/support/support-notices";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticPages = [
    "",
    "/markets",
    "/trade",
    "/wallet",
    "/mypage",
    "/support"
  ].map((path): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.7
  }));

  const noticePages = SUPPORT_NOTICE_ROWS.map((notice): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}/notice/${encodeURIComponent(notice.id)}`,
    lastModified: new Date(notice.date),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  return [...staticPages, ...noticePages];
}
