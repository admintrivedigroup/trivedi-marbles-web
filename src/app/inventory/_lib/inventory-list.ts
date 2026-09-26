import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toNum, toStr, relName, relId, relLot } from "@/app/inventory/_lib/normalize";
import { fetchAllPages } from "@/app/inventory/_lib/fetch-all";
import { DB_SORT, sortByMarbleName, sortsByName, type SortBy } from "@/app/inventory/_lib/slab-sort";

export type { SortBy };

type SlabImageRelation =
  | Array<{ image_url?: unknown; sort_order?: unknown }>
  | null;

type NameRelation = { name?: unknown } | Array<{ name?: unknown }> | null;
type CategoryRelation = { id?: unknown; name?: unknown } | Array<{ id?: unknown; name?: unknown }> | null;
type LotRelation =
  | { lot_number?: unknown; marble_name?: unknown; marble_categories?: CategoryRelation; thickness_options?: NameRelation }
  | Array<{ lot_number?: unknown; marble_name?: unknown; marble_categories?: CategoryRelation; thickness_options?: NameRelation }>
  | null;

type InventorySlabRow = {
  // Note: all numeric fields typed as number|string|null to safely handle
  // Supabase returning either depending on column type; toNum() normalizes both.
  created_at: string | null;
  dealer_price: number | string | null;
  id: number | string | null;
  length: number | string | null;
  lot_id: number | string | null;
  marble_lots: LotRelation;
  notes: string | null;
  rack_number: string | null;
  reserved_for?: string | null;
  reserved_until?: string | null;
  selling_price: number | string | null;
  slab_code: string | null;
  slab_images: SlabImageRelation;
  slab_statuses: NameRelation;
  sqft: number | string | null;
  warehouses: NameRelation;
  width: number | string | null;
};

export type InventoryListSlab = {
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string | null;
  dealerPrice: number | null;
  id: string;
  length: number | null;
  lotId: string | null;
  lotNumber: string | null;
  marbleName: string | null;
  notes: string | null;
  rackNumber: string | null;
  reservedFor: string | null;
  reservedUntil: string | null;
  sellingPrice: number | null;
  slabCode: string | null;
  sqft: number | null;
  statusName: string | null;
  thumbnailUrl: string | null;
  thicknessName: string | null;
  warehouseName: string | null;
  width: number | null;
};

export type InventoryListFilters = {
  warehouseId: string;
  statusId: string;
  sortBy: SortBy;
  search?: string;
  allowedWarehouseIds: string[] | null;
};

export type InventoryListResult = {
  error: string | null;
  slabs: InventoryListSlab[];
  /** True when the inventory is larger than MAX_SLAB_ROWS and `slabs` is incomplete. */
  truncated: boolean;
};

// Upper bound on slabs loaded in one call (fetched 1000 at a time). Hitting it is
// reported through `truncated` rather than silently dropping rows.
export const MAX_SLAB_ROWS = 20000;

const SLAB_SELECT = `
  id,
  slab_code,
  length,
  width,
  sqft,
  rack_number,
  selling_price,
  dealer_price,
  notes,
  created_at,
  lot_id,
  warehouses(name),
  slab_statuses(name),
  marble_lots(lot_number, marble_name, marble_categories(id, name), thickness_options(name)),
  slab_images(image_url, sort_order)
`;

function normalizeInventorySlab(row: InventorySlabRow): InventoryListSlab | null {
  const id =
    typeof row.id === "number" || typeof row.id === "string"
      ? String(row.id)
      : null;

  if (!id) {
    return null;
  }

  const images = Array.isArray(row.slab_images) ? row.slab_images : [];
  const thumbnailUrl =
    images
      .slice()
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((img) => (typeof img.image_url === "string" ? img.image_url : null))
      .find((url): url is string => url !== null) ?? null;

  const lot = relLot(row.marble_lots);
  return {
    categoryId: relId(lot?.marble_categories),
    categoryName: relName(lot?.marble_categories),
    createdAt: toStr(row.created_at),
    dealerPrice: toNum(row.dealer_price),
    id,
    length: toNum(row.length),
    lotId:
      typeof row.lot_id === "number" || typeof row.lot_id === "string"
        ? String(row.lot_id)
        : null,
    lotNumber: toStr(lot?.lot_number),
    marbleName: toStr(lot?.marble_name),
    notes: toStr(row.notes),
    rackNumber: toStr(row.rack_number),
    reservedFor: toStr(row.reserved_for ?? null),
    reservedUntil: toStr(row.reserved_until ?? null),
    sellingPrice: toNum(row.selling_price),
    slabCode: toStr(row.slab_code),
    sqft: toNum(row.sqft),
    statusName: relName(row.slab_statuses),
    thumbnailUrl,
    thicknessName: relName(lot?.thickness_options),
    warehouseName: relName(row.warehouses),
    width: toNum(row.width),
  };
}

function sanitizeSearch(search: string): string {
  return search
    .replace(/[%_\\]/g, (c) => `\\${c}`)
    .replace(/[(),]/g, "");
}

export async function getInventorySlabs(
  filters: InventoryListFilters = { warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds: null },
): Promise<InventoryListResult> {
  try {
    const supabase = await createClient();
    const { column, ascending } = DB_SORT[filters.sortBy] ?? DB_SORT.newest;

    let searchClause: string | null = null;
    if (filters.search) {
      const safe = sanitizeSearch(filters.search);
      if (safe) {
        const { data: matchingLots } = await supabase
          .from("marble_lots")
          .select("id")
          .ilike("marble_name", `%${safe}%`);
        const matchingLotIds = (matchingLots ?? []).map((r) => String(r.id));
        searchClause =
          matchingLotIds.length > 0
            ? `slab_code.ilike.%${safe}%,lot_id.in.(${matchingLotIds.join(",")})`
            : `slab_code.ilike.%${safe}%`;
      }
    }

    const { rows, error, truncated } = await fetchAllPages<InventorySlabRow>(
      (from, to) => {
        let query = supabase.from("slabs").select(SLAB_SELECT).is("deleted_at", null);

        if (filters.allowedWarehouseIds !== null && filters.allowedWarehouseIds.length > 0) {
          query = query.in("warehouse_id", filters.allowedWarehouseIds);
        }
        if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
        if (filters.statusId) query = query.eq("status_id", filters.statusId);
        if (searchClause) query = query.or(searchClause);

        // id is a tiebreaker so ranges over equal sort keys never repeat or skip rows.
        return query
          .order(column, { ascending })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: InventorySlabRow[] | null;
          error: { message: string } | null;
        }>;
      },
      { maxRows: MAX_SLAB_ROWS },
    );

    if (error) {
      return { error: `Unable to load inventory. ${error}`, slabs: [], truncated: false };
    }

    if (truncated) {
      console.warn(`getInventorySlabs: inventory exceeds ${MAX_SLAB_ROWS} slabs; results are incomplete.`);
    }

    let slabs = rows
      .map(normalizeInventorySlab)
      .filter((row): row is InventoryListSlab => row !== null);

    if (sortsByName(filters.sortBy)) {
      slabs = sortByMarbleName(slabs, filters.sortBy === "name_asc" ? "asc" : "desc");
    }

    return { error: null, slabs, truncated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Please try again.";
    return { error: `Unable to load inventory. ${message}`, slabs: [], truncated: false };
  }
}
