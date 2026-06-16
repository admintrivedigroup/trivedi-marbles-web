import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Since 1984, Trivedi Marbles Pvt Ltd has been Ahmedabad's most trusted marble supplier. Discover the legacy of D.K. Trivedi & Sons — from Ambaji quarries to luxury finishes.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Our Story | Trivedi Marbles Pvt Ltd",
    description:
      "Since 1984, Trivedi Marbles Pvt Ltd has been Ahmedabad's most trusted marble supplier. Discover the legacy of D.K. Trivedi & Sons — from Ambaji quarries to luxury finishes.",
    url: "/about",
    type: "website",
    images: [{ url: "/images/ourheritage_home.webp", width: 1200, height: 800, alt: "Trivedi Marbles — Our Heritage since 1984" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Story | Trivedi Marbles Pvt Ltd",
    description:
      "Since 1984, Trivedi Marbles Pvt Ltd has been Ahmedabad's most trusted marble supplier. Discover the legacy of D.K. Trivedi & Sons — from Ambaji quarries to luxury finishes.",
    images: ["/images/ourheritage_home.webp"],
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
