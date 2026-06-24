"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

type SimpleResult = { success: true } | { success: false; error: string };

// ─── Entry upsert ─────────────────────────────────────────────────────────────

export async function upsertKraEntry(
  columnId: string,
  employeeId: string,
  financialYear: string,
  fiscalMonth: number,
  points: number,
  reversePoints: number | null,
): Promise<SimpleResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("kra_entries").upsert(
    {
      column_id: columnId,
      employee_id: employeeId,
      financial_year: financialYear,
      fiscal_month: fiscalMonth,
      points,
      reverse_points: reversePoints,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "column_id,financial_year,fiscal_month" },
  );
  if (error) return { success: false, error: error.message };
  revalidatePath("/inventory/kra");
  return { success: true };
}

// ─── Column CRUD ──────────────────────────────────────────────────────────────

export type KraColumnFormData = {
  label: string;
  weightage: number;
  target: string;
  source: string;
  frequency: string;
  approval_required: boolean;
  active: boolean;
};

export async function createKraColumn(
  employeeId: string,
  data: KraColumnFormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = createAdminClient();

  const { data: top } = await supabase
    .from("kra_columns")
    .select("display_order")
    .eq("employee_id", employeeId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((top?.display_order as number | null) ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("kra_columns")
    .insert([{ ...data, employee_id: employeeId, display_order: nextOrder }])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/inventory/kra");
  return { success: true, id: row.id as string };
}

export async function updateKraColumn(
  id: string,
  data: KraColumnFormData,
): Promise<SimpleResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("kra_columns")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/inventory/kra");
  return { success: true };
}

export async function deleteKraColumn(id: string): Promise<SimpleResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("kra_columns").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/inventory/kra");
  return { success: true };
}

export async function moveKraColumn(
  id: string,
  direction: "up" | "down",
  employeeId: string,
): Promise<SimpleResult> {
  const supabase = createAdminClient();

  const { data: cols, error: fetchErr } = await supabase
    .from("kra_columns")
    .select("id, display_order")
    .eq("employee_id", employeeId)
    .order("display_order", { ascending: true });

  if (fetchErr || !cols) return { success: false, error: fetchErr?.message ?? "Fetch failed" };

  const idx = cols.findIndex((c) => c.id === id);
  if (idx === -1) return { success: false, error: "Column not found" };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= cols.length) return { success: true }; // already at edge

  const cur = cols[idx];
  const swp = cols[swapIdx];
  const now = new Date().toISOString();

  const [r1, r2] = await Promise.all([
    supabase.from("kra_columns").update({ display_order: swp.display_order, updated_at: now }).eq("id", cur.id),
    supabase.from("kra_columns").update({ display_order: cur.display_order, updated_at: now }).eq("id", swp.id),
  ]);

  if (r1.error) return { success: false, error: r1.error.message };
  if (r2.error) return { success: false, error: r2.error.message };

  revalidatePath("/inventory/kra");
  return { success: true };
}
