import { notFound } from "next/navigation";

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

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = await params;

  // Static curated marble
  if (!UUID_RE.test(id)) {
    const marble = getMarbleById(id);
    if (!marble) notFound();
    return <CollectionDetailClient marble={marble} />;
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

  return <LotCollectionDetail lot={lot} related={related} />;
}
