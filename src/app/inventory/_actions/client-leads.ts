"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientLead } from "@/app/inventory/_lib/client-leads";

export type ClientLeadFormData = Omit<ClientLead, "id" | "created_at" | "updated_at">;

export type ClientLeadActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createClientLead(
  data: ClientLeadFormData,
): Promise<ClientLeadActionResult> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("client_leads")
    .insert([sanitize(data)])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads");
  return { success: true, id: row.id as string };
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateClientLead(
  id: string,
  data: ClientLeadFormData,
): Promise<ClientLeadActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("client_leads")
    .update(sanitize(data))
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads");
  return { success: true, id };
}

// ─── Toggle converted ────────────────────────────────────────────────────────
export async function toggleLeadConverted(
  id: string,
  converted: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("client_leads")
    .update({ converted })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads");
  return { success: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function deleteClientLead(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("client_leads").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/leads");
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nullIfEmpty(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

function sanitize(data: ClientLeadFormData) {
  return {
    client_name: (data.client_name ?? "").trim(),
    contact_no: nullIfEmpty(data.contact_no),
    requirement_sqft: nullIfEmpty(data.requirement_sqft),
    material_category: nullIfEmpty(data.material_category),
    converted: Boolean(data.converted),
    first_visit_date: nullIfEmpty(data.first_visit_date),
    architect_name: nullIfEmpty(data.architect_name),
    architect_contact: nullIfEmpty(data.architect_contact),
    contractor_name: nullIfEmpty(data.contractor_name),
    contractor_contact: nullIfEmpty(data.contractor_contact),
    project_type: nullIfEmpty(data.project_type),
    facade: nullIfEmpty(data.facade),
    bedroom: nullIfEmpty(data.bedroom),
    interior_wall_cladding: nullIfEmpty(data.interior_wall_cladding),
    main_flooring: nullIfEmpty(data.main_flooring),
    kitchen_flooring: nullIfEmpty(data.kitchen_flooring),
    store_room: nullIfEmpty(data.store_room),
    bathroom: nullIfEmpty(data.bathroom),
    car_parking_outside: nullIfEmpty(data.car_parking_outside),
    window_sill: nullIfEmpty(data.window_sill),
    home_temple: nullIfEmpty(data.home_temple),
    preference: nullIfEmpty(data.preference),
    paid_from: nullIfEmpty(data.paid_from),
    source_of_lead: nullIfEmpty(data.source_of_lead),
    notes: nullIfEmpty(data.notes),
  };
}
