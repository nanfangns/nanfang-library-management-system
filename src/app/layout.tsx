import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "图书管理系统",
  description: "基于 Next.js 与 SQLite 构建的现代化图书管理系统。",
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
