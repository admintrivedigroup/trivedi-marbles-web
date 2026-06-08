import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toNum, toStr, relName, relLotNumber } from "@/app/inventory/_lib/normalize";

type SlabImageRelation =
  | Array<{ image_url?: unknown; sort_order?: unknown }>
  | null;

type NameRelation = { name?: unknown } | Array<{ name?: unknown }> | null;
type LotRelation = { lot_number?: unknown } | Array<{ lot_number?: unknown }> | null;

type InventorySlabRow = {
  // Note: all numeric fields typed as number|string|null to safely handle
  // Supabase returning either depending on column type; toNum() normalizes both.
  cost_price: number | string | null;
  created_at: string | null;
  dealer_price: number | string | null;
  id: number | string | null;
  length: number | string | null;
  lot_id: number | string | null;
  marble_categories: NameRelation;
  marble_lots: LotRelation;
  marble_name: string | null;
  notes: string | null;
  rack_number: string | null;
  reserved_for?: string | null;
  reserved_until?: string | null;
  selling_price: number | string | null;
  slab_code: string | null;
  slab_images: SlabImageRelation;
  slab_statuses: NameRelation;
  sqft: number | string | null;
  thickness_options: NameRelation;
  warehouses: NameRelation;
  width: number | string | null;
};

export type InventoryListSlab = {
  categoryName: string | null;
  costPrice: number | null;
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

export type SortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "sqft_desc" | "sqft_asc";

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
};

// Safety cap: prevents unbounded fetches if the DB grows unexpectedly.
// Client-side lot grouping and pagination operate within this ceiling.
const MAX_SLAB_ROWS = 5000;

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

  return {
    categoryName: relName(row.marble_categories),
    costPrice: toNum(row.cost_price),
    createdAt: toStr(row.created_at),
    dealerPrice: toNum(row.dealer_price),
    id,
    length: toNum(row.length),
    lotId:
      typeof row.lot_id === "number" || typeof row.lot_id === "string"
        ? String(row.lot_id)
        : null,
    lotNumber: relLotNumber(row.marble_lots),
    marbleName: toStr(row.marble_name),
    notes: toStr(row.notes),
    rackNumber: toStr(row.rack_number),
    reservedFor: toStr(row.reserved_for ?? null),
    reservedUntil: toStr(row.reserved_until ?? null),
    sellingPrice: toNum(row.selling_price),
    slabCode: toStr(row.slab_code),
    sqft: toNum(row.sqft),
    statusName: relName(row.slab_statuses),
    thumbnailUrl,
    thicknessName: relName(row.thickness_options),
    warehouseName: relName(row.warehouses),
    width: toNum(row.width),
  };
}

export async function getInventorySlabs(
  filters: InventoryListFilters = { warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds: null },
): Promise<InventoryListResult> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("slabs")
      .select(`
        id,
        slab_code,
        marble_name,
        length,
        width,
        sqft,
        rack_number,
        cost_price,
        selling_price,
        dealer_price,
        notes,
        created_at,
        lot_id,
        marble_categories(name),
        warehouses(name),
        slab_statuses(name),
        thickness_options(name),
        marble_lots(lot_number),
        slab_images(image_url, sort_order)
      `);

    query = query.is("deleted_at", null);

    if (filters.allowedWarehouseIds !== null && filters.allowedWarehouseIds.length > 0) {
      query = query.in("warehouse_id", filters.allowedWarehouseIds);
    }
    if (filters.warehouseId) {
      query = query.eq("warehouse_id", filters.warehouseId);
    }
    if (filters.statusId) {
      query = query.eq("status_id", filters.statusId);
    }
    if (filters.search) {
      // Strip PostgREST syntax chars; escape SQL LIKE wildcards
      const safe = filters.search
        .replace(/[%_\\]/g, (c) => `\\${c}`)
        .replace(/[(),]/g, "");
      if (safe) {
        query = query.or(`marble_name.ilike.%${safe}%,slab_code.ilike.%${safe}%`);
      }
    }

    const sortMap: Record<SortBy, { column: string; ascending: boolean }> = {
      newest:    { column: "created_at",  ascending: false },
      oldest:    { column: "created_at",  ascending: true  },
      name_asc:  { column: "marble_name", ascending: true  },
      name_desc: { column: "marble_name", ascending: false },
      sqft_desc: { column: "sqft",        ascending: false },
      sqft_asc:  { column: "sqft",        ascending: true  },
    };
    const { column, ascending } = sortMap[filters.sortBy] ?? sortMap.newest;
    query = query.order(column, { ascending }).limit(MAX_SLAB_ROWS);

    const { data, error } = await query;

    if (error) {
      return {
        error: `Unable to load inventory. ${error.message}`,
        slabs: [],
      };
    }

    return {
      error: null,
      slabs: ((data as InventorySlabRow[] | null) ?? [])
        .map(normalizeInventorySlab)
        .filter((row): row is InventoryListSlab => row !== null),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Please try again.";

    return {
      error: `Unable to load inventory. ${message}`,
      slabs: [],
    };
  }
}
