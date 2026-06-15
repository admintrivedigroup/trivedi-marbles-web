"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type BatchDeleteLotsResult = {
  error: string | null;
  deletedCount: number;
};

export async function batchDeleteLots(
  lotIds: string[],
): Promise<BatchDeleteLotsResult> {
  if (lotIds.length === 0) return { error: null, deletedCount: 0 };

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before deleting.", deletedCount: 0 };
  }

  const now = new Date().toISOString();

  // Soft-delete all slabs belonging to these lots
  await supabase.from("slabs").update({ deleted_at: now }).in("lot_id", lotIds);

  const { error: lotError } = await supabase
    .from("marble_lots")
    .update({ deleted_at: now })
    .in("id", lotIds);

  if (lotError) {
    return { error: `Unable to delete lots. ${lotError.message}`, deletedCount: 0 };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.batch_archived",
    targetType: "lot",
    targetId: lotIds[0],
    targetLabel: `${lotIds.length} lots`,
    diff: { lotCount: lotIds.length },
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, deletedCount: lotIds.length };
}
