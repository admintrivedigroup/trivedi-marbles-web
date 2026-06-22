"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type UpdateLotResult = {
  error: string | null;
};

function parseOptionalNonNegativeNumber(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { error: null, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0)
    return { error: `${label} must be 0 or greater.`, value: null };
  return { error: null, value: n };
}

function normalizeForeignKey(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

export async function updateLot(
  lotId: string,
  formData: FormData,
): Promise<UpdateLotResult> {
  const lotNumber = String(formData.get("lotNumber") ?? "").trim();
  const marbleName = String(formData.get("marbleName") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const statusId = String(formData.get("statusId") ?? "").trim();
  const thicknessId = String(formData.get("thicknessId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const purchaseDate = String(formData.get("purchaseDate") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const sellingPriceInput = String(formData.get("sellingPrice") ?? "").trim();
  const dealerPriceInput = String(formData.get("dealerPrice") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const showOnWebsite = formData.get("showOnWebsite") === "true";

  if (!lotNumber) return { error: "Lot number is required." };
  if (!marbleName) return { error: "Marble name is required." };
  if (!categoryId) return { error: "Category is required." };
  if (!statusId) return { error: "Status is required." };
  if (!thicknessId) return { error: "Thickness is required." };
  if (!warehouseId) return { error: "Warehouse is required." };

  const sellingPriceResult = parseOptionalNonNegativeNumber(sellingPriceInput, "Sell price");
  if (sellingPriceResult.error) return { error: sellingPriceResult.error };

  const dealerPriceResult = parseOptionalNonNegativeNumber(dealerPriceInput, "Dealer price");
  if (dealerPriceResult.error) return { error: dealerPriceResult.error };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before saving." };
  }

  const { data: before } = await supabase
    .from("marble_lots")
    .select("lot_number, marble_name, selling_price, dealer_price")
    .eq("id", lotId)
    .single();

  const { error: lotError } = await supabase
    .from("marble_lots")
    .update({
      lot_number: lotNumber,
      marble_name: marbleName,
      category_id: normalizeForeignKey(categoryId),
      status_id: normalizeForeignKey(statusId),
      thickness_id: normalizeForeignKey(thicknessId),
      warehouse_id: normalizeForeignKey(warehouseId),
      purchase_date: purchaseDate || null,
      invoice_number: invoiceNumber || null,
      selling_price: sellingPriceResult.value,
      dealer_price: dealerPriceResult.value,
      notes: notes || null,
      show_on_website: showOnWebsite,
    })
    .eq("id", lotId);

  if (lotError) {
    const isDuplicate =
      lotError.code === "23505" && lotError.message.includes("lot_number");
    return {
      error: isDuplicate
        ? `Lot number "${lotNumber}" already exists. Please use a different lot number.`
        : `Unable to update lot. ${lotError.message}`,
    };
  }

  // Cascade price fields to all slabs. Status, warehouse, marble_name, category, and thickness
  // are not on slabs anymore — they are read from the lot via join.
  const { error: slabsError } = await supabase
    .from("slabs")
    .update({
      selling_price: sellingPriceResult.value,
      dealer_price: dealerPriceResult.value,
    })
    .eq("lot_id", lotId);

  if (slabsError) {
    return { error: `Lot updated, but slab price sync failed. ${slabsError.message}` };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.edited",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotNumber,
    diff: {
      before: {
        lotNumber: before?.lot_number ?? null,
        marbleName: before?.marble_name ?? null,
        sellingPrice: before?.selling_price ?? null,
        dealerPrice: before?.dealer_price ?? null,
      },
      after: {
        lotNumber,
        marbleName,
        sellingPrice: sellingPriceResult.value,
        dealerPrice: dealerPriceResult.value,
      },
    },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  revalidatePath("/collection");

  return { error: null };
}
