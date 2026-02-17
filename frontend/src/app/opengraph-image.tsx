import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0ea5e9 100%)",
          color: "#f8fafc"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            background: "rgba(248,250,252,0.16)",
            border: "1px solid rgba(248,250,252,0.35)",
            padding: "10px 18px",
            fontSize: 26,
            letterSpacing: 0.4
          }}
        >
          GnnDEX Global Exchange
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
            Trusted Digital Asset Trading
          </div>
          <div style={{ fontSize: 34, opacity: 0.92 }}>
            실시간 시세, 안정적인 거래, 보안 중심 운영
          </div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
