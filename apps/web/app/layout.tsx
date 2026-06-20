import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LandWeaver Agent",
  description: "B-side site planning and feasibility engine"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

