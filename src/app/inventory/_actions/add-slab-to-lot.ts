"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type AddSlabToLotResult = {
  error: string | null;
  slabId: string | null;
};

export async function addSlabToLot(
  lotId: string,
  formData: FormData,
): Promise<AddSlabToLotResult> {
  const slabCode = String(formData.get("slabCode") ?? "").trim();
  const lengthInput = String(formData.get("length") ?? "").trim();
  const widthInput = String(formData.get("width") ?? "").trim();
  const rackNumber = String(formData.get("rackNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const statusId = String(formData.get("statusId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const thicknessId = String(formData.get("thicknessId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const marbleName = String(formData.get("marbleName") ?? "").trim();
  const costPriceInput = String(formData.get("costPrice") ?? "").trim();
  const sellingPriceInput = String(formData.get("sellingPrice") ?? "").trim();
  const dealerPriceInput = String(formData.get("dealerPrice") ?? "").trim();

  if (!slabCode) return { error: "Slab code is required.", slabId: null };
  if (!statusId) return { error: "Status is required.", slabId: null };

  const length = parseFloat(lengthInput);
  const width = parseFloat(widthInput);

  if (!length || length <= 0) return { error: "Length must be greater than 0.", slabId: null };
  if (!width || width <= 0) return { error: "Width must be greater than 0.", slabId: null };

  const sqft = Number((length * width).toFixed(2));

  function toOptionalPrice(raw: string): number | null {
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("slabs")
    .insert({
      slab_code: slabCode,
      marble_name: marbleName || null,
      length,
      width,
      sqft,
      rack_number: rackNumber || null,
      notes: notes || null,
      lot_id: lotId,
      category_id: categoryId || null,
      status_id: statusId || null,
      thickness_id: thicknessId || null,
      warehouse_id: warehouseId || null,
      cost_price: toOptionalPrice(costPriceInput),
      selling_price: toOptionalPrice(sellingPriceInput),
      dealer_price: toOptionalPrice(dealerPriceInput),
    })
    .select("id")
    .single();

  if (error) {
    return { error: `Failed to add slab. ${error.message}`, slabId: null };
  }

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: "slab.created",
    targetType: "slab",
    targetId: String(data.id),
    targetLabel: slabCode,
    diff: {
      lotId,
      marbleName: marbleName || null,
      sqft,
      rackNumber: rackNumber || null,
    },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");

  return { error: null, slabId: String(data.id) };
}
