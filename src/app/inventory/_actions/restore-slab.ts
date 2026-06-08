"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type RestoreSlabResult = {
  error: string | null;
};

export async function restoreSlab(slabId: string): Promise<RestoreSlabResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again." };
  }

  const { data: slab } = await supabase
    .from("slabs")
    .select("slab_code, lot_id")
    .eq("id", slabId)
    .single();

  const { error } = await supabase
    .from("slabs")
    .update({ deleted_at: null })
    .eq("id", slabId);

  if (error) return { error: `Unable to restore slab. ${error.message}` };

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.restored",
    targetType: "slab",
    targetId: slabId,
    targetLabel: typeof slab?.slab_code === "string" ? slab.slab_code : slabId,
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/archive");
  if (slab?.lot_id) revalidatePath(`/inventory/lot/${slab.lot_id}`);

  return { error: null };
}
