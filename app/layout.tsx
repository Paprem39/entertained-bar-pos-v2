import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionGuard from "@/app/component/SessionGuard"; // นำเข้า SessionGuard ที่คุณสร้างไว้

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Entertained Bar POS",
  description: "ระบบจัดการร้านบาร์และ POS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ครอบ SessionGuard ไว้ที่ระดับ Root เพื่อคอยตรวจจับการล็อกอินซ้ำตลอดเวลา */}
        <SessionGuard>
          {children}
        </SessionGuard>
      </body>
    </html>
  );
}