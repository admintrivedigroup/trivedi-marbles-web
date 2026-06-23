"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus, TaskPriority } from "@/app/inventory/_lib/tasks";

export type TaskFormData = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assigned_to: string;
  assigned_name: string;
  start_date: string;
  due_date: string;
};

export type TaskActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

type PendingChecklistItem = {
  title: string;
  assigned_to: string;
  assigned_name: string;
};

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createTask(
  data: TaskFormData,
  checklistItems: PendingChecklistItem[] = [],
): Promise<TaskActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("tasks")
    .insert([sanitize(data, user?.id ?? null)])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  const taskId = row.id as string;

  if (checklistItems.length > 0) {
    await supabase.from("task_checklist_items").insert(
      checklistItems
        .filter((i) => i.title.trim())
        .map((i) => ({
          task_id: taskId,
          title: i.title.trim(),
          assigned_to: i.assigned_to || null,
          assigned_name: i.assigned_name || null,
          completed: false,
        })),
    );
  }

  revalidatePath("/inventory/tasks");
  return { success: true, id: taskId };
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateTask(
  id: string,
  data: TaskFormData,
): Promise<TaskActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ ...sanitize(data, null), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/tasks");
  return { success: true, id };
}

// ─── Update status ────────────────────────────────────────────────────────────
export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "completed") patch.progress = 100;

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/tasks");
  return { success: true };
}

// ─── Update progress ──────────────────────────────────────────────────────────
export async function updateTaskProgress(
  id: string,
  progress: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ progress, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/tasks");
  return { success: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function deleteTask(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/tasks");
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nullIfEmpty(v: string | null | undefined): string | null {
  if (!v || v.trim() === "") return null;
  return v.trim();
}

function sanitize(data: TaskFormData, createdBy: string | null) {
  return {
    title: data.title.trim(),
    description: nullIfEmpty(data.description),
    status: data.status,
    priority: data.priority,
    progress: Math.min(100, Math.max(0, Number(data.progress) || 0)),
    assigned_to: nullIfEmpty(data.assigned_to),
    assigned_name: nullIfEmpty(data.assigned_name),
    start_date: nullIfEmpty(data.start_date),
    due_date: nullIfEmpty(data.due_date),
    ...(createdBy !== null ? { created_by: createdBy } : {}),
  };
}
