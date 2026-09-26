export type SortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "sqft_desc" | "sqft_asc";

// Columns that live on the slabs table itself, so the database can order by them.
// The marble name lives on marble_lots (it was dropped from slabs), so name sorts
// fetch newest-first and are ordered in memory afterwards.
export const DB_SORT: Record<SortBy, { column: "created_at" | "sqft"; ascending: boolean }> = {
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  name_asc: { column: "created_at", ascending: false },
  name_desc: { column: "created_at", ascending: false },
  sqft_desc: { column: "sqft", ascending: false },
  sqft_asc: { column: "sqft", ascending: true },
};

export function sortsByName(sortBy: SortBy): boolean {
  return sortBy === "name_asc" || sortBy === "name_desc";
}

/** Orders by marble name (case-insensitive, unnamed last), keeping the incoming
 * order for ties so the newest-first fetch order still breaks them. */
export function sortByMarbleName<T extends { marbleName: string | null }>(
  slabs: T[],
  direction: "asc" | "desc",
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return slabs
    .map((slab, index) => ({ slab, index }))
    .sort((a, b) => {
      const an = a.slab.marbleName;
      const bn = b.slab.marbleName;
      if (an === null && bn === null) return a.index - b.index;
      if (an === null) return 1;
      if (bn === null) return -1;
      const cmp = an.localeCompare(bn, undefined, { sensitivity: "base" });
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map(({ slab }) => slab);
}
