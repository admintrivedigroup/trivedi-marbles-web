import { describe, expect, it, vi } from "vitest";

import { receiveTransferSlabs } from "@/app/inventory/_lib/transfer-receive";
import { createFakeDb, type FakeDbOptions } from "./helpers/fake-db";

function setup(options: FakeDbOptions = {}) {
  return createFakeDb(
    {
      slabs: [
        { id: 1, warehouse_id: 10, rack_number: "A1" },
        { id: 2, warehouse_id: 10, rack_number: "A2" },
        { id: 3, warehouse_id: 10, rack_number: "A3" },
      ],
      transfer_requests: [{ id: "t1", status: "in_transit", received_at: null }],
      transfer_request_items: [
        { id: "i1", slab_id: 1, new_rack_number: null, received_notes: null },
        { id: "i2", slab_id: 2, new_rack_number: null, received_notes: null },
        { id: "i3", slab_id: 3, new_rack_number: null, received_notes: null },
      ],
    },
    options,
  );
}

const slabsInput = [
  { itemId: "i1", slabId: "1", rackNumber: null, notes: null },
  { itemId: "i2", slabId: "2", rackNumber: "B7", notes: "chipped corner" },
  { itemId: "i3", slabId: "3", rackNumber: "B8", notes: null },
];

const receive = (db: ReturnType<typeof setup>) =>
  receiveTransferSlabs(db.client as never, { transferId: "t1", toWarehouseId: "20", slabs: slabsInput });

describe("receiveTransferSlabs", () => {
  it("moves every slab, applies racks, records item notes and marks the transfer received", async () => {
    const db = setup();
    const result = await receive(db);

    expect(result.error).toBeNull();
    expect(db.tables.slabs.map((s) => [s.warehouse_id, s.rack_number])).toEqual([
      ["20", "A1"], // no rack given: keeps its current rack
      ["20", "B7"],
      ["20", "B8"],
    ]);
    expect(db.tables.transfer_requests[0].status).toBe("received");
    expect(db.tables.transfer_requests[0].received_at).toEqual(expect.any(String));
    expect(db.tables.transfer_request_items[1]).toMatchObject({ new_rack_number: "B7", received_notes: "chipped corner" });
  });

  it("undoes everything when a slab update fails midway (previously left half the slabs moved)", async () => {
    const db = setup({
      // The second slab with a rack (id 3) can't be updated.
      failWhen: ({ table, op, payload, filters }) =>
        table === "slabs" &&
        op === "update" &&
        (payload as { rack_number?: string }).rack_number === "B8" &&
        filters.some((f) => f.column === "id" && String(f.value) === "3")
          ? "row locked"
          : null,
    });

    const result = await receive(db);

    expect(result.error).toMatch(/nothing was changed/);
    expect(result.error).toMatch(/row locked/);
    // Slabs 1 and 2 had already moved; both are back with their original rack.
    expect(db.tables.slabs.map((s) => [s.warehouse_id, s.rack_number])).toEqual([
      [10, "A1"],
      [10, "A2"],
      [10, "A3"],
    ]);
    // The transfer is open again so it can be retried.
    expect(db.tables.transfer_requests[0]).toMatchObject({ status: "in_transit", received_at: null });
    // No half-written item details.
    expect(db.tables.transfer_request_items.every((i) => i.new_rack_number === null)).toBe(true);
  });

  it("refuses a transfer that was already received and touches no slab", async () => {
    const db = setup();
    db.tables.transfer_requests[0].status = "received";

    const result = await receive(db);

    expect(result.error).toMatch(/already received/);
    expect(db.tables.slabs.every((s) => s.warehouse_id === 10)).toBe(true);
  });

  it("only one of two simultaneous receives wins", async () => {
    const db = setup();
    const [a, b] = await Promise.all([receive(db), receive(db)]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
  });

  it("reports which records need manual attention when the undo itself fails", async () => {
    const db = setup({
      failWhen: ({ table, op, payload }) => {
        if (table !== "slabs" || op !== "update") return null;
        const p = payload as { warehouse_id?: unknown; rack_number?: string };
        if (p.rack_number === "B8") return "row locked"; // triggers the rollback
        if (p.warehouse_id === 10) return "still locked"; // rollback writes restore warehouse 10
        return null;
      },
    });

    const result = await receive(db);

    expect(result.error).toMatch(/could not be fully undone/);
    expect(result.error).toMatch(/manually/);
  });

  it("fails cleanly if the claim itself errors, leaving slabs alone", async () => {
    const db = setup({
      failWhen: ({ table, op }) => (table === "transfer_requests" && op === "update" ? "db down" : null),
    });
    const result = await receive(db);
    expect(result.error).toMatch(/db down/);
    expect(db.tables.slabs.every((s) => s.warehouse_id === 10)).toBe(true);
  });

  it("does not undo a good receive if only the item note write fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = setup({
      failWhen: ({ table, op }) => (table === "transfer_request_items" && op === "update" ? "notes failed" : null),
    });

    const result = await receive(db);

    expect(result.error).toBeNull();
    expect(db.tables.slabs.every((s) => s.warehouse_id === "20")).toBe(true);
    expect(db.tables.transfer_requests[0].status).toBe("received");
    errorSpy.mockRestore();
  });
});
