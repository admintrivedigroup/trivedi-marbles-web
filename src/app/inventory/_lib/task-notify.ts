import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, getTaskEmailRecipients, sendAppEmail } from "@/app/inventory/_lib/email";
import { buildTaskAssignedEmail, buildTaskCompletedEmail } from "@/app/inventory/_lib/task-email-templates";

type AdminClient = ReturnType<typeof createAdminClient>;

const IST_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

async function displayNameOf(admin: AdminClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await admin.from("user_profiles").select("display_name").eq("user_id", userId).maybeSingle();
  if (data?.display_name) return data.display_name;
  const { data: auth } = await admin.auth.admin.getUserById(userId);
  return auth?.user?.email ?? null;
}

/** Call fire-and-forget (no await) after a task is created or reassigned
 * with a non-empty assigned_to. Personal and always-on — unlike the
 * broadcast alerts (low stock, stock movement, reservation), a task has
 * exactly one recipient, so the bell isn't gated by an opt-in preference.
 * The email copy respects user_profiles.task_emails_enabled. */
export async function notifyTaskAssigned(params: {
  taskId: string;
  title: string;
  assignedTo: string;
  actorUserId: string | null;
  description?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}): Promise<void> {
  const { taskId, title, assignedTo, actorUserId } = params;
  if (!assignedTo || assignedTo === actorUserId) return;

  const admin = createAdminClient();
  const link = `/inventory/tasks/${taskId}`;
  await admin.from("notifications").insert({
    user_id: assignedTo,
    type: "task_assigned",
    title: "You were assigned a task",
    body: title,
    link,
  });

  const recipient = (await getTaskEmailRecipients(admin, [assignedTo])).get(assignedTo);
  if (!recipient) return;
  const email = buildTaskAssignedEmail({
    recipientName: recipient.name,
    title,
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,
    priority: params.priority ?? null,
    assignedByName: await displayNameOf(admin, actorUserId),
    taskUrl: appUrl(link),
    settingsUrl: appUrl("/inventory/settings"),
  });
  await sendAppEmail({ to: recipient.email, ...email });
}

/** Call fire-and-forget when a task moves into "completed". Tells the
 * task's creator, unless they completed it themselves. */
export async function notifyTaskCompleted(params: {
  taskId: string;
  title: string;
  createdBy: string | null;
  actorUserId: string | null;
}): Promise<void> {
  const { taskId, title, createdBy, actorUserId } = params;
  if (!createdBy || createdBy === actorUserId) return;

  const admin = createAdminClient();
  const link = `/inventory/tasks/${taskId}`;
  await admin.from("notifications").insert({
    user_id: createdBy,
    type: "task_completed",
    title: "A task you created was completed",
    body: title,
    link,
  });

  const recipient = (await getTaskEmailRecipients(admin, [createdBy])).get(createdBy);
  if (!recipient) return;
  const email = buildTaskCompletedEmail({
    recipientName: recipient.name,
    title,
    completedByName: await displayNameOf(admin, actorUserId),
    completedOn: IST_DATE_TIME.format(new Date()).replace(/(am|pm)/, (m) => m.toUpperCase()),
    taskUrl: appUrl(link),
    settingsUrl: appUrl("/inventory/settings"),
  });
  await sendAppEmail({ to: recipient.email, ...email });
}
