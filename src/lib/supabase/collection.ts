import "server-only";

import { createClient } from "@/lib/supabase/server";
import { withCloudinaryTransforms } from "@/lib/cloudinary/upload";

export type CollectionLot = {
  id: string;
  lotNumber: string | null;
  marbleName: string;
  categoryName: string;
  thicknessName: string | null;
  thumbnailUrl: string | null;
  images: { url: string; label: string }[];
  sellingPrice: number | null;
  slabCount: number;
  totalSqft: number;
};

type SlabRow = {
  slab_code: string | null;
  sqft: number | null;
  slab_images: { image_url: string; sort_order: number }[];
};

function extractImages(slabs: SlabRow[]): { url: string; label: string }[] {
  const images: { url: string; label: string }[] = [];
  for (const slab of slabs) {
    const sorted = [...(slab.slab_images ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    for (const img of sorted) {
      if (img.image_url) {
        images.push({
          url: withCloudinaryTransforms(img.image_url),
          label: slab.slab_code ?? "Slab",
        });
      }
    }
  }
  return images;
}

function relStr(rel: unknown): string {
  if (typeof rel === "object" && rel !== null && "name" in rel) {
    return String((rel as { name: unknown }).name);
  }
  return "";
}

export async function getWebsiteLots(): Promise<CollectionLot[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("marble_lots")
      .select(
        `id, lot_number, marble_name, selling_price,
         marble_categories(name),
         thickness_options(name),
         slabs(slab_code, sqft, slab_images(image_url, sort_order))`,
      )
      .eq("show_on_website", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map((row) => {
      const slabs = Array.isArray(row.slabs) ? (row.slabs as SlabRow[]) : [];
      const images = extractImages(slabs);
      return {
        id: String(row.id),
        lotNumber: row.lot_number != null ? String(row.lot_number) : null,
        marbleName: String(row.marble_name ?? ""),
        categoryName: relStr(row.marble_categories),
        thicknessName: relStr(row.thickness_options) || null,
        thumbnailUrl: images[0]?.url ?? null,
        images,
        sellingPrice: row.selling_price != null ? Number(row.selling_price) : null,
        slabCount: slabs.length,
        totalSqft: slabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0),
      };
    });
  } catch {
    return [];
  }
}

export async function getWebsiteLotById(id: string): Promise<CollectionLot | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("marble_lots")
      .select(
        `id, lot_number, marble_name, selling_price,
         marble_categories(name),
         thickness_options(name),
         slabs(slab_code, sqft, slab_images(image_url, sort_order))`,
      )
      .eq("id", id)
      .eq("show_on_website", true)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    const slabs = Array.isArray(row.slabs) ? (row.slabs as SlabRow[]) : [];
    const images = extractImages(slabs);

    return {
      id: String(row.id),
      lotNumber: row.lot_number != null ? String(row.lot_number) : null,
      marbleName: String(row.marble_name ?? ""),
      categoryName: relStr(row.marble_categories),
      thicknessName: relStr(row.thickness_options) || null,
      thumbnailUrl: images[0]?.url ?? null,
      images,
      sellingPrice: row.selling_price != null ? Number(row.selling_price) : null,
      slabCount: slabs.length,
      totalSqft: slabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0),
    };
  } catch {
    return null;
  }
}
