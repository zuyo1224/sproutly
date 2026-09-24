import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Noto_Sans_TC, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteBaseUrl } from "@/lib/store-schema";

// Botanic Lab 字型系統：拉丁標題/介面用 Hanken Grotesk（幾何 grotesk，現代乾淨），
// 中文內文用 Noto Sans TC，資料/價格/網址這類等寬資訊保留 Geist Mono。
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 走全站共用的 siteBaseUrl：預設網域只剩 lib/store-schema 一處，換網域改環境變數即可。
  metadataBase: new URL(siteBaseUrl()),
  title: "Sproutly · 讓你的小生意發芽",
  description: "為小商家打造的線上店面。商品、訂單、付款，整齊收在你的網址。",
  openGraph: {
    title: "Sproutly · 讓你的小生意發芽",
    description:
      "為小商家打造的線上店面。商品、訂單、付款，整齊收在你的網址。",
    siteName: "Sproutly",
    type: "website",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sproutly · 讓你的小生意發芽",
    description:
      "為小商家打造的線上店面。商品、訂單、付款，整齊收在你的網址。",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${hankenGrotesk.variable} ${notoSansTC.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
