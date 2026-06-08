"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type RestoreLotResult = {
  error: string | null;
};

export async function restoreLot(lotId: string): Promise<RestoreLotResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again." };
  }

  const { data: lot } = await supabase
    .from("marble_lots")
    .select("lot_number")
    .eq("id", lotId)
    .single();

  // Restore the lot and all its archived slabs together
  const [{ error: lotError }, { error: slabError }] = await Promise.all([
    supabase.from("marble_lots").update({ deleted_at: null }).eq("id", lotId),
    supabase.from("slabs").update({ deleted_at: null }).eq("lot_id", lotId).not("deleted_at", "is", null),
  ]);

  if (lotError) return { error: `Unable to restore lot. ${lotError.message}` };
  if (slabError) return { error: `Unable to restore lot slabs. ${slabError.message}` };

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.restored",
    targetType: "lot",
    targetId: lotId,
    targetLabel: typeof lot?.lot_number === "string" ? lot.lot_number : lotId,
  }).catch(() => {});

  revalidatePath("/inventory/list");
  revalidatePath("/inventory/archive");
  revalidatePath(`/inventory/lot/${lotId}`);

  return { error: null };
}
