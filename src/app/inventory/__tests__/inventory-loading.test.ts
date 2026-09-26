import { describe, expect, it } from "vitest";

import { fetchAllPages } from "@/app/inventory/_lib/fetch-all";
import { DB_SORT, sortByMarbleName, sortsByName } from "@/app/inventory/_lib/slab-sort";

// A fake table of n rows served through inclusive ranges, like PostgREST's .range(from, to).
function serve(total: number, pageCap = Infinity) {
  const calls: [number, number][] = [];
  const fetchRange = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to, from + pageCap - 1, total - 1);
    const data = from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i);
    return { data, error: null };
  };
  return { fetchRange, calls };
}

describe("fetchAllPages", () => {
  it("returns every row across several pages (the old single call stopped at the server cap)", async () => {
    const { fetchRange, calls } = serve(2500);
    const result = await fetchAllPages(fetchRange, { maxRows: 20000, pageSize: 1000 });
    expect(result.rows).toHaveLength(2500);
    expect(result.rows[0]).toBe(0);
    expect(result.rows[2499]).toBe(2499);
    expect(result.truncated).toBe(false);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("handles an empty table", async () => {
    const result = await fetchAllPages(serve(0).fetchRange, { maxRows: 100, pageSize: 10 });
    expect(result).toEqual({ rows: [], error: null, truncated: false });
  });

  it("stops without an extra request when the last page is short", async () => {
    const { fetchRange, calls } = serve(15);
    await fetchAllPages(fetchRange, { maxRows: 100, pageSize: 10 });
    expect(calls).toHaveLength(2);
  });

  it("flags truncation instead of silently dropping rows at the cap", async () => {
    const result = await fetchAllPages(serve(500).fetchRange, { maxRows: 200, pageSize: 100 });
    expect(result.rows).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });

  it("never requests beyond maxRows when it isn't a multiple of the page size", async () => {
    const { fetchRange, calls } = serve(500);
    const result = await fetchAllPages(fetchRange, { maxRows: 250, pageSize: 100 });
    expect(result.rows).toHaveLength(250);
    expect(calls[calls.length - 1]).toEqual([200, 249]);
  });

  it("propagates an error and discards partial rows", async () => {
    let n = 0;
    const result = await fetchAllPages(
      async () => (++n === 2 ? { data: null, error: { message: "boom" } } : { data: [1, 2], error: null }),
      { maxRows: 100, pageSize: 2 },
    );
    expect(result).toEqual({ rows: [], error: "boom", truncated: false });
  });
});

describe("name sorting", () => {
  const slab = (marbleName: string | null, id: number) => ({ marbleName, id });

  it("sorts A→Z ignoring case", () => {
    const out = sortByMarbleName([slab("bianco", 1), slab("Amba", 2), slab("Carrara", 3)], "asc");
    expect(out.map((s) => s.marbleName)).toEqual(["Amba", "bianco", "Carrara"]);
  });

  it("sorts Z→A", () => {
    const out = sortByMarbleName([slab("bianco", 1), slab("Amba", 2), slab("Carrara", 3)], "desc");
    expect(out.map((s) => s.marbleName)).toEqual(["Carrara", "bianco", "Amba"]);
  });

  it("keeps unnamed slabs last in both directions", () => {
    const input = [slab(null, 1), slab("B", 2), slab("A", 3)];
    expect(sortByMarbleName(input, "asc").map((s) => s.id)).toEqual([3, 2, 1]);
    expect(sortByMarbleName(input, "desc").map((s) => s.id)).toEqual([2, 3, 1]);
  });

  it("keeps the incoming (newest-first) order for equal names", () => {
    const out = sortByMarbleName([slab("A", 1), slab("A", 2), slab("A", 3)], "asc");
    expect(out.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("does not mutate its input", () => {
    const input = [slab("B", 1), slab("A", 2)];
    sortByMarbleName(input, "asc");
    expect(input.map((s) => s.id)).toEqual([1, 2]);
  });
});

describe("DB sort mapping", () => {
  it("never orders by marble_name in the database (that column no longer exists on slabs)", () => {
    for (const sort of Object.values(DB_SORT)) {
      expect(["created_at", "sqft"]).toContain(sort.column);
    }
  });
  it("flags only the name sorts as in-memory", () => {
    expect(sortsByName("name_asc")).toBe(true);
    expect(sortsByName("name_desc")).toBe(true);
    expect(sortsByName("newest")).toBe(false);
    expect(sortsByName("sqft_desc")).toBe(false);
  });
});
