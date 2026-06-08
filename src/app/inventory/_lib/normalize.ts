import "server-only";

// Shared row-normalization helpers for server-side lib functions that read
// raw Supabase rows and produce clean typed output.

export function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function relName(value: unknown): string | null {
  if (Array.isArray(value)) {
    return toStr((value[0] as Record<string, unknown> | undefined)?.name);
  }
  if (value && typeof value === "object") {
    return toStr((value as Record<string, unknown>).name);
  }
  return null;
}

export function relLotNumber(value: unknown): string | null {
  if (Array.isArray(value)) {
    return toStr((value[0] as Record<string, unknown> | undefined)?.lot_number);
  }
  if (value && typeof value === "object") {
    return toStr((value as Record<string, unknown>).lot_number);
  }
  return null;
}
