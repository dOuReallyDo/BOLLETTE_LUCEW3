import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luce & Gas — Scopri quanto puoi risparmiare",
  description: "Carica la tua bolletta e scopri l'offerta personalizzata per te",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}
        <footer className="text-gray-500 text-[10px] text-center py-3 px-4 leading-snug">
          Web app a solo scopo dimostrativo — qualsiasi uso non espressamente autorizzato dal proprietario non è consentito.
          Le offerte generate sono puramente dimostrative e non costituiscono proposte commerciali reali.
        </footer>
      </body>
    </html>
  );
}
