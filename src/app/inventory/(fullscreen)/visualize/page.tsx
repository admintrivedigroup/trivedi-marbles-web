import Image from "next/image";
import { ExitButton } from "@/app/inventory/_components/visualizer-exit-button";
import { VisualizerSplash } from "@/app/inventory/_components/visualizer-splash";
import { VisualizerPicker } from "@/app/inventory/_components/visualizer-picker";
import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { createClient } from "@/lib/supabase/server";

export type PickerSlab = {
  id: string;
  slabCode: string;
  thumbnailUrl: string | null;
};

export type PickerLot = {
  lotNumber: string;
  marbleName: string | null;
  thumbnailUrl: string | null;
  slabs: PickerSlab[];
};

type SlabImageRow = { image_url: string | null; sort_order: number | null };
type SlabRow = { id: string; slab_code: string | null; slab_images: SlabImageRow[] };
type LotRow = {
  id: string;
  lot_number: string | null;
  marble_name: string | null;
  slabs: SlabRow[];
};

async function getPickerLots(): Promise<PickerLot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marble_lots")
    .select("id, lot_number, marble_name, slabs(id, slab_code, slab_images(image_url, sort_order))")
    .order("created_at", { ascending: false })
    .limit(200);

  const result: PickerLot[] = [];
  for (const row of (data ?? []) as LotRow[]) {
    const rawSlabs = Array.isArray(row.slabs) ? row.slabs : [];
    if (rawSlabs.length === 0) continue;

    const sortedSlabs = rawSlabs
      .slice()
      .sort((a, b) => (a.slab_code ?? "").localeCompare(b.slab_code ?? ""));

    const pickerSlabs: PickerSlab[] = sortedSlabs.map((s) => {
      const images = Array.isArray(s.slab_images) ? s.slab_images : [];
      const sorted = images.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const rawUrl = sorted[0]?.image_url ?? null;
      return {
        id: String(s.id),
        slabCode: s.slab_code ?? "",
        thumbnailUrl: rawUrl ? withCloudinaryThumbnail(rawUrl) : null,
      };
    });

    result.push({
      lotNumber: row.lot_number ?? "",
      marbleName: row.marble_name ?? null,
      thumbnailUrl: pickerSlabs[0]?.thumbnailUrl ?? null,
      slabs: pickerSlabs,
    });
  }
  return result;
}

export default async function VisualizePage() {
  const lots = await getPickerLots();

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
          <VisualizerPicker lots={lots} />
        </div>
      </div>
    </VisualizerSplash>
  );
}
