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

const DEFAULT_OG_IMAGE = {
  url: "/images/vijay-trivedi-logo.webp",
  width: 1200,
  height: 630,
  alt: "Trivedi Marbles Pvt Ltd Logo",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trivedimarbles.co.in"),
  title: {
    default: "Trivedi Marbles | Premium Marble Supplier in Ahmedabad",
    template: "%s | Trivedi Marbles Pvt Ltd",
  },
  description: "Trivedi Marbles Pvt Ltd is a premium marble supplier based in Ahmedabad, Gujarat. Explore our exclusive collection of luxury marble slabs for residential, commercial, and hospitality projects.",
  icons: {
    icon: "/images/vijay-trivedi-logo.webp",
  },
  openGraph: {
    siteName: "Trivedi Marbles Pvt Ltd",
    locale: "en_IN",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE.url],
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
