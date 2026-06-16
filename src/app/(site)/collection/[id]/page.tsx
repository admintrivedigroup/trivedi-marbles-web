import { notFound } from "next/navigation";
import type { Metadata } from "next";

import CollectionDetailClient from "@/components/collection/CollectionDetailClient";
import LotCollectionDetail from "@/components/collection/LotCollectionDetail";
import { getMarbleById } from "@/data/marbles";
import { getWebsiteLotById, getWebsiteLots } from "@/lib/supabase/collection";

export const dynamic = "force-dynamic";

type CollectionDetailPageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: CollectionDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    const marble = getMarbleById(id);
    if (!marble) return {};
    const ogImage = [{ url: marble.image, width: 1200, height: 800, alt: marble.name }];
    return {
      title: marble.name,
      description: marble.description,
      alternates: { canonical: `/collection/${id}` },
      openGraph: {
        title: `${marble.name} | Trivedi Marbles`,
        description: marble.description,
        url: `/collection/${id}`,
        type: "website",
        images: ogImage,
      },
      twitter: {
        card: "summary_large_image",
        title: `${marble.name} | Trivedi Marbles`,
        description: marble.description,
        images: [marble.image],
      },
    };
  }

  const lot = await getWebsiteLotById(id);
  if (!lot) return {};
  const lotTitle = `${lot.marbleName}${lot.lotNumber ? ` — Lot ${lot.lotNumber}` : ""}`;
  const lotDesc = `${lot.marbleName} marble slab — ${lot.categoryName}. ${lot.slabCount} slabs, ${lot.totalSqft.toLocaleString()} sq ft available. Inquire for pricing.`;
  const lotOgImages = lot.thumbnailUrl
    ? [{ url: lot.thumbnailUrl, width: 1200, height: 800, alt: lot.marbleName }]
    : undefined;
  return {
    title: lotTitle,
    description: lotDesc,
    alternates: { canonical: `/collection/${id}` },
    openGraph: {
      title: `${lotTitle} | Trivedi Marbles`,
      description: lotDesc,
      url: `/collection/${id}`,
      type: "website",
      images: lotOgImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${lotTitle} | Trivedi Marbles`,
      description: lotDesc,
      images: lot.thumbnailUrl ? [lot.thumbnailUrl] : undefined,
    },
  };
}

const BASE = "https://www.trivedimarbles.co.in";

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = await params;

  // Static curated marble
  if (!UUID_RE.test(id)) {
    const marble = getMarbleById(id);
    if (!marble) notFound();

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: marble.name,
      description: marble.description,
      image: `${BASE}${marble.image}`,
      color: marble.color,
      material: "Marble",
      brand: { "@type": "Brand", name: "Trivedi Marbles Pvt Ltd" },
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        priceCurrency: "INR",
        seller: { "@type": "Organization", name: "Trivedi Marbles Pvt Ltd" },
      },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <CollectionDetailClient marble={marble} />
      </>
    );
  }

  // Live inventory lot
  const [lot, allLots] = await Promise.all([
    getWebsiteLotById(id),
    getWebsiteLots(),
  ]);

  if (!lot) notFound();

  const sameCat = allLots.filter(
    (l) => l.id !== lot.id && l.categoryName === lot.categoryName,
  );
  const related = (
    sameCat.length >= 3
      ? sameCat
      : [
          ...sameCat,
          ...allLots.filter(
            (l) => l.id !== lot.id && l.categoryName !== lot.categoryName,
          ),
        ]
  ).slice(0, 3);

  const lotSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: lot.marbleName,
    description: `${lot.marbleName} marble slab — ${lot.categoryName}. ${lot.slabCount} slabs, ${lot.totalSqft.toLocaleString()} sq ft available.`,
    material: "Marble",
    brand: { "@type": "Brand", name: "Trivedi Marbles Pvt Ltd" },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "INR",
      ...(lot.sellingPrice != null && { price: lot.sellingPrice }),
      seller: { "@type": "Organization", name: "Trivedi Marbles Pvt Ltd" },
    },
  };
  if (lot.thumbnailUrl) lotSchema.image = lot.thumbnailUrl;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lotSchema) }}
      />
      <LotCollectionDetail lot={lot} related={related} />
    </>
  );
}
