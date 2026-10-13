import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: {
    default: "FitMate — 你的健身伙伴",
    template: "%s | FitMate",
  },
  description: "训练计划、饮食记录、数据统计,一站式健身助手",
  applicationName: "FitMate",
  keywords: ["健身", "训练计划", "饮食记录", "增肌", "减脂"],
  authors: [{ name: "FitMate" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FitMate",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "FitMate",
    title: "FitMate — 你的健身伙伴",
    description: "训练计划、饮食记录、数据统计,一站式健身助手",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* TODO(v1.1): 替换为真实 PNG 图标 */}
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
