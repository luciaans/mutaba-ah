import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { NetworkStatusBanner, ServiceWorkerRegistration } from "@/components/pwa-shell";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "MUTABA'AH — Monitoring Ibadah Santri",
  description: "Menjaga Kedisiplinan, Membentuk Kebiasaan Ibadah.",
  applicationName: "MUTABA'AH",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MUTABA'AH" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }], apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0d5c45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={manrope.className}><ServiceWorkerRegistration /><NetworkStatusBanner />{children}</body>
    </html>
  );
}
