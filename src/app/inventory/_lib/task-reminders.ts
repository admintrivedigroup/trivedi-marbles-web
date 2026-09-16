import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type Milestone = "day_before" | "due_day";

type DueTask = {
  id: string;
  title: string;
  assigned_to: string | null;
  due_date: string;
};

// due_date carries a time component (a datetime-local input, stored as
// entered with no timezone offset — see tasks-manager.tsx), so "today" has
// to be evaluated in the business's own timezone rather than UTC, or a
// task due mid-morning IST could fall on the wrong side of the boundary.
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Called daily by the /api/cron/task-reminders route. Finds assigned,
 * not-yet-completed tasks whose due_date falls today or tomorrow and
 * notifies the assignee, deduped per (task, milestone, due date) via
 * task_reminder_log so re-running the same day is a no-op. */
export async function checkTaskDueReminders(): Promise<{ sent: number; checked: number }> {
  const admin = createAdminClient();
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const dayAfterTomorrow = addDaysIso(today, 2);

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, assigned_to, due_date")
    .gte("due_date", `${today}T00:00:00`)
    .lt("due_date", `${dayAfterTomorrow}T00:00:00`)
    .not("assigned_to", "is", null)
    .neq("status", "completed");

  if (!tasks || tasks.length === 0) return { sent: 0, checked: 0 };

  let sent = 0;
  for (const raw of tasks as DueTask[]) {
    const dueDate = raw.due_date.slice(0, 10);
    const milestone: Milestone = dueDate === today ? "due_day" : "day_before";
    const notified = await notifyOne(admin, { ...raw, due_date: dueDate }, milestone);
    if (notified) sent += 1;
  }
  return { sent, checked: tasks.length };
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

  const title =
    milestone === "due_day" ? `"${task.title}" is due today` : `"${task.title}" is due tomorrow`;

  await admin.from("notifications").insert({
    user_id: task.assigned_to,
    type: "task_due_reminder",
    title,
    body: `Due ${task.due_date}`,
    link: `/inventory/tasks/${task.id}`,
  });
  return true;
}
