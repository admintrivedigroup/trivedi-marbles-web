"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/app/inventory/_lib/tasks";

export type ChecklistItemFormData = {
  title: string;
  assigned_to: string;
  assigned_name: string;
};

export type ChecklistActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type ToggleResult = {
  success: boolean;
  error?: string;
  newStatus?: TaskStatus;
  newProgress?: number;
};

// ─── Recalculate task status + progress from checklist ────────────────────────
async function syncTaskFromChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
): Promise<{ status: TaskStatus; progress: number }> {
  const { data: items } = await supabase
    .from("task_checklist_items")
    .select("completed")
    .eq("task_id", taskId);

  if (!items || items.length === 0) {
    return { status: "pending", progress: 0 };
  }

  const total = items.length;
  const done = items.filter((i: { completed: boolean }) => i.completed).length;
  const progress = Math.round((done / total) * 100);

  let status: TaskStatus;
  if (done === 0) status = "pending";
  else if (done === total) status = "pending_approval"; // admin reviews before marking complete
  else status = "in_progress";

  await supabase
    .from("tasks")
    .update({ status, progress, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  return { status, progress };
}

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createChecklistItem(
  taskId: string,
  data: ChecklistItemFormData,
): Promise<ChecklistActionResult> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("task_checklist_items")
    .insert([{
      task_id: taskId,
      title: data.title.trim(),
      assigned_to: data.assigned_to || null,
      assigned_name: data.assigned_name || null,
      completed: false,
    }])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Adding a new item pushes status back to in_progress if anything was already done
  await syncTaskFromChecklist(supabase, taskId);

  revalidatePath(`/inventory/tasks/${taskId}`);
  revalidatePath("/inventory/tasks");
  return { success: true, id: row.id as string };
}

// ─── Toggle completed — auto-syncs task status + progress ─────────────────────
export async function toggleChecklistItem(
  itemId: string,
  taskId: string,
  completed: boolean,
): Promise<ToggleResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_checklist_items")
    .update({ completed })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  const { status: newStatus, progress: newProgress } = await syncTaskFromChecklist(supabase, taskId);

  revalidatePath(`/inventory/tasks/${taskId}`);
  revalidatePath("/inventory/tasks");
  return { success: true, newStatus, newProgress };
}

// ─── Delete — re-sync after removal ───────────────────────────────────────────
export async function deleteChecklistItem(
  itemId: string,
  taskId: string,
): Promise<{ success: boolean; error?: string; newStatus?: TaskStatus; newProgress?: number }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  const { status: newStatus, progress: newProgress } = await syncTaskFromChecklist(supabase, taskId);

  revalidatePath(`/inventory/tasks/${taskId}`);
  revalidatePath("/inventory/tasks");
  return { success: true, newStatus, newProgress };
}

// ─── Admin approves completed task ────────────────────────────────────────────
export async function approveTaskCompletion(
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/inventory/tasks/${taskId}`);
  revalidatePath("/inventory/tasks");
  return { success: true };
}
