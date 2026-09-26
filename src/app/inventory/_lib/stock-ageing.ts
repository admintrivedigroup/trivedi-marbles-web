// Slow-moving stock: which lots have had unsold slabs sitting for a long time. Pure
// (no server-only imports) so the grouping and thresholds can be unit-tested; the
// page and the daily digest feed it slabs from getInventorySlabs / the admin client.
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

/** Age milestones, in days, that the page filters on and the daily digest reports. */
export const AGE_MILESTONES = [90, 180, 365] as const;
export type AgeMilestone = (typeof AGE_MILESTONES)[number];

export function isAgeMilestone(value: number): value is AgeMilestone {
  return (AGE_MILESTONES as readonly number[]).includes(value);
}

export type AgeingSlab = {
  createdAt: string | null;
  lotId: string | null;
  lotNumber: string | null;
  marbleName: string | null;
  categoryName: string | null;
  warehouseName: string | null;
  statusName: string | null;
  sqft: number | null;
  sellingPrice: number | null;
};

export type SlowMovingLot = {
  /** Lot id, or null for a slab that isn't in any lot (then it's listed on its own). */
  lotId: string | null;
  lotNumber: string | null;
  marbleName: string;
  categoryName: string | null;
  warehouses: string[];
  /** Days since the oldest still-unsold slab in the lot was added. */
  ageDays: number;
  oldestAddedAt: string;
  availableSlabs: number;
  reservedSlabs: number;
  sqft: number;
  /** Selling value (sqft × price) of the unsold slabs that have both. */
  value: number;
  unpricedSlabs: number;
};

export type WarehouseAgeing = {
  name: string;
  /** Slab counts per bucket, in WAREHOUSE_AGE_BUCKETS order. */
  slabs: number[];
  sqft: number[];
};

export const WAREHOUSE_AGE_BUCKETS = [
  { label: "0–90 days", maxDays: 90 },
  { label: "91–180 days", maxDays: 180 },
  { label: "181–365 days", maxDays: 365 },
  { label: "Over 1 year", maxDays: Infinity },
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNNAMED_MARBLE = "Unnamed";
const UNKNOWN_WAREHOUSE = "Unassigned";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isUnsold(slab: AgeingSlab): boolean {
  return slab.statusName === SLAB_STATUS.AVAILABLE || slab.statusName === SLAB_STATUS.RESERVED;
}

/** Whole days between `createdAt` and `now`, or null when the date is missing or bad. */
export function ageInDays(createdAt: string | null, now: Date): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((now.getTime() - created) / MS_PER_DAY));
}

/** Highest milestone reached by a lot of this age, or null when under the first one. */
export function milestoneFor(ageDays: number): AgeMilestone | null {
  let reached: AgeMilestone | null = null;
  for (const m of AGE_MILESTONES) if (ageDays >= m) reached = m;
  return reached;
}

/** Groups unsold (Available + Reserved) slabs by lot and returns the lots whose oldest
 * unsold slab is at least `minDays` old, oldest first. A lot's age is its oldest unsold
 * slab's age, so topping up an old lot with new slabs doesn't hide the old ones. */
export function buildSlowMovingLots(
  slabs: AgeingSlab[],
  options: { minDays: number; now?: Date },
): SlowMovingLot[] {
  const now = options.now ?? new Date();
  const lots = new Map<string, SlowMovingLot & { warehouseSet: Set<string> }>();

  slabs.forEach((slab, index) => {
    if (!isUnsold(slab)) return;
    const age = ageInDays(slab.createdAt, now);
    if (age === null) return;

    const key = slab.lotId ?? `__slab_${index}`;
    let lot = lots.get(key);
    if (!lot) {
      lot = {
        lotId: slab.lotId,
        lotNumber: slab.lotNumber,
        marbleName: slab.marbleName ?? UNNAMED_MARBLE,
        categoryName: slab.categoryName,
        warehouses: [],
        warehouseSet: new Set(),
        ageDays: age,
        oldestAddedAt: slab.createdAt as string,
        availableSlabs: 0,
        reservedSlabs: 0,
        sqft: 0,
        value: 0,
        unpricedSlabs: 0,
      };
      lots.set(key, lot);
    }

    if (age > lot.ageDays) {
      lot.ageDays = age;
      lot.oldestAddedAt = slab.createdAt as string;
    }
    lot.warehouseSet.add(slab.warehouseName ?? UNKNOWN_WAREHOUSE);
    if (slab.statusName === SLAB_STATUS.AVAILABLE) lot.availableSlabs += 1;
    else lot.reservedSlabs += 1;
    lot.sqft += slab.sqft ?? 0;
    if (slab.sqft !== null && slab.sellingPrice !== null) lot.value += slab.sqft * slab.sellingPrice;
    else lot.unpricedSlabs += 1;
  });

  return [...lots.values()]
    .filter((lot) => lot.ageDays >= options.minDays)
    .map(({ warehouseSet, ...lot }) => ({
      ...lot,
      warehouses: [...warehouseSet].sort(),
      sqft: round2(lot.sqft),
      value: round2(lot.value),
    }))
    .sort((a, b) => b.ageDays - a.ageDays || a.marbleName.localeCompare(b.marbleName));
}

/** Unsold slabs per warehouse, split into WAREHOUSE_AGE_BUCKETS by each slab's own age. */
export function buildWarehouseAgeing(slabs: AgeingSlab[], now: Date = new Date()): WarehouseAgeing[] {
  const rows = new Map<string, WarehouseAgeing>();

  for (const slab of slabs) {
    if (!isUnsold(slab)) continue;
    const age = ageInDays(slab.createdAt, now);
    if (age === null) continue;

    const name = slab.warehouseName ?? UNKNOWN_WAREHOUSE;
    const row = rows.get(name) ?? {
      name,
      slabs: WAREHOUSE_AGE_BUCKETS.map(() => 0),
      sqft: WAREHOUSE_AGE_BUCKETS.map(() => 0),
    };
    const bucket = WAREHOUSE_AGE_BUCKETS.findIndex((b) => age <= b.maxDays);
    row.slabs[bucket] += 1;
    row.sqft[bucket] += slab.sqft ?? 0;
    rows.set(name, row);
  }

  return [...rows.values()]
    .map((row) => ({ ...row, sqft: row.sqft.map(round2) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type SlowStockTotals = { lots: number; slabs: number; sqft: number; value: number };

export function totalSlowStock(lots: SlowMovingLot[]): SlowStockTotals {
  return {
    lots: lots.length,
    slabs: lots.reduce((n, l) => n + l.availableSlabs + l.reservedSlabs, 0),
    sqft: round2(lots.reduce((n, l) => n + l.sqft, 0)),
    value: round2(lots.reduce((n, l) => n + l.value, 0)),
  };
}
