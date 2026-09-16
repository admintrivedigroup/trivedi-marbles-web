import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Call fire-and-forget (no await) after a task is created or reassigned
 * with a non-empty assigned_to. Personal and always-on — unlike the
 * broadcast alerts (low stock, stock movement, reservation), a task has
 * exactly one recipient, so this isn't gated by an opt-in preference. */
export async function notifyTaskAssigned(params: {
  taskId: string;
  title: string;
  assignedTo: string;
  actorUserId: string | null;
}): Promise<void> {
  const { taskId, title, assignedTo, actorUserId } = params;
  if (!assignedTo || assignedTo === actorUserId) return;

  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: assignedTo,
    type: "task_assigned",
    title: "You were assigned a task",
    body: title,
    link: `/inventory/tasks/${taskId}`,
  });
}
