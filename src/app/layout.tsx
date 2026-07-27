import type { Metadata } from "next";
import { Geist, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/* HUD 느낌의 숫자·코드용 테크 모노 폰트 (D-day·날짜·번호 등에 적용) */
const techMono = Share_Tech_Mono({
  variable: "--font-tech-mono",
  weight: "400",
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
