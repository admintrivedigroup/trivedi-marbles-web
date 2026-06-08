import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LookupOptions, StockLookupOption } from "@/app/inventory/_lib/stock";

type LookupTableName =
  | "marble_categories"
  | "slab_statuses"
  | "thickness_options"
  | "warehouses";

async function getActiveOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tableName: LookupTableName,
): Promise<StockLookupOption[]> {
  const { data } = await supabase
    .from(tableName)
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.name);
}

export async function getLookupOptions(): Promise<LookupOptions> {
  const supabase = await createClient();

  const [categories, statuses, thicknesses, warehouses] = await Promise.all([
    getActiveOptions(supabase, "marble_categories"),
    getActiveOptions(supabase, "slab_statuses"),
    getActiveOptions(supabase, "thickness_options"),
    getActiveOptions(supabase, "warehouses"),
  ]);

  return { categories, statuses, thicknesses, warehouses };
}
