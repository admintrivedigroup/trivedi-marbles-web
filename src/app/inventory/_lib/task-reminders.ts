import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, getTaskEmailRecipients, sendAppEmail } from "@/app/inventory/_lib/email";
import { buildTaskDigestEmail, formatDueDate, type DigestTask } from "@/app/inventory/_lib/task-email-templates";

type AdminClient = ReturnType<typeof createAdminClient>;
type Milestone = "day_before" | "due_day" | "overdue";

type DueTask = {
  id: string;
  title: string;
  assigned_to: string | null;
  due_date: string;
};

// A task that went overdue is reminded once. Looking back a few days (rather
// than only "due yesterday") lets a missed cron run catch up, without mailing
// everyone about tasks that have been overdue for months when this ships.
const OVERDUE_LOOKBACK_DAYS = 3;

// due_date carries a time component (a datetime-local input, stored as
// entered with no timezone offset — see tasks-manager.tsx), so "today" has
// to be evaluated in the business's own timezone rather than UTC, or a
// task due mid-morning IST could fall on the wrong side of the boundary.
function todayIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function milestoneFor(dueDate: string, today: string): Milestone {
  if (dueDate < today) return "overdue";
  return dueDate === today ? "due_day" : "day_before";
}

const BELL_TITLES: Record<Milestone, (title: string) => string> = {
  overdue: (t) => `"${t}" is overdue`,
  due_day: (t) => `"${t}" is due today`,
  day_before: (t) => `"${t}" is due tomorrow`,
};

/** Called daily by the /api/cron/task-reminders route. Finds assigned,
 * not-yet-completed tasks that are overdue (within the lookback), due today
 * or due tomorrow. Each crossing gets a bell notification, deduped per
 * (task, milestone, due date) via task_reminder_log so re-running the same
 * day is a no-op; then each assignee gets one email listing all of theirs. */
export async function checkTaskDueReminders(
  admin: AdminClient = createAdminClient(),
  now: Date = new Date(),
): Promise<{ sent: number; checked: number; emailed: number }> {
  const today = todayIso(now);
  const windowStart = addDaysIso(today, -OVERDUE_LOOKBACK_DAYS);
  const dayAfterTomorrow = addDaysIso(today, 2);

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, assigned_to, due_date")
    .gte("due_date", `${windowStart}T00:00:00`)
    .lt("due_date", `${dayAfterTomorrow}T00:00:00`)
    .neq("status", "completed")
    .neq("status", "draft");

  const assigned = ((tasks ?? []) as DueTask[]).filter((t) => t.assigned_to);
  if (assigned.length === 0) return { sent: 0, checked: 0, emailed: 0 };

  const digests = new Map<string, DigestTask[]>();
  for (const raw of assigned) {
    const dueDate = raw.due_date.slice(0, 10);
    const milestone = milestoneFor(dueDate, today);
    const notified = await notifyOne(admin, { ...raw, due_date: dueDate }, milestone);
    if (!notified) continue;
    const list = digests.get(raw.assigned_to!) ?? [];
    list.push({ id: raw.id, title: raw.title, dueDate: raw.due_date, section: milestone });
    digests.set(raw.assigned_to!, list);
  }

  const emailed = await sendDigests(admin, digests, formatDueDate(today));
  const sent = [...digests.values()].reduce((n, list) => n + list.length, 0);
  return { sent, checked: assigned.length, emailed };
}

async function notifyOne(admin: AdminClient, task: DueTask, milestone: Milestone): Promise<boolean> {
  if (!task.assigned_to) return false;

  const { data: existing } = await admin
    .from("task_reminder_log")
    .select("task_id")
    .eq("task_id", task.id)
    .eq("milestone", milestone)
    .eq("due_date", task.due_date)
    .maybeSingle();
  if (existing) return false;

  // Log first (upsert) so a failure below can't cause a re-notify tomorrow;
  // worst case a run that dies mid-way skips a task rather than double-sending.
  await admin.from("task_reminder_log").upsert({
    task_id: task.id,
    milestone,
    due_date: task.due_date,
  });

  await admin.from("notifications").insert({
    user_id: task.assigned_to,
    type: milestone === "overdue" ? "task_overdue" : "task_due_reminder",
    title: BELL_TITLES[milestone](task.title),
    body: `Due ${task.due_date}`,
    link: `/inventory/tasks/${task.id}`,
  });
  return true;
}

async function sendDigests(
  admin: AdminClient,
  digests: Map<string, DigestTask[]>,
  dateLabel: string,
): Promise<number> {
  if (digests.size === 0) return 0;
  const recipients = await getTaskEmailRecipients(admin, [...digests.keys()]);

  let emailed = 0;
  for (const [userId, tasks] of digests) {
    const recipient = recipients.get(userId);
    if (!recipient) continue;
    const email = buildTaskDigestEmail({
      recipientName: recipient.name,
      dateLabel,
      tasks,
      taskUrl: (id) => appUrl(`/inventory/tasks/${id}`),
      tasksUrl: appUrl("/inventory/tasks"),
      settingsUrl: appUrl("/inventory/settings"),
    });
    if (await sendAppEmail({ to: recipient.email, ...email })) emailed += 1;
  }
  return emailed;
}
