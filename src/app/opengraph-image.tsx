import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #161c1f 0%, #1e262a 55%, #223037 100%)",
          color: "#dbe4e6",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "10px 24px",
            borderRadius: 999,
            border: "2px solid #6b9aa3",
            color: "#7ba9b1",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          CONSEQUENCE MANAGEMENT
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 84, fontWeight: 700, color: "#f4f9fa" }}>
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#8b9ba0" }}>
          Employee CM documents, synced with SAP SuccessFactors
        </div>
      </div>
    ),
    { ...size }
  );
}
