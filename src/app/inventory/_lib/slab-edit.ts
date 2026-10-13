import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SlabEditImage = {
  id: string;
  imageUrl: string;
  publicId: string;
  sortOrder: number;
  fileSize?: number;
};

export type SlabForEdit = {
  id: string;
  updatedAt: string;
  slabCode: string;
  length: string;
  width: string;
  rackNumber: string;
  notes: string;
  marbleName: string | null;
  lotId: string | null;
  lotNumber: string | null;
  images: SlabEditImage[];
};

export type SlabForEditResult = {
  error: string | null;
  slab: SlabForEdit | null;
};

export async function getSlabForEdit(slabId: string): Promise<SlabForEditResult> {
  try {
    const supabase = await createClient();
    const [{ data, error }, { data: imageRows }] = await Promise.all([
      supabase
        .from("slabs")
        .select(
          "id, updated_at, slab_code, length, width, rack_number, notes, lot_id, marble_lots(lot_number, marble_name)",
        )
        .eq("id", slabId)
        .single(),
      supabase
        .from("slab_images")
        .select("id, image_url, public_id, sort_order")
        .eq("slab_id", slabId)
        .order("sort_order", { ascending: true }),
    ]);

    if (error || !data) {
      return {
        error: `Slab not found. ${error?.message ?? ""}`.trim(),
        slab: null,
      };
    }

    const row = data as Record<string, unknown>;

    function str(v: unknown): string {
      if (v === null || v === undefined) return "";
      return String(v).trim();
    }

    function lotField(rel: unknown, key: "lot_number" | "marble_name"): string | null {
      const lot = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | null | undefined;
      const v = lot && typeof lot === "object" ? lot[key] : null;
      return v ? String(v).trim() : null;
    }

    const id = row.id != null ? String(row.id) : null;
    if (!id) return { error: "Invalid slab ID.", slab: null };

    const images: SlabEditImage[] = (imageRows ?? []).map(
      (r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        imageUrl: String(r.image_url ?? ""),
        publicId: String(r.public_id ?? ""),
        sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
      }),
    );

    return {
      error: null,
      slab: {
        id,
        updatedAt: row.updated_at != null ? String(row.updated_at) : "",
        slabCode: str(row.slab_code),
        length: row.length != null ? String(row.length) : "",
        width: row.width != null ? String(row.width) : "",
        rackNumber: str(row.rack_number),
        notes: str(row.notes),
        marbleName: lotField(row.marble_lots, "marble_name"),
        lotId: row.lot_id != null ? String(row.lot_id) : null,
        lotNumber: lotField(row.marble_lots, "lot_number"),
        images,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: `Unable to load slab. ${message}`, slab: null };
  }
}
