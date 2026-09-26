import { describe, expect, it } from "vitest";

import { notifySlowMovingStock } from "@/app/inventory/_lib/slow-stock-digest";
import { createFakeDb } from "./helpers/fake-db";

const NOW = new Date("2026-09-26T06:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function slabRow(id: string, lotId: string | null, ageDays: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    lot_id: lotId,
    created_at: daysAgo(ageDays),
    warehouse_id: "w1",
    status_id: 1,
    sqft: 40,
    deleted_at: null,
    marble_lots: lotId ? { lot_number: lotId.toUpperCase(), marble_name: `Marble ${lotId}` } : null,
    ...extra,
  };
}

function setup(slabs: Record<string, unknown>[], log: Record<string, unknown>[] = []) {
  return createFakeDb({
    slab_statuses: [
      { id: 1, name: "Available" },
      { id: 2, name: "Reserved" },
      { id: 3, name: "Sold" },
    ],
    slabs,
    slow_stock_alert_log: log,
    notifications: [],
    user_profiles: [
      { user_id: "boss", role: "superadmin" },
      { user_id: "w2-admin", role: "admin" },
      { user_id: "clerk", role: "staff" },
    ],
    user_warehouse_access: [{ user_id: "w2-admin", warehouse_id: "w2" }],
  });
}

const run = (db: ReturnType<typeof setup>) => notifySlowMovingStock(db.client as never, NOW);

describe("notifySlowMovingStock", () => {
  it("reports a lot once, at the highest milestone it has reached", async () => {
    const db = setup([slabRow("s1", "l1", 200), slabRow("s2", "l1", 20)]);

    const result = await run(db);

    expect(result).toEqual({ lots: 1, notified: 1 });
    expect(db.tables.slow_stock_alert_log).toEqual([
      { lot_id: "l1", milestone: 180, oldest_added_at: daysAgo(200) },
    ]);
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0]).toMatchObject({
      user_id: "boss",
      type: "slow_stock",
      title: "Marble l1 (Lot L1) unsold for over 180 days",
      link: "/inventory/lot/l1",
    });
  });

  it("is a no-op when re-run the same day", async () => {
    const db = setup([slabRow("s1", "l1", 200)]);
    await run(db);
    const second = await run(db);

    expect(second).toEqual({ lots: 0, notified: 0 });
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("reports again when an already-reported lot reaches the next milestone", async () => {
    const db = setup([slabRow("s1", "l1", 370)], [
      { lot_id: "l1", milestone: 180, oldest_added_at: daysAgo(370) },
    ]);
    const result = await run(db);

    expect(result.lots).toBe(1);
    expect(db.tables.notifications[0].title).toBe("Marble l1 (Lot L1) unsold for over a year");
  });

  it("ignores sold, deleted, young and lot-less slabs, and never notifies staff", async () => {
    const db = setup([
      slabRow("sold", "l1", 300, { status_id: 3 }),
      slabRow("deleted", "l2", 300, { deleted_at: daysAgo(1) }),
      slabRow("young", "l3", 60),
      slabRow("loose", null, 300),
    ]);
    const result = await run(db);

    expect(result).toEqual({ lots: 0, notified: 0 });
    expect(db.tables.notifications).toHaveLength(0);
  });

  it("sends one digest per admin, limited to lots in warehouses they can see", async () => {
    const db = setup([
      slabRow("a", "l1", 100),
      slabRow("b", "l2", 200, { warehouse_id: "w2" }),
      slabRow("c", "l3", 400, { status_id: 2 }),
    ]);
    const result = await run(db);

    expect(result).toEqual({ lots: 3, notified: 2 });
    const byUser = Object.fromEntries(db.tables.notifications.map((n) => [n.user_id, n]));

    expect(byUser["boss"]).toMatchObject({
      title: "3 lots unsold for over 90 days",
      body: "Marble l3 (Lot L3), Marble l2 (Lot L2), Marble l1 (Lot L1).",
      link: "/inventory/reports/slow-moving?min=90",
    });
    expect(byUser["w2-admin"]).toMatchObject({
      title: "Marble l2 (Lot L2) unsold for over 180 days",
      link: "/inventory/lot/l2",
    });
    expect(byUser["clerk"]).toBeUndefined();
  });
});
