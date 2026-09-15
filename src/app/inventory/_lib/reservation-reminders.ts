import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

type AdminClient = ReturnType<typeof createAdminClient>;
type Milestone = "day_before" | "expiry_day";

type ReservedSlab = {
  id: unknown;
  slab_code: string | null;
  reserved_for: string | null;
  reserved_until: string;
  warehouse_id: unknown;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Called daily by the /api/cron/reservation-reminders route. Finds
 * reserved slabs whose reserved_until is today or tomorrow and notifies
 * opted-in users, deduped per (slab, milestone, reserved_until) via
 * reservation_reminder_log so re-running the same day is a no-op. */
export async function checkReservationReminders(): Promise<{ sent: number; checked: number }> {
  const admin = createAdminClient();
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);

  const { data: reservedStatus } = await admin
    .from("slab_statuses")
    .select("id")
    .eq("name", SLAB_STATUS.RESERVED)
    .maybeSingle();
  if (!reservedStatus) return { sent: 0, checked: 0 };

  const { data: slabs } = await admin
    .from("slabs")
    .select("id, slab_code, reserved_for, reserved_until, warehouse_id")
    .eq("status_id", reservedStatus.id)
    .in("reserved_until", [today, tomorrow])
    .is("deleted_at", null);

  if (!slabs || slabs.length === 0) return { sent: 0, checked: 0 };

  let sent = 0;
  for (const slab of slabs as ReservedSlab[]) {
    const milestone: Milestone = slab.reserved_until === today ? "expiry_day" : "day_before";
    const notified = await notifyOne(admin, slab, milestone);
    if (notified) sent += 1;
  }
  return { sent, checked: slabs.length };
}

async function notifyOne(admin: AdminClient, slab: ReservedSlab, milestone: Milestone): Promise<boolean> {
  const slabId = String(slab.id);

  const { data: existing } = await admin
    .from("reservation_reminder_log")
    .select("slab_id")
    .eq("slab_id", slabId)
    .eq("milestone", milestone)
    .eq("reserved_until", slab.reserved_until)
    .maybeSingle();
  if (existing) return false;

  // Log first (upsert) so a failure below can't cause a re-notify tomorrow;
  // worst case a run that dies mid-way skips a slab rather than double-sending.
  await admin.from("reservation_reminder_log").upsert({
    slab_id: slabId,
    milestone,
    reserved_until: slab.reserved_until,
  });

  const { data: optedInProfiles } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("reservation_reminders_enabled", true);
  const optedInIds = (optedInProfiles ?? []).map((p) => String(p.user_id));
  if (optedInIds.length === 0) return false;

  const warehouseId = slab.warehouse_id ? String(slab.warehouse_id) : null;
  const { data: accessRows } = await admin
    .from("user_warehouse_access")
    .select("user_id, warehouse_id")
    .in("user_id", optedInIds);

  const restrictedUserIds = new Set((accessRows ?? []).map((r) => String(r.user_id)));
  const allowedForWarehouse = new Set(
    (accessRows ?? [])
      .filter((r) => warehouseId !== null && String(r.warehouse_id) === warehouseId)
      .map((r) => String(r.user_id)),
  );
  const recipients = optedInIds.filter((id) => !restrictedUserIds.has(id) || allowedForWarehouse.has(id));
  if (recipients.length === 0) return false;

  const slabLabel = slab.slab_code ?? slabId;
  const customer = slab.reserved_for ?? "a customer";
  const title =
    milestone === "expiry_day"
      ? `Reservation for ${slabLabel} expires today`
      : `Reservation for ${slabLabel} expires tomorrow`;
  const body = `Reserved for ${customer}, until ${slab.reserved_until}.`;

  await admin.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "reservation_reminder",
      title,
      body,
      link: `/inventory/slab/${slabId}`,
    })),
  );
  return true;
}
