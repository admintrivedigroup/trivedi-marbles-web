import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toNum, toStr, relName, relLot, relLotNumber } from "@/app/inventory/_lib/normalize";

type SlabImageRelation =
  | Array<{ image_url?: unknown; sort_order?: unknown }>
  | null;

type NameRelation = { name?: unknown } | Array<{ name?: unknown }> | null;
type LotRelation =
  | { lot_number?: unknown; marble_name?: unknown; marble_categories?: NameRelation; thickness_options?: NameRelation }
  | Array<{ lot_number?: unknown; marble_name?: unknown; marble_categories?: NameRelation; thickness_options?: NameRelation }>
  | null;

type InventorySlabRow = {
  // Note: all numeric fields typed as number|string|null to safely handle
  // Supabase returning either depending on column type; toNum() normalizes both.
  cost_price: number | string | null;
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
  /** When set, enables server-side lot pagination. Omit for callers that need all slabs. */
  page?: number;
};

export type InventoryListResult = {
  error: string | null;
  slabs: InventoryListSlab[];
  totalLots: number;
  totalPages: number;
  totalSlabs: number;
};

export const LOTS_PER_PAGE = 20;

// Safety cap for the non-paginated path (dashboard, export, movement, quotations).
const MAX_SLAB_ROWS = 5000;

const SLAB_SELECT = `
  id,
  slab_code,
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
  warehouses(name),
  slab_statuses(name),
  marble_lots(lot_number, marble_name, marble_categories(name), thickness_options(name)),
  slab_images(image_url, sort_order)
`;

const SORT_MAP: Record<SortBy, { column: string; ascending: boolean }> = {
  newest:    { column: "created_at",  ascending: false },
  oldest:    { column: "created_at",  ascending: true  },
  name_asc:  { column: "marble_name", ascending: true  },
  name_desc: { column: "marble_name", ascending: false },
  sqft_desc: { column: "sqft",        ascending: false },
  sqft_asc:  { column: "sqft",        ascending: true  },
};

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
    categoryName: relName(lot?.marble_categories),
    costPrice: toNum(row.cost_price),
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
    const { column, ascending } = SORT_MAP[filters.sortBy] ?? SORT_MAP.newest;
    const safeSearch = filters.search ? sanitizeSearch(filters.search) : null;

    if (filters.page !== undefined) {
      // ── Server-side paginated path ──────────────────────────────────────────
      //
      // Step 1: Lightweight query — only id + lot_id, all filters applied.
      // This lets us deduplicate lot keys in sort order without transferring
      // full slab data. One row per slab but only two columns.

      let idQuery = supabase
        .from("slabs")
        .select("id, lot_id")
        .is("deleted_at", null);

      if (filters.allowedWarehouseIds !== null && filters.allowedWarehouseIds.length > 0) {
        idQuery = idQuery.in("warehouse_id", filters.allowedWarehouseIds);
      }
      if (filters.warehouseId) idQuery = idQuery.eq("warehouse_id", filters.warehouseId);
      if (filters.statusId) idQuery = idQuery.eq("status_id", filters.statusId);
      if (safeSearch) {
        const { data: matchingLots } = await supabase
          .from("marble_lots")
          .select("id")
          .ilike("marble_name", `%${safeSearch}%`);
        const matchingLotIds = (matchingLots ?? []).map((r) => String(r.id));
        if (matchingLotIds.length > 0) {
          idQuery = idQuery.or(`slab_code.ilike.%${safeSearch}%,lot_id.in.(${matchingLotIds.join(",")})`);
        } else {
          idQuery = idQuery.ilike("slab_code", `%${safeSearch}%`);
        }
      }

      idQuery = idQuery.order(column, { ascending }).limit(MAX_SLAB_ROWS);

      const { data: idRows, error: idError } = await idQuery;
      if (idError) {
        return { error: `Unable to load inventory. ${idError.message}`, slabs: [], totalLots: 0, totalPages: 0, totalSlabs: 0 };
      }

      // Deduplicate lot_ids in sort order.
      // Slabs with no lot_id ("orphan slabs") each count as their own lot.
      const seen = new Set<string>();
      const orderedKeys: string[] = [];
      for (const row of idRows ?? []) {
        const key = row.lot_id != null ? String(row.lot_id) : `__slab_${String(row.id)}`;
        if (!seen.has(key)) {
          seen.add(key);
          orderedKeys.push(key);
        }
      }

      const totalSlabs = (idRows ?? []).length;
      const totalLots = orderedKeys.length;
      const totalPages = Math.max(1, Math.ceil(totalLots / LOTS_PER_PAGE));
      const clampedPage = Math.min(Math.max(1, filters.page), totalPages);
      const pageKeys = orderedKeys.slice(
        (clampedPage - 1) * LOTS_PER_PAGE,
        clampedPage * LOTS_PER_PAGE,
      );

      if (pageKeys.length === 0) {
        return { error: null, slabs: [], totalLots, totalPages, totalSlabs };
      }

      // Separate real lot ids from orphan slab ids (kept as strings to support UUID keys).
      const lotIds = pageKeys.filter((k) => !k.startsWith("__slab_"));
      const orphanIds = pageKeys.filter((k) => k.startsWith("__slab_")).map((k) => k.slice(7));

      // Step 2: Full slab data for this page's lots only.
      let slabQuery = supabase
        .from("slabs")
        .select(SLAB_SELECT)
        .is("deleted_at", null);

      if (lotIds.length > 0 && orphanIds.length > 0) {
        slabQuery = slabQuery.or(`lot_id.in.(${lotIds.join(",")}),id.in.(${orphanIds.join(",")})`);
      } else if (lotIds.length > 0) {
        slabQuery = slabQuery.in("lot_id", lotIds);
      } else {
        slabQuery = slabQuery.in("id", orphanIds);
      }

      // Re-apply warehouse / status / search so only matching slabs appear within lots
      // (preserves current behaviour where filters act at the slab level, not lot level).
      if (filters.allowedWarehouseIds !== null && filters.allowedWarehouseIds.length > 0) {
        slabQuery = slabQuery.in("warehouse_id", filters.allowedWarehouseIds);
      }
      if (filters.warehouseId) slabQuery = slabQuery.eq("warehouse_id", filters.warehouseId);
      if (filters.statusId) slabQuery = slabQuery.eq("status_id", filters.statusId);
      if (safeSearch) {
        slabQuery = slabQuery.or(`marble_name.ilike.%${safeSearch}%,slab_code.ilike.%${safeSearch}%`);
      }

      slabQuery = slabQuery.order(column, { ascending });

      const { data: slabData, error: slabError } = await slabQuery;
      if (slabError) {
        return { error: `Unable to load inventory. ${slabError.message}`, slabs: [], totalLots: 0, totalPages: 0, totalSlabs: 0 };
      }

      return {
        error: null,
        slabs: ((slabData as InventorySlabRow[] | null) ?? [])
          .map(normalizeInventorySlab)
          .filter((row): row is InventoryListSlab => row !== null),
        totalLots,
        totalPages,
        totalSlabs,
      };
    }

    // ── Non-paginated path ──────────────────────────────────────────────────
    // Used by dashboard, export, movement, and quotations — they need all slabs.

    let query = supabase
      .from("slabs")
      .select(SLAB_SELECT);

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
      const safe = sanitizeSearch(filters.search);
      if (safe) {
        const { data: matchingLots } = await supabase
          .from("marble_lots")
          .select("id")
          .ilike("marble_name", `%${safe}%`);
        const matchingLotIds = (matchingLots ?? []).map((r) => String(r.id));
        if (matchingLotIds.length > 0) {
          query = query.or(`slab_code.ilike.%${safe}%,lot_id.in.(${matchingLotIds.join(",")})`);
        } else {
          query = query.ilike("slab_code", `%${safe}%`);
        }
      }
    }

    query = query.order(column, { ascending }).limit(MAX_SLAB_ROWS);

    const { data, error } = await query;

    if (error) {
      return {
        error: `Unable to load inventory. ${error.message}`,
        slabs: [],
        totalLots: 0,
        totalPages: 0,
        totalSlabs: 0,
      };
    }

    return {
      error: null,
      slabs: ((data as InventorySlabRow[] | null) ?? [])
        .map(normalizeInventorySlab)
        .filter((row): row is InventoryListSlab => row !== null),
      totalLots: 0,
      totalPages: 0,
      totalSlabs: 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Please try again.";

    return {
      error: `Unable to load inventory. ${message}`,
      slabs: [],
      totalLots: 0,
      totalPages: 0,
      totalSlabs: 0,
    };
  }
}
