import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDbOptions } from "./helpers/fake-db";

const ctx = vi.hoisted(() => ({
  db: null as unknown,
  warehouseIds: null as string[] | null,
  inTransit: new Set<string>(),
  logAudit: vi.fn(async () => {}),
  lowStockMoved: vi.fn(async () => {}),
  notifyTransfer: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (ctx.db as { client: unknown }).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (ctx.db as { client: unknown }).client }));
vi.mock("@/app/inventory/_lib/action-auth", () => ({
  requirePermission: async () => ({ ok: true, profile: { warehouseIds: ctx.warehouseIds } }),
}));
vi.mock("@/app/inventory/_lib/audit", () => ({ logAudit: ctx.logAudit }));
vi.mock("@/app/inventory/_lib/low-stock", () => ({ notifyLowStockForMovedSlabs: ctx.lowStockMoved }));
vi.mock("@/app/inventory/_lib/stock-movement-notify", () => ({ notifyTransfer: ctx.notifyTransfer }));
vi.mock("@/app/inventory/_lib/transfers", () => ({ getInTransitSlabIds: async () => ctx.inTransit }));

import {
  createTransferRequest,
  receiveTransfer,
  saveBatchMovement,
  saveMovement,
} from "@/app/inventory/_actions/movement";

function slab(id: number, warehouseId: number, rack = `R${id}`) {
  return {
    id,
    slab_code: `S-${id}`,
    warehouse_id: warehouseId,
    rack_number: rack,
    warehouses: { name: warehouseId === 10 ? "Ambaji" : "Ahmedabad" },
    deleted_at: null,
  };
}

function seed(extra: Record<string, Record<string, unknown>[]> = {}, options: FakeDbOptions = {}) {
  ctx.db = createFakeDb(
    {
      slabs: [slab(1, 10), slab(2, 10), slab(3, 20)],
      warehouses: [
        { id: 10, name: "Ambaji" },
        { id: 20, name: "Ahmedabad" },
      ],
      slab_movements: [],
      transfer_requests: [],
      transfer_request_items: [],
      ...extra,
    },
    options,
  );
  return ctx.db as ReturnType<typeof createFakeDb>;
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const whereOf = (db: ReturnType<typeof createFakeDb>, id: number) =>
  db.tables.slabs.find((s) => s.id === id)!.warehouse_id;

beforeEach(() => {
  ctx.warehouseIds = null;
  ctx.inTransit = new Set();
  vi.clearAllMocks();
});

describe("saveMovement (direct move)", () => {
  it("moves the slab, logs the movement and checks low stock at the warehouse it left", async () => {
    const db = seed();
    const result = await saveMovement(form({ slabId: "1", toWarehouseId: "20", notes: "for showroom" }));

    expect(result).toEqual({ error: null, status: "success" });
    expect(whereOf(db, 1)).toBe("20");
    expect(db.tables.slab_movements).toHaveLength(1);
    expect(db.tables.slab_movements[0]).toMatchObject({ from_location: "Ambaji", to_location: "Ahmedabad" });
    expect(ctx.lowStockMoved).toHaveBeenCalledWith([{ slabId: "1", fromWarehouseId: "10" }]);
  });

  it("puts the slab back if the history entry can't be written (no move without a record)", async () => {
    const db = seed({}, { failWhen: ({ table, op }) => (table === "slab_movements" && op === "insert" ? "log down" : null) });
    const result = await saveMovement(form({ slabId: "1", toWarehouseId: "20" }));

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/not moved/);
    expect(whereOf(db, 1)).toBe(10);
    expect(ctx.lowStockMoved).not.toHaveBeenCalled();
  });

  it("refuses a slab already in a pending transfer", async () => {
    const db = seed();
    ctx.inTransit = new Set(["1"]);
    const result = await saveMovement(form({ slabId: "1", toWarehouseId: "20" }));
    expect(result.error).toMatch(/pending transfer/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a user restricted away from the slab's warehouse", async () => {
    const db = seed();
    ctx.warehouseIds = ["20"];
    const result = await saveMovement(form({ slabId: "1", toWarehouseId: "20" }));
    expect(result.error).toMatch(/access/);
    expect(whereOf(db, 1)).toBe(10);
  });

  it("refuses a soft-deleted slab", async () => {
    const db = seed({ slabs: [{ ...slab(1, 10), deleted_at: "2026-01-01" }] });
    expect((await saveMovement(form({ slabId: "1", toWarehouseId: "20" }))).error).toBe("Slab not found.");
    expect(db.writes).toHaveLength(0);
  });
});

describe("saveBatchMovement", () => {
  it("moves all slabs and checks low stock against each slab's own source warehouse", async () => {
    const db = seed({ slabs: [slab(1, 10), slab(2, 10), slab(3, 30)], warehouses: [{ id: 10, name: "Ambaji" }, { id: 20, name: "Ahmedabad" }, { id: 30, name: "Depot" }] });
    const result = await saveBatchMovement(form({ slabIds: "1,2,3", toWarehouseId: "20" }));

    expect(result).toMatchObject({ error: null, transferred: 3 });
    expect(db.tables.slabs.every((s) => s.warehouse_id === "20")).toBe(true);
    expect(ctx.lowStockMoved).toHaveBeenCalledWith([
      { slabId: "1", fromWarehouseId: "10" },
      { slabId: "2", fromWarehouseId: "10" },
      { slabId: "3", fromWarehouseId: "30" },
    ]);
  });

  it("restores each slab to its own source if the history write fails", async () => {
    const db = seed(
      { slabs: [slab(1, 10), slab(2, 30)], warehouses: [{ id: 10, name: "Ambaji" }, { id: 20, name: "Ahmedabad" }, { id: 30, name: "Depot" }] },
      { failWhen: ({ table, op }) => (table === "slab_movements" && op === "insert" ? "log down" : null) },
    );
    const result = await saveBatchMovement(form({ slabIds: "1,2", toWarehouseId: "20" }));

    expect(result.error).toMatch(/no slabs were moved/);
    expect(result.transferred).toBe(0);
    expect([whereOf(db, 1), whereOf(db, 2)]).toEqual(["10", "30"]);
  });

  it("refuses when any selected slab is missing, in transit, or out of the user's access", async () => {
    const db = seed();
    expect((await saveBatchMovement(form({ slabIds: "1,999", toWarehouseId: "20" }))).error).toMatch(/no longer exist/);

    ctx.inTransit = new Set(["2"]);
    expect((await saveBatchMovement(form({ slabIds: "1,2", toWarehouseId: "20" }))).error).toMatch(/pending transfer/);

    ctx.inTransit = new Set();
    ctx.warehouseIds = ["20"];
    expect((await saveBatchMovement(form({ slabIds: "1,2", toWarehouseId: "20" }))).error).toMatch(/access/);
    expect(db.writes).toHaveLength(0);
  });
});

describe("createTransferRequest", () => {
  it("creates one transfer with an item per slab", async () => {
    const db = seed();
    const result = await createTransferRequest(form({ slabIds: "1,2", toWarehouseId: "20" }));

    expect(result).toMatchObject({ error: null, transferred: 2 });
    expect(db.tables.transfer_requests).toHaveLength(1);
    expect(db.tables.transfer_requests[0]).toMatchObject({ from_warehouse_id: "10", to_warehouse_id: "20" });
    expect(db.tables.transfer_request_items).toHaveLength(2);
  });

  it("refuses slabs from different warehouses (they'd be recorded under the wrong source)", async () => {
    const db = seed({ slabs: [slab(1, 10), slab(2, 30)] });
    const result = await createTransferRequest(form({ slabIds: "1,2", toWarehouseId: "20" }));
    expect(result.error).toMatch(/different warehouses/);
    expect(db.tables.transfer_requests).toHaveLength(0);
  });

  it("refuses slabs already in a pending transfer", async () => {
    const db = seed();
    ctx.inTransit = new Set(["2"]);
    const result = await createTransferRequest(form({ slabIds: "1,2", toWarehouseId: "20" }));
    expect(result.error).toMatch(/already in a pending transfer/);
    expect(db.tables.transfer_requests).toHaveLength(0);
  });

  it("doesn't leave an empty transfer behind if adding the slabs fails", async () => {
    const db = seed({}, { failWhen: ({ table, op }) => (table === "transfer_request_items" && op === "insert" ? "items failed" : null) });
    const result = await createTransferRequest(form({ slabIds: "1,2", toWarehouseId: "20" }));
    expect(result.error).toMatch(/items failed/);
    expect(db.tables.transfer_requests).toHaveLength(0);
  });
});

describe("receiveTransfer", () => {
  const transfer = {
    id: "t1",
    from_warehouse_id: 10,
    to_warehouse_id: 20,
    status: "in_transit",
    received_at: null,
    from_warehouse: { name: "Ambaji" },
    to_warehouse: { name: "Ahmedabad" },
    transfer_request_items: [
      { id: "i1", slab_id: 1 },
      { id: "i2", slab_id: 2 },
    ],
  };
  const items = [
    { id: "i1", slab_id: 1, new_rack_number: null, received_notes: null },
    { id: "i2", slab_id: 2, new_rack_number: null, received_notes: null },
  ];

  it("receives the transfer, logs it, and checks low stock at the source warehouse", async () => {
    const db = seed({ transfer_requests: [{ ...transfer }], transfer_request_items: items.map((i) => ({ ...i })) });
    const result = await receiveTransfer(
      form({ transferId: "t1", items: JSON.stringify({ "1": { rackNumber: "Z9", notes: "" } }) }),
    );

    expect(result).toEqual({ error: null, status: "success" });
    expect(db.tables.slabs.filter((s) => [1, 2].includes(s.id as number)).every((s) => s.warehouse_id === "20")).toBe(true);
    expect(db.tables.slabs.find((s) => s.id === 1)!.rack_number).toBe("Z9");
    expect(db.tables.transfer_requests[0].status).toBe("received");
    expect(db.tables.slab_movements).toHaveLength(2);
    expect(ctx.lowStockMoved).toHaveBeenCalledWith([
      { slabId: "1", fromWarehouseId: "10" },
      { slabId: "2", fromWarehouseId: "10" },
    ]);
  });

  it("leaves everything as it was when a slab can't be moved, and sends no history or alerts", async () => {
    const db = seed(
      { transfer_requests: [{ ...transfer }], transfer_request_items: items.map((i) => ({ ...i })) },
      {
        failWhen: ({ table, op, payload }) =>
          table === "slabs" && op === "update" && (payload as { rack_number?: string }).rack_number === "Z9" ? "row locked" : null,
      },
    );
    const result = await receiveTransfer(
      form({ transferId: "t1", items: JSON.stringify({ "2": { rackNumber: "Z9", notes: "" } }) }),
    );

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/nothing was changed/);
    expect([whereOf(db, 1), whereOf(db, 2)]).toEqual([10, 10]);
    expect(db.tables.transfer_requests[0].status).toBe("in_transit");
    expect(db.tables.slab_movements).toHaveLength(0);
    expect(ctx.lowStockMoved).not.toHaveBeenCalled();
    expect(ctx.notifyTransfer).not.toHaveBeenCalled();
  });

  it("refuses a user without access to the destination warehouse", async () => {
    const db = seed({ transfer_requests: [{ ...transfer }], transfer_request_items: items.map((i) => ({ ...i })) });
    ctx.warehouseIds = ["10"];
    const result = await receiveTransfer(form({ transferId: "t1" }));
    expect(result.error).toMatch(/destination/);
    expect(db.tables.transfer_requests[0].status).toBe("in_transit");
  });

  it("won't receive the same transfer twice", async () => {
    seed({ transfer_requests: [{ ...transfer }], transfer_request_items: items.map((i) => ({ ...i })) });
    expect((await receiveTransfer(form({ transferId: "t1" }))).error).toBeNull();
    expect((await receiveTransfer(form({ transferId: "t1" }))).error).toMatch(/already received/);
  });
});
