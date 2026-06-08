import { createClient } from "@/lib/supabase/server";

export type ClientLead = {
  id: string;
  client_name: string;
  contact_no: string | null;
  requirement_sqft: string | null;
  material_category: string | null;
  converted: boolean;
  first_visit_date: string | null;
  architect_name: string | null;
  architect_contact: string | null;
  contractor_name: string | null;
  contractor_contact: string | null;
  project_type: string | null;
  facade: string | null;
  bedroom: string | null;
  interior_wall_cladding: string | null;
  main_flooring: string | null;
  kitchen_flooring: string | null;
  store_room: string | null;
  bathroom: string | null;
  car_parking_outside: string | null;
  window_sill: string | null;
  home_temple: string | null;
  preference: string | null;
  paid_from: string | null;
  source_of_lead: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getClientLeads(): Promise<ClientLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientLead[];
}
