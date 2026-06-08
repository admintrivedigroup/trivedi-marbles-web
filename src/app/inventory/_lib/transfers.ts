import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TransferSlab = {
  itemId: string;
  slabId: string;
  slabCode: string | null;
  marbleName: string | null;
  lotNumber: string | null;
  sqft: number | null;
  currentRackNumber: string | null;
  newRackNumber: string | null;
  receivedNotes: string | null;
};

export type TransferRequest = {
  id: string;
  fromWarehouseId: string;
  fromWarehouseName: string | null;
  toWarehouseId: string;
  toWarehouseName: string | null;
  notes: string | null;
  status: "in_transit" | "received" | "cancelled";
  createdAt: string;
  receivedAt: string | null;
  slabs: TransferSlab[];
};

type WarehouseRel = { name: string | null } | Array<{ name: string | null }> | null;
type MarbleLotsRel = { lot_number: string | null } | Array<{ lot_number: string | null }> | null;
type SlabRel = {
  slab_code: string | null;
  marble_name: string | null;
  sqft: number | null;
  rack_number: string | null;
  marble_lots?: MarbleLotsRel;
} | null;
type TransferItemRow = {
  id: string;
  slab_id: number | string;
  new_rack_number: string | null;
  received_notes: string | null;
  slabs: SlabRel;
};
type TransferRequestRow = {
  id: string;
  from_warehouse_id: number | string;
  to_warehouse_id: number | string;
  notes: string | null;
  status: string;
  created_at: string;
  received_at: string | null;
  from_warehouse: WarehouseRel;
  to_warehouse: WarehouseRel;
  transfer_request_items: TransferItemRow[];
};

const TRANSFER_SELECT = `
  id, from_warehouse_id, to_warehouse_id, notes, status, created_at, received_at,
  from_warehouse:warehouses!transfer_requests_from_warehouse_id_fkey(name),
  to_warehouse:warehouses!transfer_requests_to_warehouse_id_fkey(name),
  transfer_request_items(
    id, slab_id, new_rack_number, received_notes,
    slabs(slab_code, marble_name, sqft, rack_number, marble_lots(lot_number))
  )
` as const;

function getLotNumber(rel: MarbleLotsRel): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.lot_number ?? null;
  return rel.lot_number ?? null;
}

function getWarehouseName(rel: WarehouseRel): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

function normalizeTransfer(row: TransferRequestRow): TransferRequest {
  return {
    id: row.id,
    fromWarehouseId: String(row.from_warehouse_id),
    fromWarehouseName: getWarehouseName(row.from_warehouse),
    toWarehouseId: String(row.to_warehouse_id),
    toWarehouseName: getWarehouseName(row.to_warehouse),
    notes: row.notes,
    status: row.status as TransferRequest["status"],
    createdAt: row.created_at,
    receivedAt: row.received_at,
    slabs: row.transfer_request_items.map((item) => ({
      itemId: item.id,
      slabId: String(item.slab_id),
      slabCode: item.slabs?.slab_code ?? null,
      marbleName: item.slabs?.marble_name ?? null,
      lotNumber: getLotNumber((item.slabs?.marble_lots as MarbleLotsRel) ?? null),
      sqft: item.slabs?.sqft ?? null,
      currentRackNumber: item.slabs?.rack_number ?? null,
      newRackNumber: item.new_rack_number,
      receivedNotes: item.received_notes,
    })),
  };
}

export async function getInTransitSlabIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transfer_requests")
    .select("transfer_request_items(slab_id)")
    .eq("status", "in_transit");

  const ids = new Set<string>();
  for (const t of (data ?? []) as Array<{ transfer_request_items: Array<{ slab_id: number | string }> }>) {
    for (const item of t.transfer_request_items ?? []) {
      ids.add(String(item.slab_id));
    }
  }
  return ids;
}

export async function getIncomingTransfers(
  warehouseIds: string[] | null,
): Promise<TransferRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transfer_requests")
    .select(TRANSFER_SELECT)
    .eq("status", "in_transit")
    .order("created_at", { ascending: false });

  if (warehouseIds !== null && warehouseIds.length > 0) {
    query = query.in("to_warehouse_id", warehouseIds);
  }

  const { data } = await query;
  return ((data ?? []) as unknown as TransferRequestRow[]).map(normalizeTransfer);
}

export async function getOutgoingTransfers(
  warehouseIds: string[] | null,
): Promise<TransferRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transfer_requests")
    .select(TRANSFER_SELECT)
    .eq("status", "in_transit")
    .order("created_at", { ascending: false });

  if (warehouseIds !== null && warehouseIds.length > 0) {
    query = query.in("from_warehouse_id", warehouseIds);
  }

  const { data } = await query;
  return ((data ?? []) as unknown as TransferRequestRow[]).map(normalizeTransfer);
}
