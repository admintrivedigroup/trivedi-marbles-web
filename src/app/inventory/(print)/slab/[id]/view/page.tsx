import { notFound } from "next/navigation";

import { getSlabById, getSlabImages, getSlabSiblingNav } from "@/app/inventory/_lib/slab-detail";
import { SlabPublicView } from "@/app/inventory/_components/slab-public-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SlabPublicViewPage({ params }: Props) {
  const { id } = await params;

  const [{ slab, error }, images] = await Promise.all([
    getSlabById(id),
    getSlabImages(id),
  ]);

  if (error || !slab) {
    notFound();
  }

  const nav = slab.lotId
    ? await getSlabSiblingNav(slab.lotId, id)
    : { prevId: null, nextId: null, position: null, total: 0 };

  const publicSlab = { ...slab, dealerPrice: null, notes: null, reservedFor: null };

  return <SlabPublicView slab={publicSlab} images={images} nav={nav} />;
}
