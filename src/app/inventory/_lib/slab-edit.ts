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
          "id, updated_at, slab_code, marble_name, length, width, rack_number, notes, lot_id, marble_lots(lot_number)",
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

    function lotNum(rel: unknown): string | null {
      if (Array.isArray(rel)) {
        const n = (rel[0] as Record<string, unknown> | undefined)?.lot_number;
        return n ? String(n).trim() : null;
      }
      if (rel && typeof rel === "object") {
        const n = (rel as Record<string, unknown>).lot_number;
        return n ? String(n).trim() : null;
      }
      return null;
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
        marbleName: row.marble_name ? String(row.marble_name).trim() : null,
        lotId: row.lot_id != null ? String(row.lot_id) : null,
        lotNumber: lotNum(row.marble_lots),
        images,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: `Unable to load slab. ${message}`, slab: null };
  }
}
