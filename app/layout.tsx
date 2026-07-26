import type { Metadata, Viewport } from "next";
import { Anton, Courier_Prime } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier-prime",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL),
  title: "Terserah — pengadilan buat yang bilang terserah",
  description:
    "Dia bilang terserah, lalu menolak semua saranmu. Tetapkan satu tempat, kirim linknya, dan biar putusan itu berlaku sampai dia protes.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Terserah",
  },
};

export const viewport: Viewport = {
  themeColor: "#241614",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${anton.variable} ${courier.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
