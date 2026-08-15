import { ImageResponse } from "next/og";

import { createSafeOgPayload } from "@/lib/share/og-payload";

export { createSafeOgPayload } from "@/lib/share/og-payload";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { groupName, memberCount } = createSafeOgPayload(new URL(request.url));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fff8e8",
          color: "#211d2a",
          padding: "72px",
          border: "18px solid #211d2a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 800 }}>
          <span>MofuType</span>
          <span>GROUP EDITION</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.1, maxWidth: 980 }}>
            {groupName}
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 38, fontWeight: 700 }}>
            メンバー {memberCount}人の関係マップ
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#c12668" }}>
          わたしたち、こんな感じ。
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
