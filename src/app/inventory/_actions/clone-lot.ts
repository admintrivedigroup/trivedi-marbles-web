"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type CloneLotResult = {
  error: string | null;
  newLotId: string | null;
};

export async function cloneLot(
  sourceLotId: string,
  newLotNumber: string,
): Promise<CloneLotResult> {
  const trimmed = newLotNumber.trim();
  if (!trimmed) return { error: "New lot number is required.", newLotId: null };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before cloning.", newLotId: null };
  }

  // Fetch source lot
  const { data: sourceLot, error: lotFetchError } = await supabase
    .from("marble_lots")
    .select(
      "marble_name, category_id, thickness_id, warehouse_id, status_id, cost_price, selling_price, dealer_price, notes, show_on_website",
    )
    .eq("id", sourceLotId)
    .single();

  if (lotFetchError || !sourceLot) {
    return { error: "Unable to load source lot.", newLotId: null };
  }

  // Fetch source slabs (marble_name/category_id/thickness_id are now on the lot, not slabs)
  const { data: sourceSlabs, error: slabsFetchError } = await supabase
    .from("slabs")
    .select(
      "slab_code, length, width, sqft, rack_number, warehouse_id, cost_price, selling_price, dealer_price, notes",
    )
    .eq("lot_id", sourceLotId)
    .is("deleted_at", null);

  if (slabsFetchError) {
    return { error: "Unable to load source slabs.", newLotId: null };
  }

  // Find the "Available" status id to reset slab statuses
  const { data: availStatus } = await supabase
    .from("slab_statuses")
    .select("id")
    .eq("name", "Available")
    .single();

  // Insert new lot
  const { data: newLot, error: newLotError } = await supabase
    .from("marble_lots")
    .insert({
      lot_number: trimmed,
      marble_name: sourceLot.marble_name,
      category_id: sourceLot.category_id,
      thickness_id: sourceLot.thickness_id,
      warehouse_id: sourceLot.warehouse_id,
      status_id: sourceLot.status_id,
      cost_price: sourceLot.cost_price,
      selling_price: sourceLot.selling_price,
      dealer_price: sourceLot.dealer_price,
      notes: sourceLot.notes,
      show_on_website: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (newLotError || !newLot) {
    const isDuplicate =
      newLotError?.code === "23505" && newLotError.message.includes("lot_number");
    return {
      error: isDuplicate
        ? `Lot number "${trimmed}" already exists. Choose a different number.`
        : `Unable to create cloned lot. ${newLotError?.message ?? "Unknown error."}`,
      newLotId: null,
    };
  }

  const newLotId = String(newLot.id);

  // Insert cloned slabs with Available status, clearing reservation fields
  if (sourceSlabs && sourceSlabs.length > 0) {
    const slabPayloads = sourceSlabs.map((slab) => ({
      lot_id: newLot.id,
      slab_code: slab.slab_code,
      length: slab.length,
      width: slab.width,
      sqft: slab.sqft,
      rack_number: slab.rack_number,
      warehouse_id: slab.warehouse_id,
      status_id: availStatus?.id ?? null,
      cost_price: slab.cost_price,
      selling_price: slab.selling_price,
      dealer_price: slab.dealer_price,
      notes: slab.notes,
      created_by: user.id,
    }));

    const { error: slabsInsertError } = await supabase
      .from("slabs")
      .insert(slabPayloads);

    if (slabsInsertError) {
      await supabase.from("marble_lots").delete().eq("id", newLot.id);
      return { error: `Lot created but slabs failed to clone. ${slabsInsertError.message}`, newLotId: null };
    }
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.cloned",
    targetType: "lot",
    targetId: newLotId,
    targetLabel: trimmed,
    diff: { sourceLotId, sourceLotNumber: trimmed, slabCount: sourceSlabs?.length ?? 0 },
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, newLotId };
}
