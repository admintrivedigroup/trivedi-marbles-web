import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/app/inventory/_lib/fetch-all";
import { relLot, toStr } from "@/app/inventory/_lib/normalize";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import {
  AGE_MILESTONES,
  buildSlowMovingLots,
  milestoneFor,
  type AgeMilestone,
  type AgeingSlab,
  type SlowMovingLot,
} from "@/app/inventory/_lib/stock-ageing";

type AdminClient = ReturnType<typeof createAdminClient>;

type UnsoldSlabRow = {
  id: unknown;
  lot_id: unknown;
  created_at: string | null;
  warehouse_id: unknown;
  status_id: unknown;
  sqft: number | string | null;
  marble_lots: unknown;
};

type Crossing = { lot: SlowMovingLot & { lotId: string }; milestone: AgeMilestone; warehouseIds: Set<string> };

const LOTS_NAMED_IN_BODY = 3;
// Same ceiling as the inventory list; the digest only needs unsold slabs, so it's far off.
const MAX_UNSOLD_ROWS = 20000;

/** Called daily by the /api/cron/reservation-reminders route. Finds lots whose oldest
 * unsold slab has passed a new age milestone (90 / 180 / 365 days) since the last run
 * and sends each admin and superadmin one digest notification covering the lots they
 * can see. Deduped per (lot, milestone, oldest slab date) via slow_stock_alert_log, so
 * re-running is a no-op and a lot that jumps several milestones at once (e.g. the first
 * run) is reported only at the highest one. */
export async function notifySlowMovingStock(
  admin: AdminClient = createAdminClient(),
  now: Date = new Date(),
): Promise<{ lots: number; notified: number }> {
  const { data: statuses } = await admin
    .from("slab_statuses")
    .select("id, name")
    .in("name", [SLAB_STATUS.AVAILABLE, SLAB_STATUS.RESERVED]);
  const statusName = new Map((statuses ?? []).map((s) => [String(s.id), String(s.name)]));
  if (statusName.size === 0) return { lots: 0, notified: 0 };

  const { rows, error } = await fetchAllPages<UnsoldSlabRow>(
    (from, to) =>
      admin
        .from("slabs")
        .select("id, lot_id, created_at, warehouse_id, status_id, sqft, marble_lots(lot_number, marble_name)")
        .in("status_id", [...statusName.keys()])
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: UnsoldSlabRow[] | null; error: { message: string } | null }>,
    { maxRows: MAX_UNSOLD_ROWS },
  );
  if (error) {
    console.error("notifySlowMovingStock: failed to load slabs:", error);
    return { lots: 0, notified: 0 };
  }

  // Slabs outside any lot have no stable id to dedupe on, so the digest covers lots only.
  const inLots = rows.filter((r) => r.lot_id != null);
  const warehousesByLot = new Map<string, Set<string>>();
  const slabs: AgeingSlab[] = inLots.map((r) => {
    const lotId = String(r.lot_id);
    const set = warehousesByLot.get(lotId) ?? new Set<string>();
    if (r.warehouse_id != null) set.add(String(r.warehouse_id));
    warehousesByLot.set(lotId, set);

    const lot = relLot(r.marble_lots);
    return {
      createdAt: r.created_at,
      lotId,
      lotNumber: toStr(lot?.lot_number),
      marbleName: toStr(lot?.marble_name),
      categoryName: null,
      warehouseName: null,
      statusName: statusName.get(String(r.status_id)) ?? null,
      sqft: r.sqft == null ? null : Number(r.sqft),
      sellingPrice: null,
    };
  });

  const lots = buildSlowMovingLots(slabs, { minDays: AGE_MILESTONES[0], now }).filter(
    (l): l is SlowMovingLot & { lotId: string } => l.lotId !== null,
  );
  if (lots.length === 0) return { lots: 0, notified: 0 };

  const { data: logRows } = await admin
    .from("slow_stock_alert_log")
    .select("lot_id, milestone, oldest_added_at")
    .in("lot_id", lots.map((l) => l.lotId));

  // Highest milestone already reported for each (lot, oldest slab) pair.
  const reported = new Map<string, number>();
  for (const row of logRows ?? []) {
    const key = `${row.lot_id}|${new Date(String(row.oldest_added_at)).getTime()}`;
    reported.set(key, Math.max(reported.get(key) ?? 0, Number(row.milestone)));
  }

  const crossings: Crossing[] = [];
  for (const lot of lots) {
    const milestone = milestoneFor(lot.ageDays);
    if (milestone === null) continue;
    const key = `${lot.lotId}|${new Date(lot.oldestAddedAt).getTime()}`;
    if ((reported.get(key) ?? 0) >= milestone) continue;
    crossings.push({ lot, milestone, warehouseIds: warehousesByLot.get(lot.lotId) ?? new Set() });
  }
  if (crossings.length === 0) return { lots: 0, notified: 0 };

  // Log first so a failure below can't cause a repeat tomorrow; worst case a lot is
  // skipped rather than reported twice (same trade-off as reservation reminders).
  await admin.from("slow_stock_alert_log").upsert(
    crossings.map((c) => ({ lot_id: c.lot.lotId, milestone: c.milestone, oldest_added_at: c.lot.oldestAddedAt })),
  );

  const recipients = await adminRecipients(admin);
  const notifications = recipients.flatMap(({ userId, warehouseIds }) => {
    const visible =
      warehouseIds === null
        ? crossings
        : crossings.filter((c) => [...c.warehouseIds].some((w) => warehouseIds.has(w)));
    if (visible.length === 0) return [];
    return [{ user_id: userId, type: "slow_stock", ...digestText(visible) }];
  });

  if (notifications.length > 0) {
    const { error: insertError } = await admin.from("notifications").insert(notifications);
    if (insertError) console.error("notifySlowMovingStock: failed to notify:", insertError.message);
  }
  return { lots: crossings.length, notified: notifications.length };
}

function lotLabel(lot: SlowMovingLot): string {
  return lot.lotNumber ? `${lot.marbleName} (Lot ${lot.lotNumber})` : lot.marbleName;
}

function milestoneText(milestone: number): string {
  return milestone >= 365 ? "a year" : `${milestone} days`;
}

function digestText(crossings: Crossing[]): { title: string; body: string; link: string } {
  const sorted = [...crossings].sort((a, b) => b.lot.ageDays - a.lot.ageDays);
  const lowest = Math.min(...sorted.map((c) => c.milestone));
  const link = `/inventory/reports/slow-moving?min=${lowest}`;

  if (sorted.length === 1) {
    const { lot, milestone } = sorted[0];
    const slabs = lot.availableSlabs + lot.reservedSlabs;
    return {
      title: `${lotLabel(lot)} unsold for over ${milestoneText(milestone)}`,
      body: `${slabs} slab${slabs === 1 ? "" : "s"} (${lot.sqft} sqft) still in stock.`,
      link: `/inventory/lot/${lot.lotId}`,
    };
  }

  const named = sorted.slice(0, LOTS_NAMED_IN_BODY).map((c) => lotLabel(c.lot)).join(", ");
  const more = sorted.length > LOTS_NAMED_IN_BODY ? ` and ${sorted.length - LOTS_NAMED_IN_BODY} more` : "";
  return {
    title: `${sorted.length} lots unsold for over ${milestoneText(lowest)}`,
    body: `${named}${more}.`,
    link,
  };
}

/** Admins and superadmins, with the warehouses they're limited to (null = all). */
async function adminRecipients(
  admin: AdminClient,
): Promise<{ userId: string; warehouseIds: Set<string> | null }[]> {
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, role")
    .in("role", ["admin", "superadmin"]);
  const ids = (profiles ?? []).map((p) => String(p.user_id));
  if (ids.length === 0) return [];

  const { data: accessRows } = await admin
    .from("user_warehouse_access")
    .select("user_id, warehouse_id")
    .in("user_id", ids);

  const access = new Map<string, Set<string>>();
  for (const row of accessRows ?? []) {
    const set = access.get(String(row.user_id)) ?? new Set<string>();
    set.add(String(row.warehouse_id));
    access.set(String(row.user_id), set);
  }
  return ids.map((userId) => ({ userId, warehouseIds: access.get(userId) ?? null }));
}
