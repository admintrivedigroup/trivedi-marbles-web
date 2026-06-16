import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Inter,
  Geist_Mono,
} from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Trivedi Marbles",
  description: "Luxury marble collections crafted for timeless spaces.",
  icons: {
    icon: "/images/vijay-trivedi-logo.webp",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${geistMono.variable} ${cormorantGaramond.variable} bg-background text-foreground antialiased`}
    >
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
