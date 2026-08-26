import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { groupSlabsIntoLotFolders, matchesSlabSearch, type LotFolder } from "@/app/inventory/_lib/lot-folders";

export type CategoryFolder = {
  id: string;
  name: string;
  lotCount: number;
  slabCount: number;
  availableCount: number;
  thumbnailUrl: string | null;
};

export const UNCATEGORIZED_ID = "uncategorized";

export type CategoryOverviewResult = {
  error: string | null;
  categories: CategoryFolder[];
  uncategorized: CategoryFolder | null;
  /** Present only when `search` was passed — flat matching lot folders across every category. */
  searchResults: LotFolder[] | null;
  totalLots: number;
  totalSlabs: number;
};

export async function getCategoryOverview(
  allowedWarehouseIds: string[] | null,
  search?: string,
): Promise<CategoryOverviewResult> {
  const supabase = await createClient();

  const [{ data: categoryRows, error: categoryError }, { error: slabError, slabs }] = await Promise.all([
    supabase
      .from("marble_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    getInventorySlabs({ warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds }),
  ]);

  if (categoryError || slabError) {
    return {
      error: slabError ?? `Unable to load categories. ${categoryError?.message ?? ""}`.trim(),
      categories: [],
      uncategorized: null,
      searchResults: null,
      totalLots: 0,
      totalSlabs: 0,
    };
  }

  const totalLots = new Set(slabs.map((s) => s.lotId ?? `__slab_${s.id}`)).size;
  const totalSlabs = slabs.length;

  if (search && search.trim()) {
    const matchingSlabs = slabs.filter((s) => matchesSlabSearch(s, search));
    const searchResults = groupSlabsIntoLotFolders(matchingSlabs).sort((a, b) =>
      (b.latestCreatedAt ?? "").localeCompare(a.latestCreatedAt ?? ""),
    );
    return { error: null, categories: [], uncategorized: null, searchResults, totalLots, totalSlabs };
  }

  type Bucket = { lotIds: Set<string>; slabCount: number; availableCount: number; thumbnailUrl: string | null };
  const byCategoryId = new Map<string, Bucket>();
  const uncategorizedBucket: Bucket = { lotIds: new Set(), slabCount: 0, availableCount: 0, thumbnailUrl: null };

  function newBucket(): Bucket {
    return { lotIds: new Set(), slabCount: 0, availableCount: 0, thumbnailUrl: null };
  }

  for (const slab of slabs) {
    let bucket = uncategorizedBucket;
    if (slab.categoryId) {
      bucket = byCategoryId.get(slab.categoryId) ?? newBucket();
      byCategoryId.set(slab.categoryId, bucket);
    }

    bucket.lotIds.add(slab.lotId ?? `__slab_${slab.id}`);
    bucket.slabCount++;
    if (slab.statusName === "Available") bucket.availableCount++;
    if (!bucket.thumbnailUrl && slab.thumbnailUrl) bucket.thumbnailUrl = slab.thumbnailUrl;
  }

  const categories: CategoryFolder[] = ((categoryRows ?? []) as { id: string; name: string }[]).map((row) => {
    const bucket = byCategoryId.get(String(row.id));
    return {
      id: String(row.id),
      name: row.name,
      lotCount: bucket?.lotIds.size ?? 0,
      slabCount: bucket?.slabCount ?? 0,
      availableCount: bucket?.availableCount ?? 0,
      thumbnailUrl: bucket?.thumbnailUrl ?? null,
    };
  });

  const uncategorized: CategoryFolder | null =
    uncategorizedBucket.lotIds.size > 0
      ? {
          id: UNCATEGORIZED_ID,
          name: "Uncategorized",
          lotCount: uncategorizedBucket.lotIds.size,
          slabCount: uncategorizedBucket.slabCount,
          availableCount: uncategorizedBucket.availableCount,
          thumbnailUrl: uncategorizedBucket.thumbnailUrl,
        }
      : null;

  return { error: null, categories, uncategorized, searchResults: null, totalLots, totalSlabs };
}
