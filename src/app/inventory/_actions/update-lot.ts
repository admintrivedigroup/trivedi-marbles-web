"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { renameSlabCode } from "@/app/inventory/_lib/slab-code";

export type UpdateLotResult = {
  error: string | null;
};

function normalizeForeignKey(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

export async function updateLot(
  lotId: string,
  formData: FormData,
): Promise<UpdateLotResult> {
  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error };

  const lotNumber = String(formData.get("lotNumber") ?? "").trim();
  const marbleName = String(formData.get("marbleName") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const statusId = String(formData.get("statusId") ?? "").trim();
  const thicknessId = String(formData.get("thicknessId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const purchaseDate = String(formData.get("purchaseDate") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const showOnWebsite = formData.get("showOnWebsite") === "true";

  if (!lotNumber) return { error: "Lot number is required." };
  if (!marbleName) return { error: "Marble name is required." };
  if (!categoryId) return { error: "Category is required." };
  if (!statusId) return { error: "Status is required." };
  if (!thicknessId) return { error: "Thickness is required." };
  if (!warehouseId) return { error: "Warehouse is required." };

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
    .select("lot_number, marble_name")
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

  // Slab codes embed the lot number (e.g. FGP-116-S10), so carry a rename over.
  const oldLotNumber = before?.lot_number ?? "";
  let slabsRenamed = 0;
  let slabRenameError: string | null = null;

  if (oldLotNumber && oldLotNumber.trim() !== lotNumber) {
    const { data: slabs, error: slabsError } = await supabase
      .from("slabs")
      .select("id, slab_code")
      .eq("lot_id", lotId);

    if (slabsError) {
      slabRenameError = slabsError.message;
    } else {
      const renames = (slabs ?? []).flatMap((slab) => {
        const code = typeof slab.slab_code === "string" ? slab.slab_code : "";
        const next = renameSlabCode(code, oldLotNumber, lotNumber);
        return next ? [{ id: slab.id, slabCode: next }] : [];
      });

      const results = await Promise.all(
        renames.map(({ id, slabCode }) =>
          supabase.from("slabs").update({ slab_code: slabCode }).eq("id", id),
        ),
      );
      const failed = results.find((r) => r.error);
      slabsRenamed = results.filter((r) => !r.error).length;
      if (failed?.error) slabRenameError = failed.error.message;
    }
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
      },
      after: {
        lotNumber,
        marbleName,
        ...(slabsRenamed ? { slabsRenamed } : {}),
      },
    },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  revalidatePath("/collection");

  if (slabRenameError) {
    return {
      error: `Lot saved, but some slab codes could not be updated to "${lotNumber}". ${slabRenameError}`,
    };
  }

  return { error: null };
}
