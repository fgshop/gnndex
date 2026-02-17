function sanitizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (envUrl) {
    return sanitizeBaseUrl(envUrl);
  }

  return "http://localhost:3000";
}
