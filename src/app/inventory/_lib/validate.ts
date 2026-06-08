import "server-only";

// Shared server-side input validation helpers for numeric form fields.

export function parseRequiredPositiveNumber(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { error: `${label} is required.`, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0)
    return { error: `${label} must be greater than 0.`, value: null };
  return { error: null, value: n };
}

export function parseOptionalNonNegativeNumber(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { error: null, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0)
    return { error: `${label} must be 0 or greater.`, value: null };
  return { error: null, value: n };
}
