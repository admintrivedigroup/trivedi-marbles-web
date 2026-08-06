"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SlabTexture } from "../types";

type SlabImageRow = { image_url?: unknown; sort_order?: unknown };
type LotRow       = { marble_name?: unknown; lot_number?: unknown };

export async function getSlabTextures(limit = 48): Promise<SlabTexture[]> {
  try {
    const supabase = createAdminClient();

    // !inner = only slabs that have at least one image
    const { data, error } = await supabase
      .from("slabs")
      .select(`
        id,
        slab_code,
        length,
        width,
        marble_lots(marble_name, lot_number),
        slab_images!inner(image_url, sort_order)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[getSlabTextures]", error);
      return [];
    }

    return (data as unknown[])
      .map((row) => {
        const r = row as {
          id: unknown;
          slab_code: unknown;
          length: unknown;
          width: unknown;
          marble_lots: unknown;
          slab_images: unknown;
        };

        // Pick first image by sort_order
        const images: SlabImageRow[] = Array.isArray(r.slab_images)
          ? (r.slab_images as SlabImageRow[])
          : r.slab_images
          ? [r.slab_images as SlabImageRow]
          : [];

        const sorted = [...images].sort(
          (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0),
        );
        const thumbnailUrl = sorted
          .map((img) => (typeof img.image_url === "string" ? img.image_url : null))
          .find((u): u is string => u !== null);

        if (!thumbnailUrl) return null;

        const lot: LotRow | null = Array.isArray(r.marble_lots)
          ? ((r.marble_lots as LotRow[])[0] ?? null)
          : (r.marble_lots as LotRow | null);

        return {
          id:           String(r.id),
          slabCode:     typeof r.slab_code === "string" ? r.slab_code : null,
          marbleName:   typeof lot?.marble_name === "string" ? lot.marble_name : null,
          lotNumber:    typeof lot?.lot_number === "string" ? lot.lot_number : null,
          thumbnailUrl,
          length:       typeof r.length === "number" ? r.length : null,
          width:        typeof r.width  === "number" ? r.width  : null,
        } satisfies SlabTexture;
      })
      .filter((s): s is SlabTexture => s !== null);
  } catch (e) {
    console.error("[getSlabTextures] threw:", e);
    return [];
  }
}
