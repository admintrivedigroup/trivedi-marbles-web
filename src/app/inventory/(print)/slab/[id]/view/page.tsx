import { notFound } from "next/navigation";

import { getSlabById, getSlabImages } from "@/app/inventory/_lib/slab-detail";
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

  return <SlabPublicView slab={slab} images={images} />;
}
