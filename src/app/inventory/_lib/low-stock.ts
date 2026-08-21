import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

type AdminClient = ReturnType<typeof createAdminClient>;

// How long to wait before re-notifying about the same (category, warehouse)
// pair once it's already been flagged as low, so a run of writes while
// stock stays low doesn't spam every opted-in user on every single write.
const LOW_STOCK_COOLDOWN_HOURS = 12;

export type InventorySettings = {
  lowStockThreshold: number;
};

export async function getInventorySettings(): Promise<InventorySettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("inventory_settings")
    .select("low_stock_threshold")
    .eq("id", 1)
    .maybeSingle();

  return { lowStockThreshold: data?.low_stock_threshold ?? 5 };
}

type CategoryWarehousePair = {
  categoryId: string;
  warehouseId: string;
};

function dedupePairs(pairs: CategoryWarehousePair[]): CategoryWarehousePair[] {
  const byKey = new Map<string, CategoryWarehousePair>();
  for (const pair of pairs) {
    if (!pair.categoryId || !pair.warehouseId) continue;
    byKey.set(`${pair.categoryId}:${pair.warehouseId}`, pair);
  }
  return [...byKey.values()];
}

function pairsFromSlabRows(
  rows: { warehouse_id: string | null; marble_lots: { category_id: string | null } | { category_id: string | null }[] | null }[],
): CategoryWarehousePair[] {
  return dedupePairs(
    rows.map((row) => {
      const lot = Array.isArray(row.marble_lots) ? row.marble_lots[0] : row.marble_lots;
      return {
        categoryId: String(lot?.category_id ?? ""),
        warehouseId: String(row.warehouse_id ?? ""),
      };
    }),
  );
}

/** Call fire-and-forget (no await) after a write that could push a
 * category's available count in a warehouse down — a status change away
 * from Available, or a slab delete. Not wired into stock increases (new
 * lots, restores, transfers) or warehouse transfers yet; see low-stock.ts
 * for the current trigger points. */
export async function notifyLowStockForSlabIds(slabIds: string[]): Promise<void> {
  if (slabIds.length === 0) return;
  const admin = createAdminClient();

  const { data } = await admin
    .from("slabs")
    .select("warehouse_id, marble_lots(category_id)")
    .in("id", slabIds);

  await checkLowStockPairs(admin, pairsFromSlabRows(data ?? []));
}

/** Same as notifyLowStockForSlabIds, but for a whole-lot removal where we
 * only have the lot ids (e.g. batchDeleteLots). */
export async function notifyLowStockForLotIds(lotIds: string[]): Promise<void> {
  if (lotIds.length === 0) return;
  const admin = createAdminClient();

  const { data } = await admin
    .from("slabs")
    .select("warehouse_id, marble_lots!inner(category_id)")
    .in("lot_id", lotIds);

  await checkLowStockPairs(admin, pairsFromSlabRows(data ?? []));
}

async function checkLowStockPairs(
  admin: AdminClient,
  pairs: CategoryWarehousePair[],
): Promise<void> {
  if (pairs.length === 0) return;

  const [{ data: availableStatus }, settings] = await Promise.all([
    admin.from("slab_statuses").select("id").eq("name", SLAB_STATUS.AVAILABLE).maybeSingle(),
    getInventorySettings(),
  ]);

  const availableStatusId = availableStatus?.id;
  if (!availableStatusId) return;

  for (const pair of pairs) {
    await checkSinglePair(admin, pair, String(availableStatusId), settings.lowStockThreshold);
  }
}

async function checkSinglePair(
  admin: AdminClient,
  pair: CategoryWarehousePair,
  availableStatusId: string,
  threshold: number,
): Promise<void> {
  const { count } = await admin
    .from("slabs")
    .select("id, marble_lots!inner(category_id)", { count: "exact", head: true })
    .eq("warehouse_id", pair.warehouseId)
    .eq("status_id", availableStatusId)
    .eq("marble_lots.category_id", pair.categoryId)
    .is("deleted_at", null);

  const availableCount = count ?? 0;
  if (availableCount > threshold) return;

  const { data: state } = await admin
    .from("low_stock_state")
    .select("last_notified_at")
    .eq("category_id", pair.categoryId)
    .eq("warehouse_id", pair.warehouseId)
    .maybeSingle();

  if (state?.last_notified_at) {
    const hoursSinceLastNotify =
      (Date.now() - new Date(state.last_notified_at).getTime()) / (60 * 60 * 1000);
    if (hoursSinceLastNotify < LOW_STOCK_COOLDOWN_HOURS) return;
  }

  await admin.from("low_stock_state").upsert({
    category_id: pair.categoryId,
    warehouse_id: pair.warehouseId,
    last_notified_at: new Date().toISOString(),
  });

  await notifyEligibleUsers(admin, pair, availableCount, threshold);
}

async function notifyEligibleUsers(
  admin: AdminClient,
  pair: CategoryWarehousePair,
  availableCount: number,
  threshold: number,
): Promise<void> {
  const [{ data: category }, { data: warehouse }, { data: optedInProfiles }] = await Promise.all([
    admin.from("marble_categories").select("name").eq("id", pair.categoryId).maybeSingle(),
    admin.from("warehouses").select("name").eq("id", pair.warehouseId).maybeSingle(),
    admin.from("user_profiles").select("user_id").eq("low_stock_alerts_enabled", true),
  ]);

  const optedInIds = (optedInProfiles ?? []).map((p) => String(p.user_id));
  if (optedInIds.length === 0) return;

  const { data: accessRows } = await admin
    .from("user_warehouse_access")
    .select("user_id, warehouse_id")
    .in("user_id", optedInIds);

  const restrictedUserIds = new Set((accessRows ?? []).map((r) => String(r.user_id)));
  const allowedForWarehouse = new Set(
    (accessRows ?? [])
      .filter((r) => String(r.warehouse_id) === pair.warehouseId)
      .map((r) => String(r.user_id)),
  );

  const recipients = optedInIds.filter(
    (id) => !restrictedUserIds.has(id) || allowedForWarehouse.has(id),
  );
  if (recipients.length === 0) return;

  const categoryName = category?.name ?? "This category";
  const warehouseName = warehouse?.name ?? "this warehouse";
  const title = `${categoryName} is running low`;
  const body = `${categoryName} in ${warehouseName} has ${availableCount} available slab${
    availableCount === 1 ? "" : "s"
  } left (threshold: ${threshold}).`;

  await admin.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "low_stock",
      title,
      body,
      category_id: pair.categoryId,
      warehouse_id: pair.warehouseId,
    })),
  );
}
