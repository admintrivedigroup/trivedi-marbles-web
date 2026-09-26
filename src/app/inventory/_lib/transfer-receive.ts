import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceiveSlabInput = {
  itemId: string;
  slabId: string;
  rackNumber: string | null;
  notes: string | null;
};

export type ReceiveTransferOutcome = { error: string | null };

type SlabSnapshot = { id: string; warehouse_id: unknown; rack_number: string | null };

/** Receives a transfer with all-or-nothing behaviour.
 *
 * Supabase can't run several statements in one transaction from the client, so this
 * claims the transfer first (a conditional in_transit → received update, which also
 * stops two people receiving the same transfer), then moves the slabs, and if any
 * step fails it puts every slab back and re-opens the transfer. If the undo itself
 * fails the returned error says so, so the inconsistency is visible rather than hidden. */
export async function receiveTransferSlabs(
  db: SupabaseClient,
  args: { transferId: string; toWarehouseId: string; slabs: ReceiveSlabInput[] },
): Promise<ReceiveTransferOutcome> {
  const { transferId, toWarehouseId, slabs } = args;
  const slabIds = slabs.map((s) => s.slabId);

  const { data: before, error: snapshotError } = await db
    .from("slabs")
    .select("id, warehouse_id, rack_number")
    .in("id", slabIds);
  if (snapshotError || !before) {
    return { error: `Failed to read slabs before receiving. ${snapshotError?.message ?? ""}`.trim() };
  }
  const snapshots = new Map((before as SlabSnapshot[]).map((s) => [String(s.id), s]));

  const { data: claimed, error: claimError } = await db
    .from("transfer_requests")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("status", "in_transit")
    .select("id");
  if (claimError) return { error: `Failed to mark transfer as received. ${claimError.message}` };
  if (!claimed || claimed.length === 0) {
    return { error: "Transfer not found or already received." };
  }

  const moved: string[] = [];
  let failure: string | null = null;

  // Slabs with no rack change move in one statement; the rest need their own row update.
  const plain = slabs.filter((s) => !s.rackNumber).map((s) => s.slabId);
  if (plain.length > 0) {
    const { error } = await db.from("slabs").update({ warehouse_id: toWarehouseId }).in("id", plain);
    if (error) failure = error.message;
    else moved.push(...plain);
  }

  if (!failure) {
    for (const slab of slabs.filter((s) => s.rackNumber)) {
      const { error } = await db
        .from("slabs")
        .update({ warehouse_id: toWarehouseId, rack_number: slab.rackNumber })
        .eq("id", slab.slabId);
      if (error) {
        failure = error.message;
        break;
      }
      moved.push(slab.slabId);
    }
  }

  if (failure) {
    const rollbackFailures: string[] = [];

    for (const slabId of moved) {
      const original = snapshots.get(slabId);
      if (!original) continue;
      const { error } = await db
        .from("slabs")
        .update({ warehouse_id: original.warehouse_id, rack_number: original.rack_number })
        .eq("id", slabId);
      if (error) rollbackFailures.push(slabId);
    }

    const { error: reopenError } = await db
      .from("transfer_requests")
      .update({ status: "in_transit", received_at: null })
      .eq("id", transferId);
    if (reopenError) rollbackFailures.push(`transfer ${transferId}`);

    if (rollbackFailures.length > 0) {
      return {
        error: `Receiving failed (${failure}) and could not be fully undone — check ${rollbackFailures.length} record(s) manually: ${rollbackFailures.join(", ")}.`,
      };
    }
    return { error: `Receiving failed, nothing was changed. ${failure}` };
  }

  // Per-slab rack/notes are bookkeeping on the transfer record; the slabs have already
  // moved correctly, so a failure here is logged rather than undoing a good receive.
  for (const slab of slabs) {
    if (!slab.rackNumber && !slab.notes) continue;
    const { error } = await db
      .from("transfer_request_items")
      .update({ new_rack_number: slab.rackNumber, received_notes: slab.notes })
      .eq("id", slab.itemId);
    if (error) console.error("Failed to save transfer item details:", error.message);
  }

  return { error: null };
}
