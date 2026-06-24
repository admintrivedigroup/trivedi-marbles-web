// Shared types and constants — safe to import in both server and client components.

export type KraColumn = {
  id: string;
  employee_id: string;
  label: string;
  weightage: number;
  target: string;
  source: string;
  frequency: string;
  approval_required: boolean;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type KraEntry = {
  id: string;
  column_id: string;
  employee_id: string;
  financial_year: string;
  fiscal_month: number; // 1=Apr … 12=Mar
  reverse_points: number | null;
  points: number;
  created_at: string;
  updated_at: string;
};

export const FISCAL_MONTHS = [
  { num: 1,  label: "Apr" },
  { num: 2,  label: "May" },
  { num: 3,  label: "Jun" },
  { num: 4,  label: "Jul" },
  { num: 5,  label: "Aug" },
  { num: 6,  label: "Sep" },
  { num: 7,  label: "Oct" },
  { num: 8,  label: "Nov" },
  { num: 9,  label: "Dec" },
  { num: 10, label: "Jan" },
  { num: 11, label: "Feb" },
  { num: 12, label: "Mar" },
] as const;

// Returns 3 fiscal years: previous, current, next.
export function getFinancialYears(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed; April = 3
  const fy = m >= 3 ? y : y - 1;
  return [
    `${fy - 1}-${String(fy).slice(2)}`,
    `${fy}-${String(fy + 1).slice(2)}`,
    `${fy + 1}-${String(fy + 2).slice(2)}`,
  ];
}
