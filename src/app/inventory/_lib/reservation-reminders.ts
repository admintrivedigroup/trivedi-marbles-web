import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import { todayInIndia } from "@/app/inventory/_lib/slab-transitions";

type AdminClient = ReturnType<typeof createAdminClient>;
type Milestone = "day_before" | "expiry_day";

type ReservedSlab = {
  id: unknown;
  slab_code: string | null;
  reserved_for: string | null;
  reserved_until: string;
  warehouse_id: unknown;
};

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
  const today = todayInIndia();
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

  const warehouseId = slab.warehouse_id ? String(slab.warehouse_id) : null;
  const recipients = await reminderRecipients(admin, warehouseId);
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

/** Users who opted in to reservation reminders and can see `warehouseId`
 * (users with no warehouse restriction see every warehouse). */
async function reminderRecipients(admin: AdminClient, warehouseId: string | null): Promise<string[]> {
  const { data: optedInProfiles } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("reservation_reminders_enabled", true);
  const optedInIds = (optedInProfiles ?? []).map((p) => String(p.user_id));
  if (optedInIds.length === 0) return [];

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
  return optedInIds.filter((id) => !restrictedUserIds.has(id) || allowedForWarehouse.has(id));
}

type ExpiredSlab = ReservedSlab & { lot_id: unknown };

const RELEASED_SLAB_CODES_SHOWN = 5;

/** Called daily by the same cron route. Puts slabs back to Available once the last
 * day of their reservation has passed (reserved_until < today), so a forgotten hold
 * doesn't keep stock off the market. Returns how many slabs were released. */
export async function releaseExpiredReservations(
  admin: AdminClient = createAdminClient(),
  today: string = todayInIndia(),
): Promise<{ released: number }> {
  const [{ data: reservedStatus }, { data: availableStatus }] = await Promise.all([
    admin.from("slab_statuses").select("id").eq("name", SLAB_STATUS.RESERVED).maybeSingle(),
    admin.from("slab_statuses").select("id").eq("name", SLAB_STATUS.AVAILABLE).maybeSingle(),
  ]);
  if (!reservedStatus || !availableStatus) return { released: 0 };

  const { data: expired } = await admin
    .from("slabs")
    .select("id, slab_code, reserved_for, reserved_until, warehouse_id, lot_id")
    .eq("status_id", reservedStatus.id)
    .lt("reserved_until", today)
    .is("deleted_at", null);

  if (!expired || expired.length === 0) return { released: 0 };

  // Re-check status and date in the write itself: a reservation renewed after the read
  // above no longer matches and is left alone.
  const { data: releasedRows, error } = await admin
    .from("slabs")
    .update({ status_id: availableStatus.id, reserved_for: null, reserved_until: null })
    .in("id", (expired as ExpiredSlab[]).map((s) => s.id))
    .eq("status_id", reservedStatus.id)
    .lt("reserved_until", today)
    .select("id");

  if (error) {
    console.error("releaseExpiredReservations update failed:", error.message);
    return { released: 0 };
  }

  const releasedIds = new Set((releasedRows ?? []).map((r) => String(r.id)));
  const released = (expired as ExpiredSlab[]).filter((s) => releasedIds.has(String(s.id)));
  if (released.length === 0) return { released: 0 };

  await admin.from("audit_logs").insert(
    released.map((slab) => ({
      user_id: null,
      user_email: "system (reservation expired)",
      action: "slab.reservation_expired",
      target_type: "slab",
      target_id: String(slab.id),
      target_label: slab.slab_code ?? String(slab.id),
      diff: {
        lotId: slab.lot_id != null ? String(slab.lot_id) : null,
        before: SLAB_STATUS.RESERVED,
        after: SLAB_STATUS.AVAILABLE,
        reservedFor: slab.reserved_for,
        reservedUntil: slab.reserved_until,
      },
    })),
  );

  await notifyReleased(admin, released);
  return { released: released.length };
}

// One notification per recipient per warehouse, not per slab, so a batch of
// expirations doesn't flood the inbox.
async function notifyReleased(admin: AdminClient, released: ExpiredSlab[]): Promise<void> {
  const byWarehouse = new Map<string | null, ExpiredSlab[]>();
  for (const slab of released) {
    const key = slab.warehouse_id ? String(slab.warehouse_id) : null;
    byWarehouse.set(key, [...(byWarehouse.get(key) ?? []), slab]);
  }

  for (const [warehouseId, slabs] of byWarehouse) {
    const recipients = await reminderRecipients(admin, warehouseId);
    if (recipients.length === 0) continue;

    const codes = slabs.map((s) => s.slab_code ?? String(s.id));
    const shown = codes.slice(0, RELEASED_SLAB_CODES_SHOWN).join(", ");
    const more = codes.length > RELEASED_SLAB_CODES_SHOWN ? ` and ${codes.length - RELEASED_SLAB_CODES_SHOWN} more` : "";
    const title =
      slabs.length === 1
        ? `Reservation for ${codes[0]} expired`
        : `${slabs.length} reservations expired`;

    await admin.from("notifications").insert(
      recipients.map((userId) => ({
        user_id: userId,
        type: "reservation_released",
        title,
        body: `Released back to Available: ${shown}${more}.`,
        link: slabs.length === 1 ? `/inventory/slab/${slabs[0].id}` : "/inventory/list",
      })),
    );
  }
}
