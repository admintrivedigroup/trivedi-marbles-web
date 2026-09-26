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
import type { ReservationData } from "@/app/inventory/_actions/update-slab-status";

export type BatchUpdateSlabsResult = {
  error: string | null;
  updatedCount: number;
};

// A batch either applies to every selected slab or to none. Silently skipping the
// ones that no longer qualify would leave the user believing the whole selection changed.
export async function batchUpdateSlabsStatus(
  slabIds: string[],
  statusName: "Reserved" | "Sold" | "Available",
  lotId: string,
  reservationData?: ReservationData | null,
): Promise<BatchUpdateSlabsResult> {
  if (slabIds.length === 0) return { error: null, updatedCount: 0 };

  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error, updatedCount: 0 };

  if (statusName === SLAB_STATUS.RESERVED) {
    const reservationError = validateReservation(reservationData);
    if (reservationError) return { error: reservationError, updatedCount: 0 };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before updating status.", updatedCount: 0 };
  }

  const { data: statusData, error: statusError } = await supabase
    .from("slab_statuses")
    .select("id")
    .eq("name", statusName)
    .single();

  if (statusError || !statusData) {
    return { error: `Status "${statusName}" not found in the system.`, updatedCount: 0 };
  }

  const uniqueIds = [...new Set(slabIds.map(String))];

  // Scoped to lotId so the id list can't reach slabs outside the lot the user is viewing.
  const { data: currentSlabs, error: fetchError } = await supabase
    .from("slabs")
    .select("id, slab_code, warehouse_id, status_id, reserved_for, slab_statuses(name)")
    .in("id", uniqueIds)
    .eq("lot_id", lotId)
    .is("deleted_at", null);

  if (fetchError) {
    return { error: `Unable to load slabs. ${fetchError.message}`, updatedCount: 0 };
  }
  if (!currentSlabs || currentSlabs.length !== uniqueIds.length) {
    return {
      error: "Some selected slabs no longer exist in this lot — refresh and try again.",
      updatedCount: 0,
    };
  }

  const inTransitIds = await getInTransitSlabIds();

  for (const slab of currentSlabs) {
    const label = typeof slab.slab_code === "string" ? slab.slab_code : String(slab.id);
    const warehouseId = slab.warehouse_id != null ? String(slab.warehouse_id) : null;
    if (!hasWarehouseAccess(auth.profile.warehouseIds, warehouseId)) {
      return { error: `You don't have access to the warehouse holding ${label}.`, updatedCount: 0 };
    }
    const transitionError = checkSlabTransition({
      slabLabel: label,
      currentStatus: relName(slab.slab_statuses),
      currentReservedFor: slab.reserved_for ?? null,
      target: statusName,
      reservation: reservationData,
      inTransit: inTransitIds.has(String(slab.id)),
    });
    if (transitionError) return { error: transitionError, updatedCount: 0 };
  }

  const updatePayload = {
    status_id: statusData.id,
    ...reservationColumns(statusName, reservationData),
  };

  const currentStatusIds = [...new Set(currentSlabs.map((s) => s.status_id))];
  const { data: updatedRows, error: updateError } = await supabase
    .from("slabs")
    .update(updatePayload)
    .in("id", uniqueIds)
    .in("status_id", currentStatusIds)
    .select("id");

  if (updateError) {
    return { error: `Unable to update slabs. ${updateError.message}`, updatedCount: 0 };
  }

  const updatedIds = (updatedRows ?? []).map((r) => String(r.id));
  if (updatedIds.length !== uniqueIds.length) {
    return {
      error: `Only ${updatedIds.length} of ${uniqueIds.length} slabs were updated — some changed while you were working. Refresh and check.`,
      updatedCount: updatedIds.length,
    };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.batch_status_changed",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotId,
    diff: {
      after: statusName,
      slabCount: updatedIds.length,
      ...(statusName === SLAB_STATUS.RESERVED && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  if (statusName === SLAB_STATUS.RESERVED || statusName === SLAB_STATUS.SOLD) {
    notifyLowStockForSlabIds(updatedIds).catch(() => {});
  }
  notifyStatusChange({ slabIds: updatedIds, statusName, actorUserId: user.id, lotId }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, updatedCount: updatedIds.length };
}
