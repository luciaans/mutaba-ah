import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { NetworkStatusBanner, ServiceWorkerRegistration } from "@/components/pwa-shell";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mutaba-ah.web.id"),
  title: {
    default: "MUTABA'AH | Beranda",
    template: "MUTABA'AH | %s",
  },
  description: "Catat kehadiran salat, kelola data santri, dan pantau rekap ibadah dalam satu aplikasi.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://www.mutaba-ah.web.id",
    siteName: "MUTABA'AH",
    title: "MUTABA'AH | Monitoring Ibadah Santri",
    description: "Catat kehadiran salat, kelola data santri, dan pantau rekap ibadah dalam satu aplikasi.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MUTABA'AH | Monitoring Ibadah Santri",
    description: "Catat kehadiran salat, kelola data santri, dan pantau rekap ibadah dalam satu aplikasi.",
  },
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
