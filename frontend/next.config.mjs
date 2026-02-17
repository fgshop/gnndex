const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
let apiOrigin = "http://localhost:4000";

if (rawApiBaseUrl) {
  try {
    const parsed = new URL(rawApiBaseUrl);
    apiOrigin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    apiOrigin = rawApiBaseUrl.replace(/\/v1\/?$/, "");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiOrigin}/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
