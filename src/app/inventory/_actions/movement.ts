"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { notifyTransfer } from "@/app/inventory/_lib/stock-movement-notify";
import { notifyLowStockForMovedSlabs } from "@/app/inventory/_lib/low-stock";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import { hasWarehouseAccess } from "@/app/inventory/_lib/slab-transitions";
import { receiveTransferSlabs } from "@/app/inventory/_lib/transfer-receive";

export type SaveMovementResult = {
  error: string | null;
  status: "idle" | "success" | "error";
};

export async function saveMovement(
  formData: FormData,
): Promise<SaveMovementResult> {
  const slabId = String(formData.get("slabId") ?? "").trim();
  const toWarehouseId = String(formData.get("toWarehouseId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!slabId) {
    return { error: "Please select a slab.", status: "error" };
  }
  if (!toWarehouseId) {
    return { error: "Please select a destination warehouse.", status: "error" };
  }

  const auth = await requirePermission("stock_movement");
  if (!auth.ok) return { error: auth.error, status: "error" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slab, error: slabError } = await supabase
    .from("slabs")
    .select("id, slab_code, warehouse_id, warehouses(name)")
    .eq("id", slabId)
    .is("deleted_at", null)
    .single();

  if (slabError || !slab) {
    return { error: "Slab not found.", status: "error" };
  }

  if (!hasWarehouseAccess(auth.profile.warehouseIds, slab.warehouse_id != null ? String(slab.warehouse_id) : null)) {
    return { error: "You do not have access to this slab's warehouse.", status: "error" };
  }

  if ((await getInTransitSlabIds()).has(String(slab.id))) {
    return { error: "This slab is in a pending transfer - receive or cancel it first.", status: "error" };
  }

  const { data: targetWarehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("id", toWarehouseId)
    .single();

  if (warehouseError || !targetWarehouse) {
    return { error: "Destination warehouse not found.", status: "error" };
  }

  if (String(slab.warehouse_id) === String(toWarehouseId)) {
    return { error: "Slab is already in the selected warehouse.", status: "error" };
  }

  const fromWarehouseName =
    slab.warehouses && typeof slab.warehouses === "object" && !Array.isArray(slab.warehouses)
      ? String((slab.warehouses as { name: unknown }).name ?? "")
      : null;

  // Move first, then log; if the log can't be written the move is undone so a slab never
  // changes warehouse without a history entry.
  const { error: updateError } = await supabase
    .from("slabs")
    .update({ warehouse_id: toWarehouseId })
    .eq("id", slabId);

  if (updateError) {
    return {
      error: `Failed to update slab location. ${updateError.message}`,
      status: "error",
    };
  }

  const { error: movementError } = await createAdminClient()
    .from("slab_movements")
    .insert({
      slab_id: slabId,
      event_type: "Transfer",
      from_location: fromWarehouseName,
      to_location: String(targetWarehouse.name),
      notes: notes || null,
    });

  if (movementError) {
    await supabase.from("slabs").update({ warehouse_id: slab.warehouse_id }).eq("id", slabId);
    return {
      error: `Failed to record movement, so the slab was not moved. ${movementError.message}`,
      status: "error",
    };
  }

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: "movement.recorded",
    targetType: "slab",
    targetId: slabId,
    targetLabel: typeof slab.slab_code === "string" ? slab.slab_code : slabId,
    diff: {
      from: fromWarehouseName,
      to: String(targetWarehouse.name),
      notes: notes || null,
    },
  }).catch(() => {});

  notifyLowStockForMovedSlabs([
    { slabId, fromWarehouseId: slab.warehouse_id != null ? String(slab.warehouse_id) : null },
  ]).catch(() => {});

  notifyTransfer({
    slabIds: [slabId],
    fromWarehouseIds: slab.warehouse_id ? [String(slab.warehouse_id)] : [],
    fromWarehouseName,
    toWarehouseId,
    toWarehouseName: String(targetWarehouse.name),
    actorUserId: user?.id ?? null,
  }).catch(() => {});

  revalidatePath("/inventory/movement");
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  return { error: null, status: "success" };
}

export type SaveBatchMovementResult = {
  error: string | null;
  status: "idle" | "success" | "error";
  transferred: number;
};

export async function saveBatchMovement(
  formData: FormData,
): Promise<SaveBatchMovementResult> {
  const slabIdsRaw = String(formData.get("slabIds") ?? "").trim();
  const toWarehouseId = String(formData.get("toWarehouseId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const slabIds = slabIdsRaw.split(",").filter(Boolean);

  if (slabIds.length === 0) {
    return { error: "No slabs selected.", status: "error", transferred: 0 };
  }
  if (!toWarehouseId) {
    return { error: "Please select a destination warehouse.", status: "error", transferred: 0 };
  }

  const auth = await requirePermission("stock_movement");
  if (!auth.ok) return { error: auth.error, status: "error", transferred: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slabs, error: slabsError } = await supabase
    .from("slabs")
    .select("id, warehouse_id, warehouses(name)")
    .in("id", slabIds)
    .is("deleted_at", null);

  if (slabsError || !slabs) {
    return { error: "Failed to fetch slab data.", status: "error", transferred: 0 };
  }
  if (slabs.length !== new Set(slabIds).size) {
    return { error: "Some selected slabs no longer exist - refresh and try again.", status: "error", transferred: 0 };
  }

  const inTransitBatch = await getInTransitSlabIds();
  if (slabs.some((s) => inTransitBatch.has(String(s.id)))) {
    return { error: "Some selected slabs are in a pending transfer - receive or cancel it first.", status: "error", transferred: 0 };
  }
  if (slabs.some((s) => !hasWarehouseAccess(auth.profile.warehouseIds, s.warehouse_id != null ? String(s.warehouse_id) : null))) {
    return { error: "You do not have access to one of the selected slabs' warehouses.", status: "error", transferred: 0 };
  }

  const { data: targetWarehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("id", toWarehouseId)
    .single();

  if (warehouseError || !targetWarehouse) {
    return { error: "Destination warehouse not found.", status: "error", transferred: 0 };
  }

  const slabsToMove = slabs.filter(
    (s) => String(s.warehouse_id) !== String(toWarehouseId),
  );

  if (slabsToMove.length === 0) {
    return {
      error: "All selected slabs are already in this warehouse.",
      status: "error",
      transferred: 0,
    };
  }

  const movementRows = slabsToMove.map((slab) => {
    const fromName =
      slab.warehouses && typeof slab.warehouses === "object" && !Array.isArray(slab.warehouses)
        ? String((slab.warehouses as { name: unknown }).name ?? "")
        : null;
    return {
      slab_id: String(slab.id),
      event_type: "Transfer",
      from_location: fromName,
      to_location: String(targetWarehouse.name),
      notes: notes || null,
    };
  });

  const moveIds = slabsToMove.map((s) => String(s.id));

  const { error: updateError } = await supabase
    .from("slabs")
    .update({ warehouse_id: toWarehouseId })
    .in("id", moveIds);

  if (updateError) {
    return {
      error: `Failed to update slab locations. ${updateError.message}`,
      status: "error",
      transferred: 0,
    };
  }

  const { error: movementError } = await createAdminClient()
    .from("slab_movements")
    .insert(movementRows);

  if (movementError) {
    // Undo per source warehouse so no slab moves without a history entry.
    const bySource = new Map<string, string[]>();
    for (const slab of slabsToMove) {
      const key = String(slab.warehouse_id);
      bySource.set(key, [...(bySource.get(key) ?? []), String(slab.id)]);
    }
    for (const [warehouseId, ids] of bySource) {
      await supabase.from("slabs").update({ warehouse_id: warehouseId }).in("id", ids);
    }
    return {
      error: `Failed to record movements, so no slabs were moved. ${movementError.message}`,
      status: "error",
      transferred: 0,
    };
  }

  const fromWarehouseName =
    slabsToMove[0]?.warehouses &&
    typeof slabsToMove[0].warehouses === "object" &&
    !Array.isArray(slabsToMove[0].warehouses)
      ? String((slabsToMove[0].warehouses as { name: unknown }).name ?? "")
      : null;

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: "movement.batch_recorded",
    targetType: "transfer",
    targetId: toWarehouseId,
    targetLabel: String(targetWarehouse.name),
    diff: {
      slabCount: slabsToMove.length,
      from: fromWarehouseName,
      to: String(targetWarehouse.name),
      notes: notes || null,
    },
  }).catch(() => {});

  notifyLowStockForMovedSlabs(
    slabsToMove.map((s) => ({
      slabId: String(s.id),
      fromWarehouseId: s.warehouse_id != null ? String(s.warehouse_id) : null,
    })),
  ).catch(() => {});

  notifyTransfer({
    slabIds: slabsToMove.map((s) => String(s.id)),
    fromWarehouseIds: [...new Set(slabsToMove.map((s) => String(s.warehouse_id)).filter(Boolean))],
    fromWarehouseName,
    toWarehouseId,
    toWarehouseName: String(targetWarehouse.name),
    actorUserId: user?.id ?? null,
  }).catch(() => {});

  revalidatePath("/inventory/movement");
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  return { error: null, status: "success", transferred: slabsToMove.length };
}

export async function createTransferRequest(
  formData: FormData,
): Promise<SaveBatchMovementResult> {
  const slabIdsRaw = String(formData.get("slabIds") ?? "").trim();
  const toWarehouseId = String(formData.get("toWarehouseId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const slabIds = slabIdsRaw.split(",").filter(Boolean);

  if (slabIds.length === 0) {
    return { error: "No slabs selected.", status: "error", transferred: 0 };
  }
  if (!toWarehouseId) {
    return { error: "Please select a destination warehouse.", status: "error", transferred: 0 };
  }

  const auth = await requirePermission("stock_movement");
  if (!auth.ok) return { error: auth.error, status: "error", transferred: 0 };

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

  const { data: slabs, error: slabsError } = await supabase
    .from("slabs")
    .select("id, warehouse_id, warehouses(name)")
    .in("id", slabIds)
    .is("deleted_at", null);

  if (slabsError || !slabs || slabs.length === 0) {
    return { error: "Failed to fetch slab data.", status: "error", transferred: 0 };
  }
  if (slabs.length !== new Set(slabIds).size) {
    return { error: "Some selected slabs no longer exist - refresh and try again.", status: "error", transferred: 0 };
  }

  const slabsToTransfer = slabs.filter(
    (s) => String(s.warehouse_id) !== String(toWarehouseId),
  );

  if (slabsToTransfer.length === 0) {
    return {
      error: "All selected slabs are already in this warehouse.",
      status: "error",
      transferred: 0,
    };
  }

  // A transfer request has one source warehouse; recording slabs from several under the
  // first slab's warehouse would attribute them to the wrong place.
  const sourceWarehouseIds = new Set(slabsToTransfer.map((s) => String(s.warehouse_id)));
  if (sourceWarehouseIds.size > 1) {
    return {
      error: "Selected slabs are in different warehouses - create one transfer per source warehouse.",
      status: "error",
      transferred: 0,
    };
  }
  const fromWarehouseId = String(slabsToTransfer[0].warehouse_id);

  if (!hasWarehouseAccess(auth.profile.warehouseIds, fromWarehouseId)) {
    return { error: "You do not have access to the source warehouse.", status: "error", transferred: 0 };
  }

  const inTransitNow = await getInTransitSlabIds();
  const alreadyMoving = slabsToTransfer.filter((s) => inTransitNow.has(String(s.id)));
  if (alreadyMoving.length > 0) {
    return {
      error: `${alreadyMoving.length} selected slab(s) are already in a pending transfer.`,
      status: "error",
      transferred: 0,
    };
  }

  const { data: toWarehouse } = await supabase
    .from("warehouses")
    .select("name")
    .eq("id", toWarehouseId)
    .single();

  const { data: transferRequest, error: transferError } = await supabase
    .from("transfer_requests")
    .insert({
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      notes: notes || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (transferError || !transferRequest) {
    return {
      error: `Failed to create transfer. ${transferError?.message}`,
      status: "error",
      transferred: 0,
    };
  }

  const items = slabsToTransfer.map((slab) => ({
    transfer_request_id: transferRequest.id,
    slab_id: String(slab.id),
  }));

  const { error: itemsError } = await supabase
    .from("transfer_request_items")
    .insert(items);

  if (itemsError) {
    // Do not leave an empty transfer request behind.
    await createAdminClient().from("transfer_requests").delete().eq("id", transferRequest.id);
    return {
      error: `Failed to add slabs to transfer. ${itemsError.message}`,
      status: "error",
      transferred: 0,
    };
  }

  // Log movement for each slab so both sender and receiver see it in history
  const fromWarehouseName =
    slabsToTransfer[0].warehouses &&
    typeof slabsToTransfer[0].warehouses === "object" &&
    !Array.isArray(slabsToTransfer[0].warehouses)
      ? String((slabsToTransfer[0].warehouses as { name: unknown }).name ?? "")
      : null;

  const { error: movLogError } = await createAdminClient().from("slab_movements").insert(
    slabsToTransfer.map((slab) => ({
      slab_id: String(slab.id),
      event_type: "Transfer",
      from_location: fromWarehouseName,
      to_location: toWarehouse?.name ?? null,
      notes: `[Sent] ${notes || `ref ${transferRequest.id.slice(0, 8)}`}`,
    })),
  );

  if (movLogError) {
    console.error("Movement log failed:", movLogError.message);
  }

  logAudit({
    userId: user?.id ?? null,
    userEmail,
    action: "transfer.created",
    targetType: "transfer",
    targetId: transferRequest.id,
    targetLabel: `ref ${transferRequest.id.slice(0, 8)}`,
    diff: {
      slabCount: slabsToTransfer.length,
      from: fromWarehouseName,
      to: toWarehouse?.name ?? null,
      notes: notes || null,
    },
  }).catch(() => {});

  notifyTransfer({
    slabIds: slabsToTransfer.map((s) => String(s.id)),
    fromWarehouseIds: [fromWarehouseId],
    fromWarehouseName,
    toWarehouseId,
    toWarehouseName: toWarehouse?.name ?? String(toWarehouseId),
    actorUserId: user?.id ?? null,
  }).catch(() => {});

  revalidatePath("/inventory/movement");
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  return { error: null, status: "success", transferred: slabsToTransfer.length };
}

export type ReceiveTransferResult = {
  error: string | null;
  status: "idle" | "success" | "error";
};

export async function receiveTransfer(
  formData: FormData,
): Promise<ReceiveTransferResult> {
  const transferId = String(formData.get("transferId") ?? "").trim();
  const itemDataRaw = String(formData.get("items") ?? "").trim();

  if (!transferId) {
    return { error: "Missing transfer ID.", status: "error" };
  }

  const auth = await requirePermission("stock_movement");
  if (!auth.ok) return { error: auth.error, status: "error" };

  let itemData: Record<string, { rackNumber: string; notes: string }> = {};
  try {
    if (itemDataRaw) itemData = JSON.parse(itemDataRaw);
  } catch {
    // proceed without per-slab data
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transfer, error: transferError } = await supabase
    .from("transfer_requests")
    .select(`
      id, from_warehouse_id, to_warehouse_id, status,
      from_warehouse:warehouses!transfer_requests_from_warehouse_id_fkey(name),
      to_warehouse:warehouses!transfer_requests_to_warehouse_id_fkey(name),
      transfer_request_items(id, slab_id)
    `)
    .eq("id", transferId)
    .eq("status", "in_transit")
    .single();

  if (transferError || !transfer) {
    return { error: "Transfer not found or already received.", status: "error" };
  }

  const toWarehouseId = String(transfer.to_warehouse_id);
  if (!hasWarehouseAccess(auth.profile.warehouseIds, toWarehouseId)) {
    return { error: "You do not have access to the destination warehouse.", status: "error" };
  }
  const toWarehouseName =
    transfer.to_warehouse && typeof transfer.to_warehouse === "object" && !Array.isArray(transfer.to_warehouse)
      ? String((transfer.to_warehouse as { name: unknown }).name ?? "")
      : null;
  const fromWarehouseName =
    transfer.from_warehouse && typeof transfer.from_warehouse === "object" && !Array.isArray(transfer.from_warehouse)
      ? String((transfer.from_warehouse as { name: unknown }).name ?? "")
      : null;

  const items = (transfer.transfer_request_items ?? []) as Array<{ id: string; slab_id: number | string }>;

  const slabIds = items.map((i) => String(i.slab_id));
  const { data: slabRows, error: slabFetchError } = await supabase
    .from("slabs")
    .select("id")
    .in("id", slabIds)
    .is("deleted_at", null);

  if (slabFetchError) {
    return { error: `Failed to verify slabs. ${slabFetchError.message}`, status: "error" };
  }

  const foundSlabIds = new Set((slabRows ?? []).map((s) => String(s.id)));
  const missingSlabs = slabIds.filter((id) => !foundSlabIds.has(id));
  if (missingSlabs.length > 0) {
    return {
      error: `${missingSlabs.length} slab(s) in this transfer no longer exist and cannot be received. Please cancel and re-create the transfer.`,
      status: "error",
    };
  }

  const receiveOutcome = await receiveTransferSlabs(supabase, {
    transferId,
    toWarehouseId,
    slabs: items.map((item) => {
      const slabIdStr = String(item.slab_id);
      return {
        itemId: item.id,
        slabId: slabIdStr,
        rackNumber: itemData[slabIdStr]?.rackNumber?.trim() || null,
        notes: itemData[slabIdStr]?.notes?.trim() || null,
      };
    }),
  });
  if (receiveOutcome.error) {
    return { error: receiveOutcome.error, status: "error" };
  }

  if ((slabRows ?? []).length > 0) {
    const { error: recvLogError } = await createAdminClient().from("slab_movements").insert(
      slabRows.map((s) => ({
        slab_id: String(s.id),
        event_type: "Transfer",
        from_location: fromWarehouseName,
        to_location: toWarehouseName,
        notes: `[Received] ref ${transferId.slice(0, 8)}`,
      })),
    );
    if (recvLogError) {
      console.error("Movement log failed:", recvLogError.message);
    }
  }

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: "transfer.received",
    targetType: "transfer",
    targetId: transferId,
    targetLabel: `ref ${transferId.slice(0, 8)}`,
    diff: {
      slabCount: items.length,
      from: fromWarehouseName,
      to: toWarehouseName,
    },
  }).catch(() => {});

  notifyLowStockForMovedSlabs(
    (slabRows ?? []).map((s) => ({
      slabId: String(s.id),
      fromWarehouseId: transfer.from_warehouse_id != null ? String(transfer.from_warehouse_id) : null,
    })),
  ).catch(() => {});

  notifyTransfer({
    slabIds: (slabRows ?? []).map((s) => String(s.id)),
    fromWarehouseIds: transfer.from_warehouse_id ? [String(transfer.from_warehouse_id)] : [],
    fromWarehouseName,
    toWarehouseId,
    toWarehouseName: toWarehouseName ?? toWarehouseId,
    actorUserId: user?.id ?? null,
  }).catch(() => {});

  revalidatePath("/inventory/movement");
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  return { error: null, status: "success" };
}

export async function cancelTransfer(
  formData: FormData,
): Promise<ReceiveTransferResult> {
  const transferId = String(formData.get("transferId") ?? "").trim();

  if (!transferId) {
    return { error: "Missing transfer ID.", status: "error" };
  }

  const auth = await requirePermission("stock_movement");
  if (!auth.ok) return { error: auth.error, status: "error" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transfer, error: transferError } = await supabase
    .from("transfer_requests")
    .select(`
      id, status,
      from_warehouse:warehouses!transfer_requests_from_warehouse_id_fkey(name),
      to_warehouse:warehouses!transfer_requests_to_warehouse_id_fkey(name),
      transfer_request_items(slab_id)
    `)
    .eq("id", transferId)
    .eq("status", "in_transit")
    .single();

  if (transferError || !transfer) {
    return { error: "Transfer not found or already completed.", status: "error" };
  }

  const fromWarehouseName =
    transfer.from_warehouse && typeof transfer.from_warehouse === "object" && !Array.isArray(transfer.from_warehouse)
      ? String((transfer.from_warehouse as { name: unknown }).name ?? "")
      : null;
  const toWarehouseName =
    transfer.to_warehouse && typeof transfer.to_warehouse === "object" && !Array.isArray(transfer.to_warehouse)
      ? String((transfer.to_warehouse as { name: unknown }).name ?? "")
      : null;

  const { error: updateError } = await supabase
    .from("transfer_requests")
    .update({ status: "cancelled" })
    .eq("id", transferId);

  if (updateError) {
    return { error: `Failed to cancel transfer. ${updateError.message}`, status: "error" };
  }

  const items = (transfer.transfer_request_items ?? []) as Array<{ slab_id: number | string }>;
  if (items.length > 0) {
    const { error: cancelLogError } = await createAdminClient().from("slab_movements").insert(
      items.map((item) => ({
        slab_id: String(item.slab_id),
        event_type: "Transfer",
        from_location: fromWarehouseName,
        to_location: toWarehouseName,
        notes: `[Cancelled] ref ${transferId.slice(0, 8)}`,
      })),
    );
    if (cancelLogError) {
      console.error("Movement log failed:", cancelLogError.message);
    }
  }

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: "transfer.cancelled",
    targetType: "transfer",
    targetId: transferId,
    targetLabel: `ref ${transferId.slice(0, 8)}`,
    diff: {
      slabCount: items.length,
      from: fromWarehouseName,
      to: toWarehouseName,
    },
  }).catch(() => {});

  revalidatePath("/inventory/movement");
  revalidatePath("/inventory/list");
  revalidatePath("/inventory/dashboard");
  return { error: null, status: "success" };
}
