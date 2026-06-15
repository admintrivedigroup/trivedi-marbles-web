"use server";

import { revalidatePath } from "next/cache";

import type { SaveLotResult } from "@/app/inventory/_actions/stock-state";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import {
  parseRequiredPositiveNumber,
  parseOptionalNonNegativeNumber,
} from "@/app/inventory/_lib/validate";

type SlabInput = {
  notes: string | null;
  length: number;
  rackNumber: string | null;
  slabCode: string;
  sqft: number;
  width: number;
};

function normalizeForeignKey(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

export async function saveLot(formData: FormData): Promise<SaveLotResult> {
  const lotNumber = String(formData.get("lotNumber") ?? "").trim();
  const marbleName = String(formData.get("marbleName") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const statusId = String(formData.get("statusId") ?? "").trim();
  const thicknessId = String(formData.get("thicknessId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const purchaseDate = String(formData.get("purchaseDate") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const costPriceInput = String(formData.get("costPrice") ?? "").trim();
  const sellingPriceInput = String(formData.get("sellingPrice") ?? "").trim();
  const dealerPriceInput = String(formData.get("dealerPrice") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const slabsJson = String(formData.get("slabsJson") ?? "").trim();

  if (!lotNumber) return { lotId: null, message: "Lot number is required.", slabCount: 0, slabIds: [], status: "error" };
  if (!marbleName) return { lotId: null, message: "Marble name is required.", slabCount: 0, slabIds: [], status: "error" };
  if (!categoryId) return { lotId: null, message: "Category is required.", slabCount: 0, slabIds: [], status: "error" };
  if (!statusId) return { lotId: null, message: "Status is required.", slabCount: 0, slabIds: [], status: "error" };
  if (!thicknessId) return { lotId: null, message: "Thickness is required.", slabCount: 0, slabIds: [], status: "error" };
  if (!warehouseId) return { lotId: null, message: "Warehouse is required.", slabCount: 0, slabIds: [], status: "error" };

  const costPriceResult = parseOptionalNonNegativeNumber(costPriceInput, "Cost price");
  if (costPriceResult.error) return { lotId: null, message: costPriceResult.error, slabCount: 0, slabIds: [], status: "error" };

  const sellingPriceResult = parseOptionalNonNegativeNumber(sellingPriceInput, "Sell price");
  if (sellingPriceResult.error) return { lotId: null, message: sellingPriceResult.error, slabCount: 0, slabIds: [], status: "error" };

  const dealerPriceResult = parseOptionalNonNegativeNumber(dealerPriceInput, "Dealer price");
  if (dealerPriceResult.error) return { lotId: null, message: dealerPriceResult.error, slabCount: 0, slabIds: [], status: "error" };

  let rawSlabs: unknown[];
  try {
    rawSlabs = JSON.parse(slabsJson);
    if (!Array.isArray(rawSlabs) || rawSlabs.length === 0) {
      return { lotId: null, message: "At least one slab is required.", slabCount: 0, slabIds: [], status: "error" };
    }
  } catch {
    return { lotId: null, message: "Invalid slab data. Please try again.", slabCount: 0, slabIds: [], status: "error" };
  }

  const slabs: SlabInput[] = [];
  for (let i = 0; i < rawSlabs.length; i++) {
    const raw = rawSlabs[i] as Record<string, unknown>;
    const slabCode = String(raw.slabCode ?? "").trim();
    if (!slabCode) {
      return { lotId: null, message: `Slab ${i + 1}: Slab ID is required.`, slabCount: 0, slabIds: [], status: "error" };
    }

    const lengthResult = parseRequiredPositiveNumber(String(raw.length ?? ""), `Slab ${i + 1} length`);
    if (lengthResult.error || lengthResult.value === null) {
      return { lotId: null, message: lengthResult.error, slabCount: 0, slabIds: [], status: "error" };
    }

    const widthResult = parseRequiredPositiveNumber(String(raw.width ?? ""), `Slab ${i + 1} width`);
    if (widthResult.error || widthResult.value === null) {
      return { lotId: null, message: widthResult.error, slabCount: 0, slabIds: [], status: "error" };
    }

    const length = lengthResult.value;
    const width = widthResult.value;

    slabs.push({
      slabCode,
      length,
      width,
      sqft: Number((length * width).toFixed(2)),
      rackNumber: String(raw.rackNumber ?? "").trim() || null,
      notes: String(raw.notes ?? "").trim() || null,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { lotId: null, message: "Please sign in again before saving.", slabCount: 0, slabIds: [], status: "error" };
  }

  const { data: lotData, error: lotError } = await supabase
    .from("marble_lots")
    .insert({
      lot_number: lotNumber,
      marble_name: marbleName,
      category_id: normalizeForeignKey(categoryId),
      status_id: normalizeForeignKey(statusId),
      thickness_id: normalizeForeignKey(thicknessId),
      warehouse_id: normalizeForeignKey(warehouseId),
      purchase_date: purchaseDate || null,
      invoice_number: invoiceNumber || null,
      cost_price: costPriceResult.value,
      selling_price: sellingPriceResult.value,
      dealer_price: dealerPriceResult.value,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (lotError || !lotData) {
    const isDuplicateLotNumber =
      lotError?.code === "23505" &&
      lotError.message.includes("lot_number");
    return {
      lotId: null,
      message: isDuplicateLotNumber
        ? `Lot number "${lotNumber}" already exists. Please use a different lot number.`
        : `Unable to save lot. ${lotError?.message ?? "Unknown error."}`,
      slabCount: 0,
      slabIds: [],
      status: "error",
    };
  }

  const lotId = String(lotData.id);

  const slabPayloads = slabs.map((slab) => ({
    lot_id: lotData.id,
    slab_code: slab.slabCode,
    status_id: normalizeForeignKey(statusId),
    warehouse_id: normalizeForeignKey(warehouseId),
    cost_price: costPriceResult.value,
    selling_price: sellingPriceResult.value,
    dealer_price: dealerPriceResult.value,
    length: slab.length,
    width: slab.width,
    sqft: slab.sqft,
    rack_number: slab.rackNumber,
    notes: slab.notes,
    created_by: user.id,
  }));

  const { data: slabsData, error: slabsError } = await supabase
    .from("slabs")
    .insert(slabPayloads)
    .select("id");

  if (slabsError) {
    await supabase.from("marble_lots").delete().eq("id", lotData.id);
    return {
      lotId: null,
      message: `Slabs failed to save. ${slabsError.message}`,
      slabCount: 0,
      slabIds: [],
      status: "error",
    };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.created",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotNumber,
    diff: {
      marbleName,
      slabCount: slabs.length,
    },
  }).catch(() => {});

  revalidatePath("/inventory/add");
  revalidatePath("/inventory/dashboard");
  revalidatePath("/inventory/list");

  return {
    lotId,
    message: `Lot saved with ${slabs.length} slab${slabs.length === 1 ? "" : "s"}.`,
    slabCount: slabs.length,
    slabIds: (slabsData ?? []).map((row) => String(row.id)),
    status: "success",
  };
}
