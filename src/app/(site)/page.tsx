import type { Metadata } from "next";

import Hero from "@/components/home/Hero";

export const metadata: Metadata = {
  title: "Trivedi Marbles | Premium Marble Supplier in Ahmedabad",
  description:
    "Trivedi Marbles Pvt Ltd — premium Ambaji marble supplier in Ahmedabad. Discover luxury marble slabs for residential, commercial, and hospitality projects.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Trivedi Marbles | Premium Marble Supplier in Ahmedabad",
    description:
      "Trivedi Marbles Pvt Ltd — premium Ambaji marble supplier in Ahmedabad. Discover luxury marble slabs for residential, commercial, and hospitality projects.",
    url: "/",
    type: "website",
    images: [{ url: "/images/ourheritage_home.webp", width: 1200, height: 800, alt: "Trivedi Marbles — Our Heritage" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trivedi Marbles | Premium Marble Supplier in Ahmedabad",
    description:
      "Trivedi Marbles Pvt Ltd — premium Ambaji marble supplier in Ahmedabad. Discover luxury marble slabs for residential, commercial, and hospitality projects.",
    images: ["/images/ourheritage_home.webp"],
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Trivedi Marbles Pvt Ltd",
  description:
    "Premium marble supplier based in Ahmedabad, Gujarat. Exclusive collection of luxury marble slabs sourced from D.K. Trivedi & Sons Quarries.",
  url: "https://www.trivedimarbles.co.in",
  telephone: "+919099996869",
  email: "info@trivedigranimarmo.com",
  foundingDate: "1984",
  priceRange: "₹₹₹",
  image: "https://www.trivedimarbles.co.in/images/ambaji_white_mirror.webp",
  logo: "https://www.trivedimarbles.co.in/images/vijay-trivedi-logo.webp",
  address: {
    "@type": "PostalAddress",
    streetAddress: "S.No.: 698/4, Ognaj, Opp. Vasant Nagar Township, Gota-Vadsar Road",
    addressLocality: "Ahmedabad",
    addressRegion: "Gujarat",
    postalCode: "380060",
    addressCountry: "IN",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <Hero />
    </>
  );
}
