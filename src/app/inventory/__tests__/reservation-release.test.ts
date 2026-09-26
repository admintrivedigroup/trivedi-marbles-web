import { describe, expect, it, vi } from "vitest";

import { releaseExpiredReservations } from "@/app/inventory/_lib/reservation-reminders";
import { createFakeDb } from "./helpers/fake-db";

const TODAY = "2026-09-21";

function setup() {
  return createFakeDb({
    slab_statuses: [
      { id: 1, name: "Available" },
      { id: 2, name: "Reserved" },
      { id: 3, name: "Sold" },
    ],
    slabs: [
      { id: "expired-a", slab_code: "A-1", status_id: 2, reserved_for: "Asha", reserved_until: "2026-09-20", warehouse_id: "w1", lot_id: "l1", deleted_at: null },
      { id: "expired-b", slab_code: "A-2", status_id: 2, reserved_for: "Ravi", reserved_until: "2026-09-01", warehouse_id: "w1", lot_id: "l1", deleted_at: null },
      { id: "expired-c", slab_code: "B-1", status_id: 2, reserved_for: "Meera", reserved_until: "2026-09-10", warehouse_id: "w2", lot_id: "l2", deleted_at: null },
      { id: "ends-today", slab_code: "A-3", status_id: 2, reserved_for: "Today", reserved_until: TODAY, warehouse_id: "w1", lot_id: "l1", deleted_at: null },
      { id: "future", slab_code: "A-4", status_id: 2, reserved_for: "Later", reserved_until: "2026-10-01", warehouse_id: "w1", lot_id: "l1", deleted_at: null },
      { id: "sold-old", slab_code: "A-5", status_id: 3, reserved_for: null, reserved_until: "2026-01-01", warehouse_id: "w1", lot_id: "l1", deleted_at: null },
      { id: "deleted", slab_code: "A-6", status_id: 2, reserved_for: "Gone", reserved_until: "2026-09-01", warehouse_id: "w1", lot_id: "l1", deleted_at: "2026-09-02" },
    ],
    audit_logs: [],
    notifications: [],
    user_profiles: [
      { user_id: "everyone", reservation_reminders_enabled: true },
      { user_id: "w2-only", reservation_reminders_enabled: true },
      { user_id: "opted-out", reservation_reminders_enabled: false },
    ],
    user_warehouse_access: [{ user_id: "w2-only", warehouse_id: "w2" }],
  });
}

const run = (db: ReturnType<typeof setup>) => releaseExpiredReservations(db.client as never, TODAY);

describe("releaseExpiredReservations", () => {
  it("releases only reservations whose last day has passed", async () => {
    const db = setup();
    const { released } = await run(db);

    expect(released).toBe(3);
    const byId = Object.fromEntries(db.tables.slabs.map((s) => [s.id, s]));

    for (const id of ["expired-a", "expired-b", "expired-c"]) {
      expect(byId[id]).toMatchObject({ status_id: 1, reserved_for: null, reserved_until: null });
    }
    // Ending today is still valid for the rest of today.
    expect(byId["ends-today"]).toMatchObject({ status_id: 2, reserved_for: "Today" });
    expect(byId["future"]).toMatchObject({ status_id: 2, reserved_for: "Later" });
    // Sold and soft-deleted slabs are never touched.
    expect(byId["sold-old"].status_id).toBe(3);
    expect(byId["deleted"]).toMatchObject({ status_id: 2, reserved_for: "Gone" });
  });

  it("writes an audit entry per released slab recording who held it", async () => {
    const db = setup();
    await run(db);

    expect(db.tables.audit_logs).toHaveLength(3);
    const asha = db.tables.audit_logs.find((l) => l.target_label === "A-1");
    expect(asha).toMatchObject({
      action: "slab.reservation_expired",
      target_type: "slab",
      user_id: null,
      diff: { before: "Reserved", after: "Available", reservedFor: "Asha", reservedUntil: "2026-09-20" },
    });
  });

  it("sends one summary notification per recipient per warehouse, honouring opt-in and warehouse access", async () => {
    const db = setup();
    await run(db);

    const byUser = (id: string) => db.tables.notifications.filter((n) => n.user_id === id);

    // w1 had two releases → one combined notification; w2 one → its own. "everyone" sees both.
    expect(byUser("everyone")).toHaveLength(2);
    const w1 = byUser("everyone").find((n) => String(n.title).includes("2 reservations"));
    expect(w1?.body).toMatch(/A-1/);
    expect(w1?.body).toMatch(/A-2/);
    expect(w1).toMatchObject({ type: "reservation_released", link: "/inventory/list" });

    const single = byUser("everyone").find((n) => String(n.title).includes("B-1"));
    expect(single?.link).toBe("/inventory/slab/expired-c");

    // Restricted to w2: only hears about w2. Opted-out: nothing.
    expect(byUser("w2-only")).toHaveLength(1);
    expect(String(byUser("w2-only")[0].title)).toContain("B-1");
    expect(byUser("opted-out")).toHaveLength(0);
  });

  it("is idempotent: a second run releases nothing and notifies no one again", async () => {
    const db = setup();
    await run(db);
    const notificationsAfterFirst = db.tables.notifications.length;

    const second = await run(db);

    expect(second.released).toBe(0);
    expect(db.tables.notifications).toHaveLength(notificationsAfterFirst);
    expect(db.tables.audit_logs).toHaveLength(3);
  });

  it("does nothing when nothing is expired", async () => {
    const db = createFakeDb({
      slab_statuses: [
        { id: 1, name: "Available" },
        { id: 2, name: "Reserved" },
      ],
      slabs: [{ id: "x", slab_code: "X", status_id: 2, reserved_until: "2027-01-01", warehouse_id: "w1", deleted_at: null }],
    });
    expect((await releaseExpiredReservations(db.client as never, TODAY)).released).toBe(0);
    expect(db.tables.slabs[0].status_id).toBe(2);
  });

  it("releases nothing if the write fails", async () => {
    const failing = createFakeDb(
      {
        slab_statuses: [
          { id: 1, name: "Available" },
          { id: 2, name: "Reserved" },
        ],
        slabs: [{ id: "x", slab_code: "X", status_id: 2, reserved_until: "2026-01-01", warehouse_id: "w1", deleted_at: null }],
        audit_logs: [],
        notifications: [],
      },
      { failWhen: ({ table, op }) => (table === "slabs" && op === "update" ? "denied" : null) },
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await releaseExpiredReservations(failing.client as never, TODAY);

    expect(result.released).toBe(0);
    expect(failing.tables.audit_logs).toHaveLength(0);
    expect(failing.tables.notifications).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("leaves a reservation alone if it was renewed after the read (the write re-checks the date)", async () => {
    const db = createFakeDb(
      {
        slab_statuses: [
          { id: 1, name: "Available" },
          { id: 2, name: "Reserved" },
        ],
        slabs: [{ id: "x", slab_code: "X", status_id: 2, reserved_for: "Asha", reserved_until: "2026-09-01", warehouse_id: "w1", deleted_at: null }],
        audit_logs: [],
        notifications: [],
        user_profiles: [{ user_id: "u", reservation_reminders_enabled: true }],
      },
      {
        // A salesperson extends the hold just before the release write lands.
        failWhen: ({ table, op }) => {
          if (table === "slabs" && op === "update") {
            const live = (db as unknown as { tables: Record<string, Record<string, unknown>[]> }).tables.slabs[0];
            live.reserved_until = "2026-12-31";
          }
          return null;
        },
      },
    );

    const result = await releaseExpiredReservations(db.client as never, TODAY);

    expect(result.released).toBe(0);
    expect(db.tables.slabs[0]).toMatchObject({ status_id: 2, reserved_for: "Asha", reserved_until: "2026-12-31" });
    expect(db.tables.audit_logs).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(0);
  });
});
