import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import {
  groupSlabsIntoLotFolders,
  matchesSlabSearch,
  sortLotFolders,
  LOTS_PER_PAGE,
  type LotFolder,
  type LotFolderSortBy,
} from "@/app/inventory/_lib/lot-folders";
import { UNCATEGORIZED_ID } from "@/app/inventory/_lib/category-overview";

export type CategoryLotsFilters = {
  categoryId: string;
  warehouseId: string;
  statusId: string;
  sortBy: LotFolderSortBy;
  search?: string;
  allowedWarehouseIds: string[] | null;
  page: number;
};

export type CategoryLotsResult = {
  error: string | null;
  categoryName: string | null;
  lots: LotFolder[];
  totalLots: number;
  totalPages: number;
  totalSlabs: number;
};

export async function getCategoryLots(filters: CategoryLotsFilters): Promise<CategoryLotsResult> {
  const supabase = await createClient();

  const [{ data: categoryRow }, { error, slabs }] = await Promise.all([
    filters.categoryId === UNCATEGORIZED_ID
      ? Promise.resolve({ data: null })
      : supabase.from("marble_categories").select("name").eq("id", filters.categoryId).maybeSingle(),
    getInventorySlabs({ warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds: filters.allowedWarehouseIds }),
  ]);

  if (error) {
    return { error, categoryName: null, lots: [], totalLots: 0, totalPages: 0, totalSlabs: 0 };
  }

  const categoryName = filters.categoryId === UNCATEGORIZED_ID ? "Uncategorized" : (categoryRow?.name ?? null);

  let scoped = slabs.filter((s) =>
    filters.categoryId === UNCATEGORIZED_ID ? !s.categoryId : s.categoryId === filters.categoryId,
  );

  // warehouseId/statusId in InventoryListSlab are names, not ids — resolve here via a lookup.
  if (filters.warehouseId || filters.statusId) {
    const [{ data: warehouseRow }, { data: statusRow }] = await Promise.all([
      filters.warehouseId ? supabase.from("warehouses").select("name").eq("id", filters.warehouseId).maybeSingle() : Promise.resolve({ data: null }),
      filters.statusId ? supabase.from("slab_statuses").select("name").eq("id", filters.statusId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (filters.warehouseId) {
      const name = warehouseRow?.name ?? null;
      scoped = scoped.filter((s) => s.warehouseName === name);
    }
    if (filters.statusId) {
      const name = statusRow?.name ?? null;
      scoped = scoped.filter((s) => s.statusName === name);
    }
  }

  if (filters.search) {
    scoped = scoped.filter((s) => matchesSlabSearch(s, filters.search!));
  }

  const totalSlabs = scoped.length;
  let folders = groupSlabsIntoLotFolders(scoped);
  folders = sortLotFolders(folders, filters.sortBy);

  const totalLots = folders.length;
  const totalPages = Math.max(1, Math.ceil(totalLots / LOTS_PER_PAGE));
  const clampedPage = Math.min(Math.max(1, filters.page), totalPages);
  const pageLots = folders.slice((clampedPage - 1) * LOTS_PER_PAGE, clampedPage * LOTS_PER_PAGE);

  return { error: null, categoryName, lots: pageLots, totalLots, totalPages, totalSlabs };
}
