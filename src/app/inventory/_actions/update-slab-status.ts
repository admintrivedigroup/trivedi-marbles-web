"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

// Subset of SLAB_STATUS values that can be set manually via this action.
// "In Transit" is excluded — that status is managed by the transfer workflow.
export type SlabStatusName = "Reserved" | "Sold" | "Available";

export type ReservationData = {
  reservedFor: string;
  reservedUntil: string;
};

export type UpdateSlabStatusResult = {
  error: string | null;
};

export async function updateSlabStatus(
  slabId: string,
  statusName: SlabStatusName,
  reservationData?: ReservationData | null,
): Promise<UpdateSlabStatusResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before updating status." };
  }

  const { data: statusData, error: statusError } = await supabase
    .from("slab_statuses")
    .select("id")
    .eq("name", statusName)
    .single();

  if (statusError || !statusData) {
    return { error: `Status "${statusName}" not found in the system.` };
  }

  const numericId = /^-?\d+$/.test(slabId) ? Number(slabId) : slabId;

  const { data: currentSlab } = await supabase
    .from("slabs")
    .select("slab_code, lot_id, slab_statuses(name)")
    .eq("id", numericId)
    .single();

  const rawStatus = currentSlab?.slab_statuses as unknown as { name?: string } | { name?: string }[] | null;
  const oldStatusName = Array.isArray(rawStatus)
    ? (rawStatus[0]?.name ?? null)
    : (rawStatus?.name ?? null);

  const updatePayload: Record<string, unknown> = { status_id: statusData.id };

  if (statusName === SLAB_STATUS.RESERVED && reservationData) {
    updatePayload.reserved_for = reservationData.reservedFor;
    updatePayload.reserved_until = reservationData.reservedUntil;
  } else if (statusName === SLAB_STATUS.AVAILABLE) {
    updatePayload.reserved_for = null;
    updatePayload.reserved_until = null;
  }

  const { error } = await supabase
    .from("slabs")
    .update(updatePayload)
    .eq("id", numericId);

  if (error) {
    return { error: `Unable to update status. ${error.message}` };
  }

  const slabCode =
    typeof currentSlab?.slab_code === "string" ? currentSlab.slab_code : slabId;

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.status_changed",
    targetType: "slab",
    targetId: slabId,
    targetLabel: slabCode,
    diff: {
      lotId: currentSlab?.lot_id != null ? String(currentSlab.lot_id) : null,
      before: oldStatusName,
      after: statusName,
      ...(statusName === SLAB_STATUS.RESERVED && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  revalidatePath(`/inventory/slab/${slabId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null };
}
