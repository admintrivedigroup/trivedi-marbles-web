import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Opted-in users, minus the actor who triggered the event, minus anyone
 * whose warehouse allowlist doesn't cover any of the given warehouses. */
async function getRecipients(
  admin: AdminClient,
  actorUserId: string | null,
  warehouseIds: string[],
): Promise<string[]> {
  const { data: optedInProfiles } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("stock_movement_alerts_enabled", true);

  const optedInIds = (optedInProfiles ?? [])
    .map((p) => String(p.user_id))
    .filter((id) => id !== actorUserId);
  if (optedInIds.length === 0) return [];

  const { data: accessRows } = await admin
    .from("user_warehouse_access")
    .select("user_id, warehouse_id")
    .in("user_id", optedInIds);

  const restrictedUserIds = new Set((accessRows ?? []).map((r) => String(r.user_id)));
  const allowedIds = new Set(
    (accessRows ?? [])
      .filter((r) => warehouseIds.includes(String(r.warehouse_id)))
      .map((r) => String(r.user_id)),
  );

  return optedInIds.filter((id) => !restrictedUserIds.has(id) || allowedIds.has(id));
}

/** Call fire-and-forget (no await) after a slab status change (Available,
 * Reserved, or Sold), single or bulk. */
export async function notifyStatusChange(params: {
  slabIds: string[];
  statusName: "Available" | "Reserved" | "Sold";
  actorUserId: string | null;
  contextLabel?: string | null;
  lotId?: string | null;
}): Promise<void> {
  const { slabIds, statusName, actorUserId, contextLabel, lotId } = params;
  if (slabIds.length === 0) return;
  const admin = createAdminClient();

  const { data: slabRows } = await admin
    .from("slabs")
    .select("id, slab_code, warehouse_id")
    .in("id", slabIds);
  if (!slabRows || slabRows.length === 0) return;

  const warehouseIds = [...new Set(slabRows.map((r) => String(r.warehouse_id)).filter(Boolean))];

  const recipients = await getRecipients(admin, actorUserId, warehouseIds);
  if (recipients.length === 0) return;

  let warehouseName: string | null = null;
  if (warehouseIds.length === 1) {
    const { data: warehouse } = await admin
      .from("warehouses")
      .select("name")
      .eq("id", warehouseIds[0])
      .maybeSingle();
    warehouseName = warehouse?.name ?? null;
  }

  const title =
    slabRows.length === 1
      ? `Slab ${slabRows[0].slab_code ?? slabIds[0]} marked ${statusName}`
      : `${slabRows.length} slabs marked ${statusName}`;

  const body =
    [contextLabel, warehouseName ? `Warehouse: ${warehouseName}` : null]
      .filter(Boolean)
      .join(" · ") || null;

  const link = slabRows.length === 1 ? `/inventory/slab/${slabIds[0]}` : lotId ? `/inventory/lot/${lotId}` : null;

  await admin.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "stock_movement",
      title,
      body,
      link,
    })),
  );
}

/** Call fire-and-forget (no await) after slabs are transferred between
 * warehouses (a direct move, or a transfer request being sent/received). */
export async function notifyTransfer(params: {
  slabIds: string[];
  fromWarehouseIds: string[];
  fromWarehouseName: string | null;
  toWarehouseId: string;
  toWarehouseName: string;
  actorUserId: string | null;
}): Promise<void> {
  const { slabIds, fromWarehouseIds, fromWarehouseName, toWarehouseId, toWarehouseName, actorUserId } = params;
  if (slabIds.length === 0) return;
  const admin = createAdminClient();

  const warehouseIds = [...new Set([...fromWarehouseIds, toWarehouseId].filter(Boolean))];
  const recipients = await getRecipients(admin, actorUserId, warehouseIds);
  if (recipients.length === 0) return;

  const fromLabel = fromWarehouseName ?? "multiple warehouses";
  const title =
    slabIds.length === 1
      ? `1 slab moved to ${toWarehouseName}`
      : `${slabIds.length} slabs moved to ${toWarehouseName}`;
  const body = `From ${fromLabel} to ${toWarehouseName}`;

  await admin.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "stock_movement",
      title,
      body,
      link: "/inventory/movement",
    })),
  );
}
