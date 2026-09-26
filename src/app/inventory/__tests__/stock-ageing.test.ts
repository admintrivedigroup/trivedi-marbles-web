import { describe, expect, it } from "vitest";

import {
  ageInDays,
  buildSlowMovingLots,
  buildWarehouseAgeing,
  milestoneFor,
  totalSlowStock,
  type AgeingSlab,
} from "@/app/inventory/_lib/stock-ageing";

const NOW = new Date("2026-09-26T06:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function slab(overrides: Partial<AgeingSlab>): AgeingSlab {
  return {
    createdAt: daysAgo(10),
    lotId: "lot-1",
    lotNumber: "L1",
    marbleName: "Ambaji White",
    categoryName: "White",
    warehouseName: "Ahmedabad",
    statusName: "Available",
    sqft: 50,
    sellingPrice: 100,
    ...overrides,
  };
}

describe("ageInDays", () => {
  it("counts whole days and ignores missing or bad dates", () => {
    expect(ageInDays(daysAgo(90), NOW)).toBe(90);
    expect(ageInDays(new Date(NOW.getTime() - 1000).toISOString(), NOW)).toBe(0);
    expect(ageInDays(null, NOW)).toBeNull();
    expect(ageInDays("not a date", NOW)).toBeNull();
  });
});

describe("milestoneFor", () => {
  it("returns the highest milestone reached", () => {
    expect(milestoneFor(89)).toBeNull();
    expect(milestoneFor(90)).toBe(90);
    expect(milestoneFor(179)).toBe(90);
    expect(milestoneFor(200)).toBe(180);
    expect(milestoneFor(400)).toBe(365);
  });
});

describe("buildSlowMovingLots", () => {
  it("ages a lot by its oldest unsold slab, so new top-ups don't hide old stock", () => {
    const lots = buildSlowMovingLots(
      [slab({ createdAt: daysAgo(200) }), slab({ createdAt: daysAgo(5), warehouseName: "Ambaji" })],
      { minDays: 90, now: NOW },
    );
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({
      lotId: "lot-1",
      ageDays: 200,
      oldestAddedAt: daysAgo(200),
      availableSlabs: 2,
      sqft: 100,
      value: 10000,
      warehouses: ["Ahmedabad", "Ambaji"],
    });
  });

  it("ignores sold slabs, so a lot whose old slabs sold is aged by what's left", () => {
    const lots = buildSlowMovingLots(
      [slab({ createdAt: daysAgo(300), statusName: "Sold" }), slab({ createdAt: daysAgo(100) })],
      { minDays: 90, now: NOW },
    );
    expect(lots[0].ageDays).toBe(100);
    expect(lots[0].availableSlabs).toBe(1);
  });

  it("counts reserved slabs as unsold and separates them from available", () => {
    const [lot] = buildSlowMovingLots(
      [slab({ createdAt: daysAgo(120) }), slab({ createdAt: daysAgo(120), statusName: "Reserved" })],
      { minDays: 90, now: NOW },
    );
    expect(lot).toMatchObject({ availableSlabs: 1, reservedSlabs: 1 });
  });

  it("drops lots younger than minDays and sorts oldest first", () => {
    const lots = buildSlowMovingLots(
      [
        slab({ lotId: "young", createdAt: daysAgo(30) }),
        slab({ lotId: "old", createdAt: daysAgo(400) }),
        slab({ lotId: "mid", createdAt: daysAgo(190) }),
      ],
      { minDays: 180, now: NOW },
    );
    expect(lots.map((l) => l.lotId)).toEqual(["old", "mid"]);
  });

  it("leaves unpriced slabs out of the value and counts them", () => {
    const [lot] = buildSlowMovingLots(
      [slab({ createdAt: daysAgo(100) }), slab({ createdAt: daysAgo(100), sellingPrice: null })],
      { minDays: 90, now: NOW },
    );
    expect(lot).toMatchObject({ value: 5000, unpricedSlabs: 1, sqft: 100 });
  });

  it("lists slabs outside any lot individually", () => {
    const lots = buildSlowMovingLots(
      [slab({ lotId: null, createdAt: daysAgo(100) }), slab({ lotId: null, createdAt: daysAgo(150) })],
      { minDays: 90, now: NOW },
    );
    expect(lots).toHaveLength(2);
    expect(lots.every((l) => l.lotId === null)).toBe(true);
  });
});

describe("buildWarehouseAgeing", () => {
  it("buckets each unsold slab by its own age per warehouse", () => {
    const rows = buildWarehouseAgeing(
      [
        slab({ createdAt: daysAgo(10) }),
        slab({ createdAt: daysAgo(100) }),
        slab({ createdAt: daysAgo(200), warehouseName: "Ambaji", sqft: 20 }),
        slab({ createdAt: daysAgo(500), warehouseName: "Ambaji", sqft: 30 }),
        slab({ createdAt: daysAgo(500), statusName: "Sold" }),
      ],
      NOW,
    );
    expect(rows).toEqual([
      { name: "Ahmedabad", slabs: [1, 1, 0, 0], sqft: [50, 50, 0, 0] },
      { name: "Ambaji", slabs: [0, 0, 1, 1], sqft: [0, 0, 20, 30] },
    ]);
  });
});

describe("totalSlowStock", () => {
  it("sums lots, slabs, sqft and value", () => {
    const lots = buildSlowMovingLots(
      [slab({ lotId: "a", createdAt: daysAgo(100) }), slab({ lotId: "b", createdAt: daysAgo(100), statusName: "Reserved" })],
      { minDays: 90, now: NOW },
    );
    expect(totalSlowStock(lots)).toEqual({ lots: 2, slabs: 2, sqft: 100, value: 10000 });
  });
});
