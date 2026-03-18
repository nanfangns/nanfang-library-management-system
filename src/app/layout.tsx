import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Nanfang 图书管理系统",
    template: "%s | Nanfang 图书管理系统",
  },
  description:
    "一个适合作为图书管理系统、毕业设计、课程设计和课程作业参考的 Next.js 中文项目。",
  openGraph: {
    title: "Nanfang 图书管理系统",
    description:
      "支持图书录入、馆藏维护、外部导入和搜索筛选的现代化 Next.js 图书管理系统。",
    images: [
      {
        url: "/previews/social-preview.png",
        width: 1600,
        height: 1000,
        alt: "Nanfang 图书管理系统预览图",
      },
    ],
    locale: "zh_CN",
    siteName: "Nanfang 图书管理系统",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nanfang 图书管理系统",
    description:
      "一个适合作为毕业设计、课程设计与课程作业参考的 Next.js 图书管理系统。",
    images: ["/previews/social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={manrope.variable} suppressHydrationWarning>
        <div className="site-frame">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
