import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Inter — WINDTRE LUCE&GAS brand font (used by the consumer simulator).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
      data-theme="dark"
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <footer className="text-[var(--text-dim)] text-[10px] text-center py-3 px-4 leading-snug">
            Web app a solo scopo dimostrativo — qualsiasi uso non espressamente autorizzato non è consentito.
            Le offerte generate sono puramente dimostrative e non costituiscono proposte commerciali reali.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}