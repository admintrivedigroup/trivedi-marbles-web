import { notFound } from "next/navigation";

import { SlabDetail } from "@/app/inventory/_components/slab-detail";
import {
  getSlabById,
  getSlabImages,
  getSlabMovements,
} from "@/app/inventory/_lib/slab-detail";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

type SlabDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SlabDetailPage({ params }: SlabDetailPageProps) {
  const { id } = await params;

  const [{ error, slab }, movements, images, profile, inTransitSlabIds] = await Promise.all([
    getSlabById(id),
    getSlabMovements(id),
    getSlabImages(id),
    getCurrentUserProfile(),
    getInTransitSlabIds(),
  ]);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!slab) {
    notFound();
  }

  return (
    <SlabDetail
      slab={slab}
      movements={movements}
      images={images}
      canViewCostPrice={profile?.permissions.view_cost_price ?? false}
      isInTransit={inTransitSlabIds.has(id)}
    />
  );
}
