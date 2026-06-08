"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { parseRequiredPositiveNumber } from "@/app/inventory/_lib/validate";

export type UpdateSlabResult = {
  error: string | null;
};

export async function updateSlab(
  slabId: string,
  formData: FormData,
): Promise<UpdateSlabResult> {
  const slabCode = String(formData.get("slabCode") ?? "").trim();
  const lengthInput = String(formData.get("length") ?? "").trim();
  const widthInput = String(formData.get("width") ?? "").trim();
  const rackNumber = String(formData.get("rackNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const submittedUpdatedAt = String(formData.get("updatedAt") ?? "").trim();

  if (!slabCode) return { error: "Slab code is required." };

  const lengthResult = parseRequiredPositiveNumber(lengthInput, "Length");
  if (lengthResult.error || lengthResult.value === null)
    return { error: lengthResult.error };

  const widthResult = parseRequiredPositiveNumber(widthInput, "Width");
  if (widthResult.error || widthResult.value === null)
    return { error: widthResult.error };

  const length = lengthResult.value;
  const width = widthResult.value;
  const sqft = Number((length * width).toFixed(2));

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before saving." };
  }

  const { data: before } = await supabase
    .from("slabs")
    .select("slab_code, length, width, sqft, rack_number, notes, lot_id")
    .eq("id", slabId)
    .single();

  let updateQuery = supabase
    .from("slabs")
    .update({
      slab_code: slabCode,
      length,
      width,
      sqft,
      rack_number: rackNumber || null,
      notes: notes || null,
    })
    .eq("id", slabId);

  if (submittedUpdatedAt) {
    updateQuery = updateQuery.eq("updated_at", submittedUpdatedAt);
  }

  const { data: updated, error: slabError } = await updateQuery
    .select("lot_id")
    .maybeSingle();

  if (slabError) {
    return { error: `Unable to update slab. ${slabError.message}` };
  }

  if (!updated && submittedUpdatedAt) {
    return { error: "This slab was modified by someone else while you were editing. Please reload the page and try again." };
  }

  const lotId = updated?.lot_id != null ? String(updated.lot_id) : null;

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.edited",
    targetType: "slab",
    targetId: slabId,
    targetLabel: slabCode,
    diff: {
      lotId: before?.lot_id != null ? String(before.lot_id) : null,
      before: {
        slabCode: before?.slab_code ?? null,
        length: before?.length ?? null,
        width: before?.width ?? null,
        sqft: before?.sqft ?? null,
        rackNumber: before?.rack_number ?? null,
        notes: before?.notes ?? null,
      },
      after: { slabCode, length, width, sqft, rackNumber: rackNumber || null, notes: notes || null },
    },
  }).catch(() => {});

  revalidatePath(`/inventory/slab/${slabId}`);
  if (lotId) revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");

  return { error: null };
}
