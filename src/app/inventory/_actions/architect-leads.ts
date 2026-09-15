"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import type { ArchitectLead } from "@/app/inventory/_lib/architect-leads";

export type ArchitectLeadFormData = Omit<ArchitectLead, "id" | "created_at" | "updated_at">;

export type ArchitectLeadActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createArchitectLead(
  data: ArchitectLeadFormData,
): Promise<ArchitectLeadActionResult> {
  const auth = await requirePermission("client_leads");
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("architect_leads")
    .insert([sanitize(data)])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads/architect");
  return { success: true, id: row.id as string };
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateArchitectLead(
  id: string,
  data: ArchitectLeadFormData,
): Promise<ArchitectLeadActionResult> {
  const auth = await requirePermission("client_leads");
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("architect_leads")
    .update(sanitize(data))
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads/architect");
  return { success: true, id };
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function deleteArchitectLead(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await requirePermission("client_leads");
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase.from("architect_leads").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads/architect");
  return { success: true };
}

// ─── Bulk delete ──────────────────────────────────────────────────────────────
export async function bulkDeleteArchitectLeads(
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  if (ids.length === 0) return { success: true };

  const auth = await requirePermission("client_leads");
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase.from("architect_leads").delete().in("id", ids);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads/architect");
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nullIfEmpty(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

function sanitize(data: ArchitectLeadFormData) {
  return {
    architect_name: (data.architect_name ?? "").trim(),
    architect_number: nullIfEmpty(data.architect_number),
    contractor_name: nullIfEmpty(data.contractor_name),
    contractor_number: nullIfEmpty(data.contractor_number),
    project_type: nullIfEmpty(data.project_type),
    facade: nullIfEmpty(data.facade),
    bedroom: nullIfEmpty(data.bedroom),
    interior_wall_cladding: nullIfEmpty(data.interior_wall_cladding),
    main_flooring: nullIfEmpty(data.main_flooring),
    kitchen_flooring: nullIfEmpty(data.kitchen_flooring),
    kitchen_platform: nullIfEmpty(data.kitchen_platform),
    store_room: nullIfEmpty(data.store_room),
    table_tops: nullIfEmpty(data.table_tops),
    staircase: nullIfEmpty(data.staircase),
    pillars: nullIfEmpty(data.pillars),
    bathroom: nullIfEmpty(data.bathroom),
    car_parking_outside: nullIfEmpty(data.car_parking_outside),
    window_sill: nullIfEmpty(data.window_sill),
    home_temple: nullIfEmpty(data.home_temple),
    preference: nullIfEmpty(data.preference),
    source_of_lead: nullIfEmpty(data.source_of_lead),
    payment: nullIfEmpty(data.payment),
    notes: nullIfEmpty(data.notes),
    quarry_mark: nullIfEmpty(data.quarry_mark),
  };
}
