import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/* 숫자·날짜·D-day용 모노 폰트 — 0/O, 1/l 구분이 명확해 가독성이 높다 */
const techMono = JetBrains_Mono({
  variable: "--font-tech-mono",
  weight: ["500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "신정개발 안전관리 대시보드",
  description:
    "위험성평가·안전교육·안전점검·아차사고 현황을 한눈에 — 데이터는 브라우저에서만 처리됩니다.",
  // 홈 화면에 설치했을 때 앱처럼 보이도록
  appleWebApp: {
    capable: true,
    title: "안전관리",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0891b2",
  width: "device-width",
  initialScale: 1,
  // 입력 칸을 눌렀을 때 화면이 확대되지 않도록 (확대 자체는 막지 않는다)
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${techMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
