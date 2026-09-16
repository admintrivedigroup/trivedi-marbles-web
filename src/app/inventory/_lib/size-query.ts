// No "server-only" here — parsed both on the server (page.tsx) and on the
// client (advanced-slab-search.tsx, for inline validation feedback).

export type ParsedSize = { length: number; width: number };

/** Parses a size query like "10x15", "10*15", "10 X 15.5" (feet) into a length/width pair. */
export function parseSizeQuery(input: string): ParsedSize | null {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;

  const length = Number(match[1]);
  const width = Number(match[2]);
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0) {
    return null;
  }

  return { length, width };
}
