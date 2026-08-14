"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/app/inventory/_lib/action-auth";

export type ToggleLotWebsiteResult = {
  error: string | null;
  showOnWebsite?: boolean;
};

export async function toggleLotWebsite(
  lotId: string,
  currentValue: boolean,
): Promise<ToggleLotWebsiteResult> {
  const auth = await requirePermission("edit_stock");
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Please sign in again before saving." };
  }

  const newValue = !currentValue;

  const { error } = await supabase
    .from("marble_lots")
    .update({ show_on_website: newValue })
    .eq("id", lotId);

  if (error) {
    return { error: `Unable to update. ${error.message}` };
  }

  revalidatePath(`/inventory/lot/${lotId}`);
  revalidatePath("/collection");

  return { error: null, showOnWebsite: newValue };
}
