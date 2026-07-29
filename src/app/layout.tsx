import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${techMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
