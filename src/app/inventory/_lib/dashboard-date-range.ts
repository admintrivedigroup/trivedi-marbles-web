export type DashboardDatePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year";

export const DASHBOARD_DATE_PRESETS: { value: DashboardDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveDashboardDateRange(
  preset?: string | null,
  from?: string | null,
  to?: string | null,
): { from: Date; to: Date } | null {
  const now = new Date();

  if (preset) {
    switch (preset as DashboardDatePreset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "this_week": {
        const dayIdx = (now.getDay() + 6) % 7; // 0 = Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayIdx);
        return { from: startOfDay(monday), to: endOfDay(now) };
      }
      case "this_month":
        return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
      case "last_month": {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: startOfDay(first), to: endOfDay(last) };
      }
      case "this_year":
        return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
      case "last_year":
        return {
          from: startOfDay(new Date(now.getFullYear() - 1, 0, 1)),
          to: endOfDay(new Date(now.getFullYear() - 1, 11, 31)),
        };
    }
  }

  if (from || to) {
    const f = from ? startOfDay(new Date(from)) : startOfDay(new Date(0));
    const t = to ? endOfDay(new Date(to)) : endOfDay(now);
    if (!isNaN(f.getTime()) && !isNaN(t.getTime())) {
      return { from: f, to: t };
    }
  }

  return null;
}

export function formatDashboardDateRangeLabel(range: { from: Date; to: Date } | null): string | null {
  if (!range) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}
