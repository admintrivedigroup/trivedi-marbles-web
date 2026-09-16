import "server-only";

import { getInventorySlabs, type InventoryListSlab } from "@/app/inventory/_lib/inventory-list";

export type RankedSlab = InventoryListSlab & {
  sizeDistance: number;
  isExactMatch: boolean;
};

export type SizeSearchFilters = {
  categoryId: string;
  length: number;
  width: number;
  warehouseId: string;
  statusId: string;
  allowedWarehouseIds: string[] | null;
};

export type SizeSearchResult = {
  error: string | null;
  results: RankedSlab[];
  totalMatches: number;
};

// Cap the ranked list transferred to the client — closest matches are always first.
const MAX_RESULTS = 300;

// Slabs are hand-measured, so treat anything within this tolerance as the same size.
const EXACT_MATCH_TOLERANCE_FT = 0.05;

/**
 * Distance (in feet) between a slab's dimensions and the target size. Slabs can be
 * measured in either orientation (a 10x15 slab is the same as a 15x10 one), so this
 * takes the closer of the two orientations.
 */
function sizeDistance(length: number, width: number, targetLength: number, targetWidth: number): number {
  const straight = Math.hypot(length - targetLength, width - targetWidth);
  const rotated = Math.hypot(length - targetWidth, width - targetLength);
  return Math.min(straight, rotated);
}

export async function searchSlabsBySize(filters: SizeSearchFilters): Promise<SizeSearchResult> {
  const { error, slabs } = await getInventorySlabs({
    warehouseId: filters.warehouseId,
    statusId: filters.statusId,
    sortBy: "newest",
    allowedWarehouseIds: filters.allowedWarehouseIds,
  });

  if (error) {
    return { error, results: [], totalMatches: 0 };
  }

  const scoped = filters.categoryId
    ? slabs.filter((s) => s.categoryId === filters.categoryId)
    : slabs;

  const ranked: RankedSlab[] = scoped
    .filter((s): s is InventoryListSlab & { length: number; width: number } => s.length != null && s.width != null)
    .map((s) => {
      const distance = sizeDistance(s.length, s.width, filters.length, filters.width);
      return { ...s, sizeDistance: distance, isExactMatch: distance <= EXACT_MATCH_TOLERANCE_FT };
    })
    .sort((a, b) => a.sizeDistance - b.sizeDistance || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return { error: null, results: ranked.slice(0, MAX_RESULTS), totalMatches: ranked.length };
}
