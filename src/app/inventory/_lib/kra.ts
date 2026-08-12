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

// Active "task category" columns across every employee — used to populate the
// KRA Category picker on the task form, filtered client-side by assignee.
export type TaskCategoryOption = { id: string; employee_id: string; label: string; weightage: number };

export async function getTaskCategoryColumns(): Promise<TaskCategoryOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("kra_columns")
    .select("id, employee_id, label, weightage")
    .eq("calc_type", "tasks")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskCategoryOption[];
}

// ─── Task-driven scoring ────────────────────────────────────────────────────

// Fiscal month (1=Apr…12=Mar) -> calendar [start, end) for a "YYYY-YY" financial year.
function fiscalMonthRange(financialYear: string, fiscalMonth: number): { start: Date; end: Date } {
  const startYear = parseInt(financialYear.split("-")[0]);
  const calendarMonth = fiscalMonth <= 9 ? fiscalMonth + 3 : fiscalMonth - 9; // 1-12
  const calendarYear = fiscalMonth <= 9 ? startYear : startYear + 1;
  const start = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
  const end = new Date(Date.UTC(calendarYear, calendarMonth, 1));
  return { start, end };
}

export type TaskCategoryScore = { points: number; reversePoints: number };

// Points = % of a task-category column's tasks (due in a given fiscal month) that
// are completed. Reverse Points is the complement (% incomplete). Tasks not yet
// past their due date and still open are excluded — they haven't been "decided" yet.
//
// Computed live from `tasks` on every read (no cached/stored snapshot, no manual
// sync step) so the KRA page always reflects current task state — including a
// task quietly going overdue with no one touching it.
//
// Keyed by "<columnId>-<fiscalMonth>"; a missing key means no decided tasks yet.
export async function getComputedTaskScores(
  employeeId: string,
  financialYear: string,
): Promise<Record<string, TaskCategoryScore>> {
  const supabase = createAdminClient();

  const { data: columns, error: colErr } = await supabase
    .from("kra_columns")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("calc_type", "tasks");
  if (colErr) throw new Error(colErr.message);

  const columnIds = (columns ?? []).map((c) => c.id as string);
  if (columnIds.length === 0) return {};

  const yearStart = fiscalMonthRange(financialYear, 1).start;
  const yearEnd = fiscalMonthRange(financialYear, 12).end;

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("kra_column_id, status, due_date")
    .in("kra_column_id", columnIds)
    .gte("due_date", yearStart.toISOString())
    .lt("due_date", yearEnd.toISOString());
  if (taskErr) throw new Error(taskErr.message);

  const now = Date.now();
  const buckets = new Map<string, { total: number; completed: number }>();

  for (const t of tasks ?? []) {
    const decided = t.status === "completed" || new Date(t.due_date as string).getTime() < now;
    if (!decided) continue;

    const due = new Date(t.due_date as string);
    const calendarMonth = due.getUTCMonth() + 1;
    const fiscalMonth = calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;

    const key = `${t.kra_column_id}-${fiscalMonth}`;
    const bucket = buckets.get(key) ?? { total: 0, completed: 0 };
    bucket.total += 1;
    if (t.status === "completed") bucket.completed += 1;
    buckets.set(key, bucket);
  }

  const result: Record<string, TaskCategoryScore> = {};
  for (const [key, b] of buckets) {
    const points = Math.round((b.completed / b.total) * 100);
    result[key] = { points, reversePoints: 100 - points };
  }
  return result;
}
