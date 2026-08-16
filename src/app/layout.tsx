import type { Metadata, Viewport } from "next";
import "@xyflow/react/dist/style.css";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "MofuType | みんなの関係が、ひと目でわかる",
  description:
    "十二支キャラクターと性格タイプから、グループの関係性をやさしく見つけるMofuType。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
