import Image from "next/image";
import { ExitButton } from "@/app/inventory/_components/visualizer-exit-button";
import { VisualizerSplash } from "@/app/inventory/_components/visualizer-splash";
import { VisualizerPicker } from "@/app/inventory/_components/visualizer-picker";
import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { createClient } from "@/lib/supabase/server";

type SlabRow = {
  id: string;
  slab_code: string | null;
  marble_lots: Array<{ marble_name: string | null }> | { marble_name: string | null } | null;
  slab_images: Array<{ image_url: string | null; sort_order: number | null }>;
};

async function getPickerSlabs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slabs")
    .select("id, slab_code, marble_lots(marble_name), slab_images(image_url, sort_order)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row: SlabRow) => {
    const images = Array.isArray(row.slab_images) ? row.slab_images : [];
    const sorted = images.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const rawUrl = sorted[0]?.image_url ?? null;
    const lot = Array.isArray(row.marble_lots) ? row.marble_lots[0] : row.marble_lots;
    return {
      id: String(row.id),
      slabCode: row.slab_code ?? "",
      marbleName: lot?.marble_name ?? null,
      thumbnailUrl: rawUrl ? withCloudinaryThumbnail(rawUrl) : null,
    };
  });
}

export default async function VisualizePage() {
  const slabs = await getPickerSlabs();

  return (
    <VisualizerSplash>
      <div className="flex min-h-screen flex-col bg-gray-50">
        {/* Dark header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-gray-950 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0">
              <Image
                src="/images/vijay-trivedi-logo.webp"
                alt="Vijay Trivedi Group"
                fill
                className="object-contain"
              />
            </div>
            <span className="h-7 w-px shrink-0 bg-white/20" aria-hidden="true" />
            <Image
              src="/images/TRIVEDI MARBLES PVT.LTD.webp"
              alt="Trivedi Marbles Pvt. Ltd."
              width={90}
              height={36}
              className="h-9 w-auto shrink-0 object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
                Trivedi Technologies
              </span>
              <span className="text-sm font-semibold text-white">
                Marble Visualizer
              </span>
            </div>
          </div>

          <ExitButton href="/inventory/dashboard" />
        </header>

        {/* Content */}
        <div className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <VisualizerPicker slabs={slabs} />
        </div>
      </div>
    </VisualizerSplash>
  );
}
