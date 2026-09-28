-- Task Email Reminders: the task bell notifications from
-- 20260915_task_notifications.sql now also go out by email (via Resend),
-- plus two new triggers:
--   * "overdue"   — once, for a task whose due date has passed while it is
--                   still open (daily cron, looks back 3 days so a missed
--                   run catches up without mailing years-old tasks)
--   * completed   — the task's creator hears when someone else completes it
--
-- The cron sends at most one email per person per run, listing every task
-- that crossed a milestone (overdue / due today / due tomorrow).
--
-- Bell notifications stay always-on. Email is opt-out per user, default ON,
-- because a task email is about the recipient's own work.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS task_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE task_reminder_log
  DROP CONSTRAINT IF EXISTS task_reminder_log_milestone_check;

ALTER TABLE task_reminder_log
  ADD CONSTRAINT task_reminder_log_milestone_check
  CHECK (milestone IN ('day_before', 'due_day', 'overdue'));
