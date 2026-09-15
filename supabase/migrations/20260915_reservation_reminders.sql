-- Reservation Reminders: notifies opted-in users the day before a slab's
-- reservation lapses (reserved_until), and again on the day it expires, so
-- staff can follow up with the customer before the hold is lost.
--
-- Unlike low-stock and stock-movement alerts (which fire from a write
-- path), this is date-driven: a daily Vercel Cron hits
-- /api/cron/reservation-reminders, which calls checkReservationReminders()
-- in src/app/inventory/_lib/reservation-reminders.ts. That function needs a
-- dedup log so re-running the cron on the same day doesn't re-notify, and so
-- a slab that gets unreserved and re-reserved with a new reserved_until gets
-- fresh reminders for that new date.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS reservation_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS reservation_reminder_log (
  slab_id        TEXT NOT NULL,
  milestone      TEXT NOT NULL CHECK (milestone IN ('day_before', 'expiry_day')),
  reserved_until DATE NOT NULL,
  notified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slab_id, milestone, reserved_until)
);

ALTER TABLE reservation_reminder_log ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: internal bookkeeping only, read/written via
-- the admin client from reservation-reminders.ts.
