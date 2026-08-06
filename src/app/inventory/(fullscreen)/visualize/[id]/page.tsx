import { notFound } from "next/navigation";

import { VisualizerM2F } from "@/app/inventory/_components/visualizer-m2f";
import { getSlabById, getSlabImages } from "@/app/inventory/_lib/slab-detail";
import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

async function getComparisonSlabs(excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slabs")
    .select("id, slab_code, length, width, marble_lots(marble_name), slab_images(image_url, sort_order)")
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).map((row: {
    id: string;
    slab_code: string | null;
    length: number | null;
    width: number | null;
    marble_lots: Array<{ marble_name: string | null }> | { marble_name: string | null } | null;
    slab_images: Array<{ image_url: string | null; sort_order: number | null }>;
  }) => {
    const images = Array.isArray(row.slab_images) ? row.slab_images : [];
    const sorted = images.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const rawUrl = sorted[0]?.image_url ?? null;
    const lot = Array.isArray(row.marble_lots) ? row.marble_lots[0] : row.marble_lots;
    return {
      id: String(row.id),
      slabCode: row.slab_code ?? "",
      marbleName: lot?.marble_name ?? null,
      thumbnailUrl: rawUrl ? withCloudinaryThumbnail(rawUrl) : null,
      imageUrl: rawUrl,
      length: row.length ?? null,
      width: row.width ?? null,
    };
  });
}

export default async function VisualizeSlabPage({ params }: Props) {
  const { id } = await params;

  const [{ slab }, images, comparisons] = await Promise.all([
    getSlabById(id),
    getSlabImages(id),
    getComparisonSlabs(id),
  ]);

  if (!slab) notFound();

  const rawImageUrl = images[0]?.imageUrl ?? null;

  const currentSlab = {
    id: slab.id,
    slabCode: slab.slabCode ?? "",
    marbleName: slab.marbleName ?? null,
    thumbnailUrl: rawImageUrl ? withCloudinaryThumbnail(rawImageUrl) : slab.thumbnailUrl,
    imageUrl: rawImageUrl,
    length: slab.length,
    width: slab.width,
  };

  return (
    <VisualizerM2F
      currentSlab={currentSlab}
      comparisons={comparisons}
      exitHref={`/inventory/slab/${currentSlab.id}`}
    />
  );
}
