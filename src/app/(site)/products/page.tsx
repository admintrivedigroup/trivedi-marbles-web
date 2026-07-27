import type { Metadata } from "next";

import { FadeIn } from "@/components/animations/FadeIn";
import { CollectionStaticSection } from "@/components/collection/CollectionStaticSection";
import { CollectionGrid } from "@/components/collection/CollectionGrid";
import { getWebsiteLots } from "@/lib/supabase/collection";
import { PUBLIC_ROBOTS } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse our range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
  alternates: { canonical: "/collection" },
  robots: PUBLIC_ROBOTS,
  openGraph: {
    title: "Products | Trivedi Marbles Pvt. Ltd.",
    description:
      "Browse our range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
    url: "/products",
    type: "website",
    images: [{ url: "/images/ambaji_white_mirror.webp", width: 1200, height: 800, alt: "Ambaji White marble slab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Products | Trivedi Marbles Pvt. Ltd.",
    description:
      "Browse our range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
    images: ["/images/ambaji_white_mirror.webp"],
  },
};

export default async function ProductsPage() {
  const lots = await getWebsiteLots();
  const categories = [...new Set(lots.map((l) => l.categoryName).filter(Boolean))];

  return (
    <div className="mx-auto min-h-screen w-full max-w-400 bg-background px-6 pb-24 pt-32 md:px-12 lg:px-24">
      <FadeIn className="mb-16">
        <p className="mb-6 text-sm uppercase tracking-[0.3em] text-accent">Products</p>
        <h1 className="mb-6 font-serif text-5xl text-primary md:text-6xl">
          Our Marble Products
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A range of premium natural stone products, quarried and finished by
          Trivedi Marbles for architects, builders, and designers.
        </p>
      </FadeIn>

      {/* Section 1: Curated catalogue */}
      <CollectionStaticSection />

      {/* Section 2: Live inventory lots */}
      {lots.length > 0 && (
        <div className="mt-24">
          <FadeIn className="mb-12">
            <div className="flex items-center gap-6">
              <div className="h-px flex-1 bg-border" />
              <div className="text-center">
                <h2 className="font-serif text-3xl text-primary md:text-4xl">
                  Available Now
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live inventory — select lots available for immediate inquiry
                </p>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          </FadeIn>

          <CollectionGrid lots={lots} categories={categories} />
        </div>
      )}
    </div>
  );
}
