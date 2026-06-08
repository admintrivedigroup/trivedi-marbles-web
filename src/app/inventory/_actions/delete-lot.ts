"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type DeleteLotResult = {
  error: string | null;
};

export async function deleteLot(lotId: string): Promise<DeleteLotResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before deleting." };
  }

  const { data: lotData } = await supabase
    .from("marble_lots")
    .select("lot_number, marble_name")
    .eq("id", lotId)
    .single();

  const { data: slabs } = await supabase
    .from("slabs")
    .select("id")
    .eq("lot_id", lotId);

  const slabIds = (slabs ?? []).map((s) => String(s.id));
  const now = new Date().toISOString();

  if (slabIds.length > 0) {
    await supabase.from("slabs").update({ deleted_at: now }).eq("lot_id", lotId);
  }

  const { error: lotError } = await supabase
    .from("marble_lots")
    .update({ deleted_at: now })
    .eq("id", lotId);

  if (lotError) {
    return { error: `Unable to archive lot. ${lotError.message}` };
  }

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.archived",
    targetType: "lot",
    targetId: lotId,
    targetLabel: lotData?.lot_number ?? lotId,
    diff: {
      marbleName: lotData?.marble_name ?? null,
      slabCount: slabIds.length,
    },
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");

  return { error: null };
}
