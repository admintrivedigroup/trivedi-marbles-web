"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import { notifyLowStockForSlabIds } from "@/app/inventory/_lib/low-stock";
import { notifyStatusChange } from "@/app/inventory/_lib/stock-movement-notify";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import {
  checkSlabTransition,
  hasWarehouseAccess,
  reservationColumns,
  validateReservation,
} from "@/app/inventory/_lib/slab-transitions";
import { relName } from "@/app/inventory/_lib/normalize";

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
  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error };

  if (statusName === SLAB_STATUS.RESERVED) {
    const reservationError = validateReservation(reservationData);
    if (reservationError) return { error: reservationError };
  }

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
    .select("slab_code, lot_id, warehouse_id, status_id, reserved_for, slab_statuses(name)")
    .eq("id", numericId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!currentSlab) {
    return { error: "Slab not found." };
  }

  const warehouseId = currentSlab.warehouse_id != null ? String(currentSlab.warehouse_id) : null;
  if (!hasWarehouseAccess(auth.profile.warehouseIds, warehouseId)) {
    return { error: "You don't have access to this slab's warehouse." };
  }

  const oldStatusName = relName(currentSlab.slab_statuses);
  const slabCode =
    typeof currentSlab.slab_code === "string" ? currentSlab.slab_code : slabId;

  const inTransitIds = await getInTransitSlabIds();
  const transitionError = checkSlabTransition({
    slabLabel: slabCode,
    currentStatus: oldStatusName,
    currentReservedFor: currentSlab.reserved_for ?? null,
    target: statusName,
    reservation: reservationData,
    inTransit: inTransitIds.has(String(slabId)),
  });
  if (transitionError) return { error: transitionError };

  const updatePayload = {
    status_id: statusData.id,
    ...reservationColumns(statusName, reservationData),
  };

  // Only write if the slab still has the status we validated against, so two people
  // acting on the same slab at once can't both succeed.
  const { data: updatedRows, error } = await supabase
    .from("slabs")
    .update(updatePayload)
    .eq("id", numericId)
    .eq("status_id", currentSlab.status_id)
    .select("id");

  if (error) {
    return { error: `Unable to update status. ${error.message}` };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { error: `${slabCode} was changed by someone else — refresh and try again.` };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.status_changed",
    targetType: "slab",
    targetId: slabId,
    targetLabel: slabCode,
    diff: {
      lotId: currentSlab.lot_id != null ? String(currentSlab.lot_id) : null,
      before: oldStatusName,
      after: statusName,
      ...(statusName === SLAB_STATUS.RESERVED && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  if (statusName === SLAB_STATUS.RESERVED || statusName === SLAB_STATUS.SOLD) {
    notifyLowStockForSlabIds([slabId]).catch(() => {});
  }
  notifyStatusChange({ slabIds: [slabId], statusName, actorUserId: user.id }).catch(() => {});

  revalidatePath(`/inventory/slab/${slabId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null };
}
