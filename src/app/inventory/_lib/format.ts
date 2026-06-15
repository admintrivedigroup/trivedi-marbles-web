// Shared formatting utilities — no "server-only", safe for both server and client components.

export function formatNumber(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("en-IN");
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * Returns null when value is absent (callers that need a fallback string use ?? "-").
 * Timezone-aware: always formats in Asia/Kolkata.
 */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(({ type, value: v }) => [type, v]));
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(({ type, value: v }) => [type, v]));
  return `${p.day} ${p.month} ${p.year} at ${p.hour}:${p.minute} ${p.dayPeriod ?? ""}`.trim();
}

/** Returns null when value is absent — callers use ?? "-" if they need a display string. */
export function formatThickness(value: string | null): string | null {
  if (!value) return null;
  return /^\d+(\.\d+)?$/.test(value) ? `${value}mm` : value;
}

/** Returns null when either dimension is absent — callers conditionally render. */
export function formatSize(length: number | null, width: number | null): string | null {
  if (!length || !width) return null;
  return `${formatNumber(length)}' × ${formatNumber(width)}'`;
}

export function getStatusColor(status: string | null): string {
  switch (status) {
    case "Available":  return "bg-green-100 text-green-700";
    case "Reserved":   return "bg-orange-100 text-orange-700";
    case "Sold":       return "bg-gray-100 text-gray-600";
    case "In Transit": return "bg-blue-100 text-blue-700";
    default:           return "bg-gray-100 text-gray-600";
  }
}

/** Returns a human-readable relative time string, e.g. "3 days ago". */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return "1 year ago";
  return `${diffYears} years ago`;
}

/** Badge style with border — used in public-facing slab/lot views. */
export function getStatusBadgeStyle(status: string | null): string {
  switch (status) {
    case "Available": return "bg-green-100 text-green-700 border-green-200";
    case "Reserved":  return "bg-orange-100 text-orange-700 border-orange-200";
    default:          return "bg-gray-100 text-gray-500 border-gray-200";
  }
}
