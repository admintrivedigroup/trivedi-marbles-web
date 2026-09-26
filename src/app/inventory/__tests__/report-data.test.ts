import { describe, expect, it } from "vitest";

import { toCsv } from "@/app/inventory/_lib/csv";
import { buildReportData, type ReportSlab } from "@/app/inventory/_lib/report-data";

const NOW = new Date("2026-09-21T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function slab(overrides: Partial<ReportSlab>): ReportSlab {
  return {
    categoryName: "Marble",
    createdAt: daysAgo(5),
    marbleName: "Carrara",
    sellingPrice: 100,
    sqft: 10,
    statusName: "Available",
    warehouseName: "Ambaji",
    ...overrides,
  };
}

describe("buildReportData", () => {
  it("values Available + Reserved stock at sqft × price and excludes Sold", () => {
    const data = buildReportData(
      [
        slab({ sqft: 10, sellingPrice: 100 }), // 1000
        slab({ sqft: 20, sellingPrice: 50, statusName: "Reserved" }), // 1000
        slab({ sqft: 99, sellingPrice: 999, statusName: "Sold" }), // not stock
      ],
      NOW,
    );
    expect(data.totals).toMatchObject({ stockValue: 2000, stockSqft: 30, stockSlabs: 2, soldSlabs: 1, soldSqft: 99 });
  });

  it("counts unpriced or unsized in-stock slabs separately instead of valuing them at zero silently", () => {
    const data = buildReportData(
      [slab({}), slab({ sellingPrice: null }), slab({ sqft: null })],
      NOW,
    );
    expect(data.totals.unpricedSlabs).toBe(2);
    expect(data.totals.stockValue).toBe(1000);
    expect(data.totals.stockSlabs).toBe(3);
  });

  it("breaks value down by category, biggest first, with a bucket for uncategorised", () => {
    const data = buildReportData(
      [
        slab({ categoryName: "Marble", sqft: 10, sellingPrice: 100 }),
        slab({ categoryName: "Granite", sqft: 10, sellingPrice: 300 }),
        slab({ categoryName: null, sqft: 1, sellingPrice: 10 }),
      ],
      NOW,
    );
    expect(data.valueByCategory.map((c) => [c.name, c.value])).toEqual([
      ["Granite", 3000],
      ["Marble", 1000],
      ["Uncategorized", 10],
    ]);
  });

  it("counts slabs per warehouse by status; sold slabs add no stock sqft", () => {
    const data = buildReportData(
      [
        slab({ warehouseName: "A", statusName: "Available", sqft: 10 }),
        slab({ warehouseName: "A", statusName: "Reserved", sqft: 5 }),
        slab({ warehouseName: "A", statusName: "Sold", sqft: 40 }),
        slab({ warehouseName: null, statusName: "Available", sqft: 1 }),
      ],
      NOW,
    );
    expect(data.byWarehouse).toEqual([
      { name: "A", available: 1, reserved: 1, sold: 1, stockSqft: 15 },
      { name: "Unassigned", available: 1, reserved: 0, sold: 0, stockSqft: 1 },
    ]);
  });

  it("ranks sold marbles by slab count and caps the list at 10", () => {
    const sold = (name: string, n: number) =>
      Array.from({ length: n }, () => slab({ statusName: "Sold", marbleName: name }));
    const many = Array.from({ length: 12 }, (_, i) => sold(`M${String(i).padStart(2, "0")}`, 1)).flat();
    const data = buildReportData([...sold("Top", 3), ...sold("Second", 2), ...many], NOW);

    expect(data.soldByMarble).toHaveLength(10);
    expect(data.soldByMarble[0]).toMatchObject({ name: "Top", slabs: 3 });
    expect(data.soldByMarble[1]).toMatchObject({ name: "Second", slabs: 2 });
  });

  it("buckets in-stock slabs by age with correct boundaries and ignores sold / undated ones", () => {
    const data = buildReportData(
      [
        slab({ createdAt: daysAgo(0) }),
        slab({ createdAt: daysAgo(30) }),
        slab({ createdAt: daysAgo(31) }),
        slab({ createdAt: daysAgo(90) }),
        slab({ createdAt: daysAgo(91) }),
        slab({ createdAt: null }),
        slab({ createdAt: daysAgo(500), statusName: "Sold" }),
      ],
      NOW,
    );
    expect(data.ageing.map((b) => b.slabs)).toEqual([2, 1, 1, 1]);
  });

  it("handles an empty inventory", () => {
    const data = buildReportData([], NOW);
    expect(data.totals).toEqual({
      stockValue: 0,
      stockSqft: 0,
      stockSlabs: 0,
      soldSlabs: 0,
      soldSqft: 0,
      unpricedSlabs: 0,
    });
    expect(data.valueByCategory).toEqual([]);
    expect(data.ageing.every((b) => b.slabs === 0)).toBe(true);
  });

  it("rounds away floating-point noise", () => {
    const data = buildReportData([slab({ sqft: 0.1, sellingPrice: 3 }), slab({ sqft: 0.2, sellingPrice: 3 })], NOW);
    expect(data.totals.stockValue).toBe(0.9);
  });
});

describe("toCsv", () => {
  it("quotes cells containing commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "line1\nline2"]])).toBe('"a,b","say ""hi""","line1\nline2"');
  });

  it("neutralises spreadsheet formula injection in text cells but leaves numbers alone", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "+1", "@cmd", -5, 3.5]])).toBe(`"'=HYPERLINK(""x"")",'+1,'@cmd,-5,3.5`);
  });

  it("writes empty cells for null / undefined / NaN", () => {
    expect(toCsv([[null, undefined, Number.NaN, "x"]])).toBe(",,,x");
  });

  it("joins rows with CRLF", () => {
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });
});
