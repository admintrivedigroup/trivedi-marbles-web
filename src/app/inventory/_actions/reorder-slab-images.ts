"use server";

import { createClient } from "@/lib/supabase/server";

export type ReorderSlabImagesResult = {
  error: string | null;
};

export async function reorderSlabImages(
  slabId: string,
  orderedImageIds: string[],
): Promise<ReorderSlabImagesResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { error: "Please sign in again." };

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
