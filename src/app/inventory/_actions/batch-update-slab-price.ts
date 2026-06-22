"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type BatchUpdateSlabPriceResult = {
  error: string | null;
};

export async function batchUpdateSlabPrice(
  slabIds: string[],
  lotId: string,
  prices: {
    sellingPrice: number | null;
    dealerPrice: number | null;
  },
): Promise<BatchUpdateSlabPriceResult> {
  if (slabIds.length === 0) return { error: "No slabs selected." };

  const { sellingPrice, dealerPrice } = prices;
  const hasAnyPrice = sellingPrice !== null || dealerPrice !== null;
  if (!hasAnyPrice) return { error: "Enter at least one price to update." };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before updating prices." };
  }

  const payload: Record<string, number | null> = {};
  if (sellingPrice !== null) payload.selling_price = sellingPrice;
  if (dealerPrice !== null) payload.dealer_price = dealerPrice;

  const { error } = await supabase
    .from("slabs")
    .update(payload)
    .in("id", slabIds)
    .eq("lot_id", lotId);

  if (error) {
    return { error: `Unable to update prices. ${error.message}` };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.prices_updated",
    targetType: "lot",
    targetId: lotId,
    targetLabel: `${slabIds.length} slab${slabIds.length === 1 ? "" : "s"}`,
    diff: { slabCount: slabIds.length, sellingPrice, dealerPrice },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");

  return { error: null };
}
