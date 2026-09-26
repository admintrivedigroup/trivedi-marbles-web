// Report figures derived from the current slab list. Pure (no server-only imports) so the
// arithmetic can be unit-tested; the page feeds it the result of getInventorySlabs.
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

export type ReportSlab = {
  categoryName: string | null;
  createdAt: string | null;
  marbleName: string | null;
  sellingPrice: number | null;
  sqft: number | null;
  statusName: string | null;
  warehouseName: string | null;
};

export type ReportData = {
  totals: {
    /** Selling value (sqft × price per sqft) of Available + Reserved slabs. */
    stockValue: number;
    stockSqft: number;
    stockSlabs: number;
    soldSlabs: number;
    soldSqft: number;
    /** In-stock slabs with no price or size, left out of stockValue. */
    unpricedSlabs: number;
  };
  valueByCategory: { name: string; value: number; sqft: number; slabs: number }[];
  byWarehouse: { name: string; available: number; reserved: number; sold: number; stockSqft: number }[];
  soldByMarble: { name: string; slabs: number; sqft: number }[];
  ageing: { label: string; slabs: number; sqft: number }[];
};

const UNCATEGORIZED = "Uncategorized";
const UNKNOWN_WAREHOUSE = "Unassigned";
const UNNAMED_MARBLE = "Unnamed";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOP_SOLD_LIMIT = 10;

const AGEING_BUCKETS = [
  { label: "0–30 days", maxDays: 30 },
  { label: "31–60 days", maxDays: 60 },
  { label: "61–90 days", maxDays: 90 },
  { label: "Over 90 days", maxDays: Infinity },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildReportData(slabs: ReportSlab[], now: Date = new Date()): ReportData {
  const inStock = slabs.filter(
    (s) => s.statusName === SLAB_STATUS.AVAILABLE || s.statusName === SLAB_STATUS.RESERVED,
  );
  const sold = slabs.filter((s) => s.statusName === SLAB_STATUS.SOLD);

  let stockValue = 0;
  let stockSqft = 0;
  let unpricedSlabs = 0;
  const categories = new Map<string, { value: number; sqft: number; slabs: number }>();

  for (const slab of inStock) {
    const sqft = slab.sqft ?? 0;
    stockSqft += sqft;

    const priced = slab.sqft !== null && slab.sellingPrice !== null;
    const value = priced ? sqft * (slab.sellingPrice as number) : 0;
    if (!priced) unpricedSlabs++;
    stockValue += value;

    const name = slab.categoryName ?? UNCATEGORIZED;
    const bucket = categories.get(name) ?? { value: 0, sqft: 0, slabs: 0 };
    bucket.value += value;
    bucket.sqft += sqft;
    bucket.slabs += 1;
    categories.set(name, bucket);
  }

  const warehouses = new Map<string, { available: number; reserved: number; sold: number; stockSqft: number }>();
  for (const slab of slabs) {
    const name = slab.warehouseName ?? UNKNOWN_WAREHOUSE;
    const bucket = warehouses.get(name) ?? { available: 0, reserved: 0, sold: 0, stockSqft: 0 };
    if (slab.statusName === SLAB_STATUS.AVAILABLE) {
      bucket.available += 1;
      bucket.stockSqft += slab.sqft ?? 0;
    } else if (slab.statusName === SLAB_STATUS.RESERVED) {
      bucket.reserved += 1;
      bucket.stockSqft += slab.sqft ?? 0;
    } else if (slab.statusName === SLAB_STATUS.SOLD) {
      bucket.sold += 1;
    }
    warehouses.set(name, bucket);
  }

  const soldMap = new Map<string, { slabs: number; sqft: number }>();
  let soldSqft = 0;
  for (const slab of sold) {
    const name = slab.marbleName ?? UNNAMED_MARBLE;
    const bucket = soldMap.get(name) ?? { slabs: 0, sqft: 0 };
    bucket.slabs += 1;
    bucket.sqft += slab.sqft ?? 0;
    soldMap.set(name, bucket);
    soldSqft += slab.sqft ?? 0;
  }

  const ageing = AGEING_BUCKETS.map((b) => ({ label: b.label, slabs: 0, sqft: 0 }));
  for (const slab of inStock) {
    if (!slab.createdAt) continue;
    const created = new Date(slab.createdAt).getTime();
    if (Number.isNaN(created)) continue;
    const ageDays = Math.max(0, Math.floor((now.getTime() - created) / MS_PER_DAY));
    const index = AGEING_BUCKETS.findIndex((b) => ageDays <= b.maxDays);
    ageing[index].slabs += 1;
    ageing[index].sqft += slab.sqft ?? 0;
  }

  return {
    totals: {
      stockValue: round2(stockValue),
      stockSqft: round2(stockSqft),
      stockSlabs: inStock.length,
      soldSlabs: sold.length,
      soldSqft: round2(soldSqft),
      unpricedSlabs,
    },
    valueByCategory: [...categories.entries()]
      .map(([name, b]) => ({ name, value: round2(b.value), sqft: round2(b.sqft), slabs: b.slabs }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
    byWarehouse: [...warehouses.entries()]
      .map(([name, b]) => ({ name, ...b, stockSqft: round2(b.stockSqft) }))
      .sort((a, b) => b.available + b.reserved - (a.available + a.reserved) || a.name.localeCompare(b.name)),
    soldByMarble: [...soldMap.entries()]
      .map(([name, b]) => ({ name, slabs: b.slabs, sqft: round2(b.sqft) }))
      .sort((a, b) => b.slabs - a.slabs || b.sqft - a.sqft || a.name.localeCompare(b.name))
      .slice(0, TOP_SOLD_LIMIT),
    ageing: ageing.map((b) => ({ ...b, sqft: round2(b.sqft) })),
  };
}
