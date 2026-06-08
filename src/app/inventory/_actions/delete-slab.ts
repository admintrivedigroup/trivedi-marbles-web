"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type DeleteSlabResult = {
  error: string | null;
  lotId: string | null;
};

export async function deleteSlab(slabId: string): Promise<DeleteSlabResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before deleting.", lotId: null };
  }

  const { data: slab } = await supabase
    .from("slabs")
    .select("lot_id, slab_code, marble_name, sqft, warehouses(name)")
    .eq("id", slabId)
    .single();

  const lotId = slab?.lot_id != null ? String(slab.lot_id) : null;
  const slabCode = typeof slab?.slab_code === "string" ? slab.slab_code : slabId;
  const rawWarehouse = slab?.warehouses as unknown as { name?: string } | { name?: string }[] | null;
  const warehouseName = Array.isArray(rawWarehouse)
    ? (rawWarehouse[0]?.name ?? null)
    : (rawWarehouse?.name ?? null);

  const { error: deleteError } = await supabase
    .from("slabs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", slabId);

  if (deleteError) {
    return { error: `Unable to archive slab. ${deleteError.message}`, lotId: null };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.archived",
    targetType: "slab",
    targetId: slabId,
    targetLabel: slabCode,
    diff: {
      marbleName: slab?.marble_name ?? null,
      sqft: slab?.sqft ?? null,
      warehouse: warehouseName,
      lotId,
    },
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  if (lotId) revalidatePath(`/inventory/lot/${lotId}`);

  return { error: null, lotId };
}
