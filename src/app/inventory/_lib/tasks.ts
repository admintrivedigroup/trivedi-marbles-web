import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TaskStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "pending_approval"
  | "completed";

export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assigned_to: string | null;
  assigned_name: string | null;
  created_by: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  assigned_to: string | null;
  assigned_name: string | null;
  completed: boolean;
  created_at: string;
};

export type TaskWithChecklist = Task & {
  checklist: ChecklistItem[];
};

export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

export async function getTaskWithChecklist(id: string): Promise<TaskWithChecklist | null> {
  const supabase = await createClient();

  const [taskRes, checklistRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("task_checklist_items")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (taskRes.error) throw new Error(taskRes.error.message);
  if (!taskRes.data) return null;

  return {
    ...(taskRes.data as Task),
    checklist: (checklistRes.data ?? []) as ChecklistItem[],
  };
}
