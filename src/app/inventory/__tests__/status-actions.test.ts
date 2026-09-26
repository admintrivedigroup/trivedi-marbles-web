import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDbOptions } from "./helpers/fake-db";

const ctx = vi.hoisted(() => ({
  db: null as unknown,
  warehouseIds: null as string[] | null,
  inTransit: new Set<string>(),
  logAudit: vi.fn(async () => {}),
  lowStock: vi.fn(async () => {}),
  statusNotify: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (ctx.db as { client: unknown }).client }));
vi.mock("@/app/inventory/_lib/action-auth", () => ({
  requirePermission: async () => ({ ok: true, profile: { warehouseIds: ctx.warehouseIds } }),
}));
vi.mock("@/app/inventory/_lib/audit", () => ({ logAudit: ctx.logAudit }));
vi.mock("@/app/inventory/_lib/low-stock", () => ({ notifyLowStockForSlabIds: ctx.lowStock }));
vi.mock("@/app/inventory/_lib/stock-movement-notify", () => ({ notifyStatusChange: ctx.statusNotify }));
vi.mock("@/app/inventory/_lib/transfers", () => ({ getInTransitSlabIds: async () => ctx.inTransit }));

import { updateSlabStatus } from "@/app/inventory/_actions/update-slab-status";
import { batchUpdateSlabsStatus } from "@/app/inventory/_actions/batch-update-slab-status";
import { updateLotSlabsStatus } from "@/app/inventory/_actions/update-lot-status";

const FUTURE = "2099-12-31";
const RESERVE = { reservedFor: "Asha", reservedUntil: FUTURE };

const STATUS = { Available: 1, Reserved: 2, Sold: 3 } as const;

function slab(id: number, status: keyof typeof STATUS, extra: Record<string, unknown> = {}) {
  return {
    id,
    slab_code: `S-${id}`,
    lot_id: 100,
    warehouse_id: 10,
    status_id: STATUS[status],
    slab_statuses: { name: status },
    reserved_for: null,
    reserved_until: null,
    deleted_at: null,
    ...extra,
  };
}

function seed(slabs: ReturnType<typeof slab>[], options: FakeDbOptions = {}) {
  ctx.db = createFakeDb(
    {
      slab_statuses: [
        { id: 1, name: "Available" },
        { id: 2, name: "Reserved" },
        { id: 3, name: "Sold" },
      ],
      slabs,
      marble_lots: [{ id: 100, lot_number: "L-100", marble_name: "Carrara" }],
    },
    options,
  );
  return ctx.db as ReturnType<typeof createFakeDb>;
}

const row = (db: ReturnType<typeof createFakeDb>, id: number) => db.tables.slabs.find((s) => s.id === id)!;

beforeEach(() => {
  ctx.warehouseIds = null;
  ctx.inTransit = new Set();
  vi.clearAllMocks();
});

describe("updateSlabStatus", () => {
  it("reserves an available slab and records who it's for and until when", async () => {
    const db = seed([slab(1, "Available")]);
    const result = await updateSlabStatus("1", "Reserved", { reservedFor: " Asha ", reservedUntil: FUTURE });

    expect(result.error).toBeNull();
    expect(row(db, 1)).toMatchObject({ status_id: 2, reserved_for: "Asha", reserved_until: FUTURE });
    expect(ctx.logAudit).toHaveBeenCalledTimes(1);
    expect(ctx.lowStock).toHaveBeenCalledWith(["1"]);
  });

  it("clears the reservation when a reserved slab is sold (was left stale before)", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: FUTURE })]);
    const result = await updateSlabStatus("1", "Sold");

    expect(result.error).toBeNull();
    expect(row(db, 1)).toMatchObject({ status_id: 3, reserved_for: null, reserved_until: null });
  });

  it("releases a reservation back to Available", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: FUTURE })]);
    await updateSlabStatus("1", "Available");
    expect(row(db, 1)).toMatchObject({ status_id: 1, reserved_for: null, reserved_until: null });
  });

  it("refuses to reserve a sold slab", async () => {
    const db = seed([slab(1, "Sold")]);
    const result = await updateSlabStatus("1", "Reserved", RESERVE);
    expect(result.error).toMatch(/sold/i);
    expect(row(db, 1).status_id).toBe(3);
    expect(ctx.logAudit).not.toHaveBeenCalled();
  });

  it("refuses to take over a slab reserved for someone else", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Ravi", reserved_until: FUTURE })]);
    const result = await updateSlabStatus("1", "Reserved", RESERVE);
    expect(result.error).toMatch(/already reserved for Ravi/);
    expect(row(db, 1).reserved_for).toBe("Ravi");
  });

  it("lets the same customer renew their reservation", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: "2099-01-01" })]);
    const result = await updateSlabStatus("1", "Reserved", RESERVE);
    expect(result.error).toBeNull();
    expect(row(db, 1).reserved_until).toBe(FUTURE);
  });

  it("rejects a reservation dated in the past, or with no details, before touching anything", async () => {
    const db = seed([slab(1, "Available")]);
    expect((await updateSlabStatus("1", "Reserved", { reservedFor: "A", reservedUntil: "2000-01-01" })).error).toMatch(
      /past/,
    );
    expect((await updateSlabStatus("1", "Reserved")).error).toMatch(/required/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a slab that's in a pending transfer", async () => {
    const db = seed([slab(1, "Available")]);
    ctx.inTransit = new Set(["1"]);
    const result = await updateSlabStatus("1", "Sold");
    expect(result.error).toMatch(/pending transfer/);
    expect(row(db, 1).status_id).toBe(1);
  });

  it("refuses a user who can't access the slab's warehouse", async () => {
    const db = seed([slab(1, "Available")]);
    ctx.warehouseIds = ["99"];
    expect((await updateSlabStatus("1", "Sold")).error).toMatch(/access/);
    expect(row(db, 1).status_id).toBe(1);

    ctx.warehouseIds = ["10"];
    expect((await updateSlabStatus("1", "Sold")).error).toBeNull();
  });

  it("reports a missing or soft-deleted slab instead of writing", async () => {
    const db = seed([slab(1, "Available", { deleted_at: "2026-01-01" })]);
    expect((await updateSlabStatus("1", "Sold")).error).toBe("Slab not found.");
    expect((await updateSlabStatus("404", "Sold")).error).toBe("Slab not found.");
    expect(db.writes).toHaveLength(0);
  });

  it("detects a concurrent change and doesn't overwrite it", async () => {
    // Someone else sells the slab between our read and our write.
    const db = seed([slab(1, "Available")], {
      failWhen: ({ table, op }) => {
        if (table === "slabs" && op === "update") {
          const live = (ctx.db as ReturnType<typeof createFakeDb>).tables.slabs[0];
          live.status_id = STATUS.Sold;
        }
        return null;
      },
    });
    const result = await updateSlabStatus("1", "Reserved", RESERVE);
    expect(result.error).toMatch(/changed by someone else/);
    expect(row(db, 1)).toMatchObject({ status_id: 3, reserved_for: null });
    expect(ctx.logAudit).not.toHaveBeenCalled();
  });

  it("doesn't fire low-stock or audit when the update errors", async () => {
    seed([slab(1, "Available")], {
      failWhen: ({ table, op }) => (table === "slabs" && op === "update" ? "db down" : null),
    });
    const result = await updateSlabStatus("1", "Sold");
    expect(result.error).toMatch(/db down/);
    expect(ctx.lowStock).not.toHaveBeenCalled();
    expect(ctx.logAudit).not.toHaveBeenCalled();
  });
});

describe("batchUpdateSlabsStatus", () => {
  it("reserves every selected slab", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Available")]);
    const result = await batchUpdateSlabsStatus(["1", "2"], "Reserved", "100", RESERVE);

    expect(result).toEqual({ error: null, updatedCount: 2 });
    expect(db.tables.slabs.every((s) => s.status_id === 2 && s.reserved_for === "Asha")).toBe(true);
    expect(ctx.lowStock).toHaveBeenCalledWith(["1", "2"]);
  });

  it("applies to none of them if any slab no longer qualifies (all-or-nothing)", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Sold")]);
    const result = await batchUpdateSlabsStatus(["1", "2"], "Reserved", "100", RESERVE);

    expect(result.updatedCount).toBe(0);
    expect(result.error).toMatch(/S-2/);
    expect(row(db, 1).status_id).toBe(1);
    expect(db.writes).toHaveLength(0);
  });

  it("rejects ids that aren't in the given lot", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Available", { lot_id: 999 })]);
    const result = await batchUpdateSlabsStatus(["1", "2"], "Sold", "100");
    expect(result.error).toMatch(/no longer exist in this lot/);
    expect(db.writes).toHaveLength(0);
  });

  it("clears reservations when marking sold", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: FUTURE }), slab(2, "Available")]);
    const result = await batchUpdateSlabsStatus(["1", "2"], "Sold", "100");
    expect(result.error).toBeNull();
    expect(db.tables.slabs.every((s) => s.status_id === 3 && s.reserved_for === null)).toBe(true);
  });

  it("blocks slabs in a pending transfer or in an inaccessible warehouse", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Available")]);
    ctx.inTransit = new Set(["2"]);
    expect((await batchUpdateSlabsStatus(["1", "2"], "Sold", "100")).error).toMatch(/pending transfer/);

    ctx.inTransit = new Set();
    ctx.warehouseIds = ["99"];
    expect((await batchUpdateSlabsStatus(["1", "2"], "Sold", "100")).error).toMatch(/access/);
    expect(db.writes).toHaveLength(0);
  });

  it("validates the reservation up front", async () => {
    const db = seed([slab(1, "Available")]);
    const result = await batchUpdateSlabsStatus(["1"], "Reserved", "100", { reservedFor: "", reservedUntil: FUTURE });
    expect(result.error).toMatch(/name/i);
    expect(db.writes).toHaveLength(0);
  });

  it("does nothing for an empty selection", async () => {
    seed([]);
    expect(await batchUpdateSlabsStatus([], "Sold", "100")).toEqual({ error: null, updatedCount: 0 });
  });
});

describe("updateLotSlabsStatus", () => {
  it("reserves available slabs but skips ones in a pending transfer", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Available"), slab(3, "Sold")]);
    ctx.inTransit = new Set(["2"]);

    const result = await updateLotSlabsStatus("100", "Reserved", RESERVE);

    expect(result).toEqual({ error: null, updatedCount: 1 });
    expect(row(db, 1)).toMatchObject({ status_id: 2, reserved_for: "Asha" });
    expect(row(db, 2).status_id).toBe(1);
    expect(row(db, 3).status_id).toBe(3);
  });

  it("skips slabs in warehouses the user can't access", async () => {
    const db = seed([slab(1, "Available"), slab(2, "Available", { warehouse_id: 20 })]);
    ctx.warehouseIds = ["10"];
    const result = await updateLotSlabsStatus("100", "Sold");
    expect(result.updatedCount).toBe(1);
    expect(row(db, 2).status_id).toBe(1);
  });

  it("sells reserved slabs and clears their reservation, then checks low stock (previously never checked here)", async () => {
    const db = seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: FUTURE }), slab(2, "Available")]);
    const result = await updateLotSlabsStatus("100", "Sold");

    expect(result.updatedCount).toBe(2);
    expect(db.tables.slabs.every((s) => s.status_id === 3 && s.reserved_for === null)).toBe(true);
    expect(ctx.lowStock).toHaveBeenCalledWith(["1", "2"]);
  });

  it("does not check low stock when stock goes back up", async () => {
    seed([slab(1, "Reserved", { reserved_for: "Asha", reserved_until: FUTURE })]);
    await updateLotSlabsStatus("100", "UnreserveLot");
    expect(ctx.lowStock).not.toHaveBeenCalled();
  });

  it("rejects a past reservation date", async () => {
    const db = seed([slab(1, "Available")]);
    const result = await updateLotSlabsStatus("100", "Reserved", { reservedFor: "A", reservedUntil: "2000-01-01" });
    expect(result.error).toMatch(/past/);
    expect(db.writes).toHaveLength(0);
  });

  it("reports when nothing qualifies", async () => {
    seed([slab(1, "Sold")]);
    const result = await updateLotSlabsStatus("100", "Reserved", RESERVE);
    expect(result.error).toMatch(/No available slabs/);
    expect(result.updatedCount).toBe(0);
  });

  it("un-sells sold slabs", async () => {
    const db = seed([slab(1, "Sold")]);
    const result = await updateLotSlabsStatus("100", "UnsellLot");
    expect(result.updatedCount).toBe(1);
    expect(row(db, 1).status_id).toBe(1);
  });
});
