import type { Metadata } from "next";

import { products } from "@/data/products";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse the full range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Products | Trivedi Marbles Pvt Ltd",
    description:
      "Browse the full range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
    url: "/products",
    type: "website",
    images: [{ url: "/images/ambaji_white_mirror.webp", width: 1200, height: 800, alt: "Ambaji White marble slab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Products | Trivedi Marbles Pvt Ltd",
    description:
      "Browse the full range of natural stone products from Trivedi Marbles — Ambaji White, Fusion Black, Exotic Green, and more premium marble varieties.",
    images: ["/images/ambaji_white_mirror.webp"],
  },
};

export default function ProductsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Products</h1>
        <p className="mt-4 text-base text-black/70">
          A starter products page backed by a typed local data source.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.slug}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-accent">
              {product.category}
            </p>
            <h2 className="mt-3 text-2xl font-medium">{product.name}</h2>
            <p className="mt-3 text-sm leading-6 text-black/70">
              {product.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
