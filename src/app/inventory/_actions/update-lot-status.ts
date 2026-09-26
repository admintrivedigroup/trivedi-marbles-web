"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import { notifyLowStockForSlabIds } from "@/app/inventory/_lib/low-stock";
import { notifyStatusChange } from "@/app/inventory/_lib/stock-movement-notify";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import { hasWarehouseAccess, validateReservation } from "@/app/inventory/_lib/slab-transitions";
import type { ReservationData } from "@/app/inventory/_actions/update-slab-status";

export type UpdateLotStatusResult = {
  error: string | null;
  updatedCount: number;
};

type LotBulkAction = "Reserved" | "Sold" | "UnreserveLot" | "UnsellLot";

const ACTION_CONFIG: Record<LotBulkAction, {
  targetStatus: string;
  fromStatuses: string[];
  emptyError: string;
}> = {
  Reserved:     { targetStatus: SLAB_STATUS.RESERVED,  fromStatuses: [SLAB_STATUS.AVAILABLE],                              emptyError: "No available slabs to reserve in this lot." },
  Sold:         { targetStatus: SLAB_STATUS.SOLD,       fromStatuses: [SLAB_STATUS.AVAILABLE, SLAB_STATUS.RESERVED],        emptyError: "No available or reserved slabs to mark as sold." },
  UnreserveLot: { targetStatus: SLAB_STATUS.AVAILABLE,  fromStatuses: [SLAB_STATUS.RESERVED],                              emptyError: "No reserved slabs to unreserve in this lot." },
  UnsellLot:    { targetStatus: SLAB_STATUS.AVAILABLE,  fromStatuses: [SLAB_STATUS.SOLD],                                  emptyError: "No sold slabs to mark as available in this lot." },
};

export async function updateLotSlabsStatus(
  lotId: string,
  action: LotBulkAction,
  reservationData?: ReservationData | null,
): Promise<UpdateLotStatusResult> {
  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error, updatedCount: 0 };

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before updating status.", updatedCount: 0 };
  }

  if (action === "Reserved") {
    const reservationError = validateReservation(reservationData);
    if (reservationError) return { error: reservationError, updatedCount: 0 };
  }

  const config = ACTION_CONFIG[action];

  const { data: statusData, error: statusError } = await supabase
    .from("slab_statuses")
    .select("id, name")
    .in("name", [SLAB_STATUS.AVAILABLE, SLAB_STATUS.RESERVED, SLAB_STATUS.SOLD]);

  if (statusError || !statusData) {
    return { error: "Unable to load slab statuses.", updatedCount: 0 };
  }

  const statusMap = Object.fromEntries(statusData.map((s: { id: string; name: string }) => [s.name, s.id]));

  const targetStatusId = statusMap[config.targetStatus];
  if (!targetStatusId) {
    return { error: `Status "${config.targetStatus}" not found.`, updatedCount: 0 };
  }

  const eligibleStatusIds = config.fromStatuses.map((s) => statusMap[s]).filter(Boolean);
  if (eligibleStatusIds.length === 0) {
    return { error: "No eligible statuses found.", updatedCount: 0 };
  }

  const { data: slabRows, error: slabFetchError } = await supabase
    .from("slabs")
    .select("id, warehouse_id")
    .eq("lot_id", lotId)
    .in("status_id", eligibleStatusIds)
    .is("deleted_at", null);

  if (slabFetchError) {
    return { error: `Unable to load slabs. ${slabFetchError.message}`, updatedCount: 0 };
  }

  // Slabs in a pending transfer or in a warehouse this user can't access are left alone.
  const inTransitIds = await getInTransitSlabIds();
  const eligibleRows = (slabRows ?? []).filter(
    (s: { id: unknown; warehouse_id: unknown }) =>
      !inTransitIds.has(String(s.id)) &&
      hasWarehouseAccess(auth.profile.warehouseIds, s.warehouse_id != null ? String(s.warehouse_id) : null),
  );

  if (eligibleRows.length === 0) {
    return { error: config.emptyError, updatedCount: 0 };
  }

  const slabIds = eligibleRows.map((s: { id: unknown }) => s.id);

  const updatePayload: Record<string, unknown> = { status_id: targetStatusId };
  if (action === "Reserved" && reservationData) {
    updatePayload.reserved_for = reservationData.reservedFor.trim();
    updatePayload.reserved_until = reservationData.reservedUntil;
  } else {
    updatePayload.reserved_for = null;
    updatePayload.reserved_until = null;
  }

  // Only rows still in an eligible status are written, so a concurrent change isn't overwritten.
  const { data: updatedRows, error: updateError } = await supabase
    .from("slabs")
    .update(updatePayload)
    .in("id", slabIds)
    .in("status_id", eligibleStatusIds)
    .select("id");

  if (updateError) {
    return { error: `Unable to update slabs. ${updateError.message}`, updatedCount: 0 };
  }

  const updatedSlabIds = (updatedRows ?? []).map((r: { id: unknown }) => r.id);
  if (updatedSlabIds.length === 0) {
    return { error: config.emptyError, updatedCount: 0 };
  }

  const { data: lotRow } = await supabase
    .from("marble_lots")
    .select("lot_number, marble_name")
    .eq("id", lotId)
    .maybeSingle();
  const lotLabel = lotRow
    ? [lotRow.marble_name, lotRow.lot_number].filter(Boolean).join(" · ") || lotId
    : lotId;

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.bulk_status_changed",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotLabel,
    diff: {
      action,
      after: config.targetStatus,
      slabCount: updatedSlabIds.length,
      ...(action === "Reserved" && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  if (config.targetStatus === SLAB_STATUS.RESERVED || config.targetStatus === SLAB_STATUS.SOLD) {
    notifyLowStockForSlabIds(updatedSlabIds.map(String)).catch(() => {});
  }

  notifyStatusChange({
    slabIds: updatedSlabIds.map(String),
    statusName: config.targetStatus as "Available" | "Reserved" | "Sold",
    actorUserId: user.id,
    contextLabel: lotLabel,
    lotId,
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, updatedCount: updatedSlabIds.length };
}
