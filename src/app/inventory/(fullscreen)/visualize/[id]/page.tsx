import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { ExitButton } from "@/app/inventory/_components/visualizer-exit-button";
import { VisualizerAI } from "@/app/inventory/_components/visualizer-ai";
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
    .select("id, slab_code, marble_lots(marble_name), slab_images(image_url, sort_order)")
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).map((row: {
    id: string;
    slab_code: string | null;
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
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Dark header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-gray-950 px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0">
            <Image
              src="/images/vijay-trivedi-logo.webp"
              alt="Trivedi"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
              Trivedi Technologies
            </span>
            <span className="text-sm font-semibold text-white">
              Marble Visualizer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory/visualize"
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-stone-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Change slab</span>
          </Link>
          <ExitButton href={`/inventory/slab/${currentSlab.id}`} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-3xl">
          <VisualizerAI currentSlab={currentSlab} comparisons={comparisons} />
        </div>
      </main>
    </div>
  );
}
