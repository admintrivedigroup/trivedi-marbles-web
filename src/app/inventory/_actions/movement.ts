"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slab, error: slabError } = await supabase
    .from("slabs")
    .select("id, slab_code, warehouse_id, warehouses(name)")
    .eq("id", slabId)
    .single();

  if (slabError || !slab) {
    return { error: "Slab not found.", status: "error" };
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
    return {
      error: `Failed to record movement. ${movementError.message}`,
      status: "error",
    };
  }

  const { error: updateError } = await supabase
    .from("slabs")
    .update({ warehouse_id: toWarehouseId })
    .eq("id", slabId);

  if (updateError) {
    return {
      error: `Movement recorded but failed to update slab location. ${updateError.message}`,
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

  revalidatePath("/inventory", "layout");
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slabs, error: slabsError } = await supabase
    .from("slabs")
    .select("id, warehouse_id, warehouses(name)")
    .in("id", slabIds);

  if (slabsError || !slabs) {
    return { error: "Failed to fetch slab data.", status: "error", transferred: 0 };
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

  const { error: movementError } = await createAdminClient()
    .from("slab_movements")
    .insert(movementRows);

  if (movementError) {
    return {
      error: `Failed to record movements. ${movementError.message}`,
      status: "error",
      transferred: 0,
    };
  }

  const { error: updateError } = await supabase
    .from("slabs")
    .update({ warehouse_id: toWarehouseId })
    .in("id", slabsToMove.map((s) => String(s.id)));

  if (updateError) {
    return {
      error: `Movements recorded but failed to update slab locations. ${updateError.message}`,
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

  revalidatePath("/inventory", "layout");
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

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

  const { data: slabs, error: slabsError } = await supabase
    .from("slabs")
    .select("id, warehouse_id, warehouses(name), slab_code, marble_name")
    .in("id", slabIds);

  if (slabsError || !slabs || slabs.length === 0) {
    return { error: "Failed to fetch slab data.", status: "error", transferred: 0 };
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

  const fromWarehouseId = String(slabsToTransfer[0].warehouse_id);

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

  revalidatePath("/inventory", "layout");
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
    .in("id", slabIds);

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

  for (const item of items) {
    const slabIdStr = String(item.slab_id);
    const rack = itemData[slabIdStr]?.rackNumber?.trim() || null;
    const notes = itemData[slabIdStr]?.notes?.trim() || null;

    const slabUpdate: Record<string, unknown> = { warehouse_id: toWarehouseId };
    if (rack) slabUpdate.rack_number = rack;
    await supabase.from("slabs").update(slabUpdate).eq("id", item.slab_id);

    if (rack || notes) {
      await supabase
        .from("transfer_request_items")
        .update({ new_rack_number: rack, received_notes: notes })
        .eq("id", item.id);
    }
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

  const { error: updateError } = await supabase
    .from("transfer_requests")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", transferId);

  if (updateError) {
    return { error: `Failed to mark transfer as received. ${updateError.message}`, status: "error" };
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

  revalidatePath("/inventory", "layout");
  return { error: null, status: "success" };
}

export async function cancelTransfer(
  formData: FormData,
): Promise<ReceiveTransferResult> {
  const transferId = String(formData.get("transferId") ?? "").trim();

  if (!transferId) {
    return { error: "Missing transfer ID.", status: "error" };
  }

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

  revalidatePath("/inventory", "layout");
  return { error: null, status: "success" };
}
