"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import type { ReservationData } from "@/app/inventory/_actions/update-slab-status";

export type BatchUpdateSlabsResult = {
  error: string | null;
  updatedCount: number;
};

export async function batchUpdateSlabsStatus(
  slabIds: string[],
  statusName: "Reserved" | "Sold" | "Available",
  lotId: string,
  reservationData?: ReservationData | null,
): Promise<BatchUpdateSlabsResult> {
  if (slabIds.length === 0) return { error: null, updatedCount: 0 };

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

  const updatePayload: Record<string, unknown> = { status_id: statusData.id };

  if (statusName === SLAB_STATUS.RESERVED && reservationData) {
    updatePayload.reserved_for = reservationData.reservedFor;
    updatePayload.reserved_until = reservationData.reservedUntil;
  } else if (statusName === SLAB_STATUS.AVAILABLE || statusName === SLAB_STATUS.SOLD) {
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
    action: "slab.batch_status_changed",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotId,
    diff: {
      after: statusName,
      slabCount: slabIds.length,
      ...(statusName === SLAB_STATUS.RESERVED && reservationData
        ? { reservedFor: reservationData.reservedFor, reservedUntil: reservationData.reservedUntil }
        : {}),
    },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, updatedCount: slabIds.length };
}
