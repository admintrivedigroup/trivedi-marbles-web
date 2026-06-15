"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type BatchDeleteSlabsResult = {
  error: string | null;
  deletedCount: number;
};

export async function batchDeleteSlabs(
  slabIds: string[],
  lotId: string,
): Promise<BatchDeleteSlabsResult> {
  if (slabIds.length === 0) return { error: null, deletedCount: 0 };

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before deleting.", deletedCount: 0 };
  }

  const { error: deleteError } = await supabase
    .from("slabs")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", slabIds);

  if (deleteError) {
    return { error: `Unable to delete slabs. ${deleteError.message}`, deletedCount: 0 };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.batch_archived",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotId,
    diff: { slabCount: slabIds.length },
  }).catch(() => {});

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null, deletedCount: slabIds.length };
}
