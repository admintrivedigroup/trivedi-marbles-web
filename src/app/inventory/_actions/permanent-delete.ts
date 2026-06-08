"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { cleanupCloudinaryImages } from "@/app/inventory/_actions/slab-images";
import { logAudit } from "@/app/inventory/_lib/audit";

export type PermanentDeleteResult = { error: string | null };

export async function permanentDeleteSlab(slabId: string): Promise<PermanentDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { error: "Please sign in again." };

  const { data: slab } = await supabase
    .from("slabs")
    .select("slab_code, lot_id")
    .eq("id", slabId)
    .single();

  const { data: images } = await supabase
    .from("slab_images")
    .select("public_id")
    .eq("slab_id", slabId);

  await supabase.from("transfer_request_items").delete().eq("slab_id", slabId);
  await supabase.from("slab_movements").delete().eq("slab_id", slabId);
  await supabase.from("slab_images").delete().eq("slab_id", slabId);

  const { error } = await supabase.from("slabs").delete().eq("id", slabId);
  if (error) return { error: `Unable to delete slab. ${error.message}` };

  const publicIds = (images ?? [])
    .map((img) => img.public_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (publicIds.length > 0) cleanupCloudinaryImages(publicIds).catch(() => {});

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "slab.permanently_deleted",
    targetType: "slab",
    targetId: slabId,
    targetLabel: typeof slab?.slab_code === "string" ? slab.slab_code : slabId,
  }).catch(() => {});

  revalidatePath("/inventory/archive");
  return { error: null };
}

export async function permanentDeleteLot(lotId: string): Promise<PermanentDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { error: "Please sign in again." };

  const { data: lot } = await supabase
    .from("marble_lots")
    .select("lot_number")
    .eq("id", lotId)
    .single();

  const { data: slabs } = await supabase
    .from("slabs")
    .select("id")
    .eq("lot_id", lotId);

  const slabIds = (slabs ?? []).map((s) => String(s.id));

  let publicIds: string[] = [];
  if (slabIds.length > 0) {
    const { data: images } = await supabase
      .from("slab_images")
      .select("public_id")
      .in("slab_id", slabIds);

    publicIds = (images ?? [])
      .map((img) => img.public_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    await supabase.from("transfer_request_items").delete().in("slab_id", slabIds);
    await supabase.from("slab_movements").delete().in("slab_id", slabIds);
    await supabase.from("slab_images").delete().in("slab_id", slabIds);
    await supabase.from("slabs").delete().eq("lot_id", lotId);
  }

  const { error } = await supabase.from("marble_lots").delete().eq("id", lotId);
  if (error) return { error: `Unable to delete lot. ${error.message}` };

  if (publicIds.length > 0) cleanupCloudinaryImages(publicIds).catch(() => {});

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "lot.permanently_deleted",
    targetType: "lot",
    targetId: lotId,
    targetLabel: typeof lot?.lot_number === "string" ? lot.lot_number : lotId,
  }).catch(() => {});

  revalidatePath("/inventory/archive");
  return { error: null };
}
