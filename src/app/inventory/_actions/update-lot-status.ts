"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
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
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before updating status.", updatedCount: 0 };
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
    .select("id")
    .eq("lot_id", lotId)
    .in("status_id", eligibleStatusIds);

  if (slabFetchError) {
    return { error: `Unable to load slabs. ${slabFetchError.message}`, updatedCount: 0 };
  }

  if (!slabRows || slabRows.length === 0) {
    return { error: config.emptyError, updatedCount: 0 };
  }

  const slabIds = slabRows.map((s: { id: unknown }) => s.id);

  const updatePayload: Record<string, unknown> = { status_id: targetStatusId };
  if (action === "Reserved" && reservationData) {
    updatePayload.reserved_for = reservationData.reservedFor;
    updatePayload.reserved_until = reservationData.reservedUntil;
  } else if (action === "Sold" || action === "UnreserveLot" || action === "UnsellLot") {
    updatePayload.reserved_for = null;
    updatePayload.reserved_until = null;
  }

  const { error: updateError } = await supabase
    .from("slabs")
    .update(updatePayload)
    .in("id", slabIds);

  if (updateError) {
    return { error: `Unable to update slabs. ${updateError.message}`, updatedCount: 0 };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.bulk_status_changed",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotId,
    diff: {
      action,
      after: config.targetStatus,
      slabCount: slabIds.length,
      ...(action === "Reserved" && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, updatedCount: slabIds.length };
}
