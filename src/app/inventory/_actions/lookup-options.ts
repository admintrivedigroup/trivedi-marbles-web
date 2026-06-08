"use server";

import { revalidatePath } from "next/cache";

import type { StockLookupOption } from "@/app/inventory/_lib/stock";
import { createClient } from "@/lib/supabase/server";

export type LookupTableName =
  | "marble_categories"
  | "slab_statuses"
  | "thickness_options"
  | "warehouses";

export type AddLookupOptionResult = {
  error: string | null;
  option: StockLookupOption | null;
};

export async function addLookupOption(
  tableName: LookupTableName,
  name: string,
): Promise<AddLookupOptionResult> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { error: "Name is required.", option: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from(tableName)
    .insert({ name: trimmedName, is_active: true })
    .select("id, name")
    .single();

  if (error) {
    return { error: `Unable to save. ${error.message}`, option: null };
  }

  revalidatePath("/inventory", "layout");

  return {
    error: null,
    option: { id: String(data.id), name: String(data.name) },
  };
}

export async function deleteLookupOption(
  tableName: LookupTableName,
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const numericId = /^-?\d+$/.test(id) ? Number(id) : id;

  const { error } = await supabase
    .from(tableName)
    .update({ is_active: false })
    .eq("id", numericId);

  if (error) {
    return { error: `Unable to remove. ${error.message}` };
  }

  revalidatePath("/inventory", "layout");
  return { error: null };
}
