-- Task Assignment & Due-Date Notifications: notifies a task's assignee when
-- they're assigned (on creation or reassignment) and reminds them the day
-- before and on the day a task is due, mirroring the reservation-reminder
-- cron pattern (see 20260915_reservation_reminders.sql).
--
-- Unlike low-stock/stock-movement/reservation alerts (broadcast to an
-- opted-in group, filtered by warehouse access), a task has exactly one
-- assignee and the notification is about their own work, so there's no
-- opt-in column here — it's always on, same as getting pinged when someone
-- assigns you a ticket.

CREATE TABLE IF NOT EXISTS task_reminder_log (
  task_id     TEXT NOT NULL,
  milestone   TEXT NOT NULL CHECK (milestone IN ('day_before', 'due_day')),
  due_date    DATE NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, milestone, due_date)
);

ALTER TABLE task_reminder_log ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: internal bookkeeping only, read/written via
-- the admin client from task-reminders.ts.
