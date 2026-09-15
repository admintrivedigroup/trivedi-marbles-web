import { createClient } from "@/lib/supabase/server";

export type ArchitectLead = {
  id: string;
  architect_name: string;
  architect_number: string | null;
  contractor_name: string | null;
  contractor_number: string | null;
  project_type: string | null;
  facade: string | null;
  bedroom: string | null;
  interior_wall_cladding: string | null;
  main_flooring: string | null;
  kitchen_flooring: string | null;
  kitchen_platform: string | null;
  store_room: string | null;
  table_tops: string | null;
  staircase: string | null;
  pillars: string | null;
  bathroom: string | null;
  car_parking_outside: string | null;
  window_sill: string | null;
  home_temple: string | null;
  preference: string | null;
  source_of_lead: string | null;
  payment: string | null;
  notes: string | null;
  quarry_mark: string | null;
  created_at: string;
  updated_at: string;
};

export async function getArchitectLeads(): Promise<ArchitectLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("architect_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ArchitectLead[];
}
