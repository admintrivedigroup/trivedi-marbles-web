"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/app/inventory/_lib/action-auth";

export type ReorderSlabImagesResult = {
  error: string | null;
};

export async function reorderSlabImages(
  slabId: string,
  orderedImageIds: string[],
): Promise<ReorderSlabImagesResult> {
  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();

  const updates = orderedImageIds.map((id, index) => ({
    id,
    slab_id: slabId,
    sort_order: index,
  }));

  const { error } = await supabase
    .from("slab_images")
    .upsert(updates, { onConflict: "id" });

  if (error) return { error: `Unable to save image order. ${error.message}` };
  return { error: null };
}
