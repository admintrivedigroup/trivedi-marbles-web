-- Slow-moving stock digest: once a day the cron at /api/cron/reservation-reminders
-- also calls notifySlowMovingStock() (src/app/inventory/_lib/slow-stock-digest.ts),
-- which tells admins and superadmins about lots whose oldest unsold slab has just
-- passed 90, 180 or 365 days.
--
-- This log makes each (lot, milestone) fire once. oldest_added_at is part of the key
-- so a lot whose old slabs sell (its age resets to a newer slab) is reported again
-- when that newer slab crosses the milestone in turn.

CREATE TABLE IF NOT EXISTS slow_stock_alert_log (
  lot_id          TEXT NOT NULL,
  milestone       INTEGER NOT NULL CHECK (milestone IN (90, 180, 365)),
  oldest_added_at TIMESTAMPTZ NOT NULL,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lot_id, milestone, oldest_added_at)
);

ALTER TABLE slow_stock_alert_log ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: internal bookkeeping only, read/written via
-- the admin client from slow-stock-digest.ts.
