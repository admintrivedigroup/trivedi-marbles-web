import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { KraColumn, KraEntry } from "@/app/inventory/_lib/kra-shared";

export type { KraColumn, KraEntry };
export { FISCAL_MONTHS, getFinancialYears } from "@/app/inventory/_lib/kra-shared";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getKraColumns(employeeId: string): Promise<KraColumn[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("kra_columns")
    .select("*")
    .eq("employee_id", employeeId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as KraColumn[];
}

export async function getKraEntries(
  employeeId: string,
  financialYear: string,
): Promise<KraEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("kra_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("financial_year", financialYear);
  if (error) throw new Error(error.message);
  return (data ?? []) as KraEntry[];
}
