import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import SessionGuard from '@/components/dashboard/session-guard'

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shift Point - لوحة التحكم",
  description: "نظام إدارة الموظفين والمبيعات والعمليات لشركة Shift Point",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-text" suppressHydrationWarning>
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}
