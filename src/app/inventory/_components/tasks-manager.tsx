"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit2,
  Grid,
  List,
  Loader2,
  Plus,
  Search,
  Square,
  Tag,
  Trash2,
  UserPlus,
  X,
  XSquare,
} from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/app/inventory/_lib/tasks";
import type { TaskCategoryOption } from "@/app/inventory/_lib/kra";
import {
  createTask,
  updateTask,
  deleteTask,
  deleteTasks,
  updateTaskProgress,
  type TaskFormData,
} from "@/app/inventory/_actions/tasks";
import type { Role } from "@/app/inventory/_lib/permissions";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

type StatusTab = "all" | TaskStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "completed", label: "Completed" },
];

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  pending: { label: "Pending", className: "bg-orange-100 text-orange-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  pending_approval: { label: "Pending Approval", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
};

const PRIORITY_STYLES: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Low priority", className: "bg-gray-100 text-gray-500" },
  medium: { label: "Medium priority", className: "bg-orange-100 text-orange-600" },
  high: { label: "High priority", className: "bg-red-100 text-red-600" },
};

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  progress: 0,
  assigned_to: "",
  assigned_name: "",
  start_date: "",
  due_date: "",
  kra_column_id: "",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssignableUser = { userId: string; displayName: string | null; email: string };
type ViewMode = "grid" | "list";
type SortKey = "created_at" | "due_date" | "priority" | "title" | "status";
type SortDir = "asc" | "desc";

// ─── Pending checklist item (local, before task is created) ───────────────────
type PendingChecklistItem = {
  tempId: string;
  title: string;
  assigned_to: string;
  assigned_name: string;
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0, pending: 1, pending_approval: 2, draft: 3, completed: 4,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(iso: string | null, status: TaskStatus): boolean {
  if (!iso || status === "completed") return false;
  return new Date(iso) < new Date();
}

function initials(name: string | null, email: string): string {
  if (name) return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500"];
function avatarColor(name: string | null, email: string): string {
  return AVATAR_COLORS[((name ?? email).charCodeAt(0)) % AVATAR_COLORS.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, email, size = "sm" }: { name: string | null; email: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        size === "sm" && "h-7 w-7 text-xs",
        size === "md" && "h-9 w-9 text-sm",
        size === "lg" && "h-11 w-11 text-base",
        avatarColor(name, email),
      )}
    >
      {initials(name, email)}
    </span>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-gray-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all", value >= 100 ? "bg-green-500" : "bg-blue-500")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ─── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  title, message, heading = "Delete task?", onConfirm, onCancel, loading,
}: {
  title?: string; message?: string; heading?: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
        <p className="mt-2 text-sm text-gray-500">
          {message ?? (
            <><span className="font-medium text-gray-700">&ldquo;{title}&rdquo;</span> will be permanently removed.</>
          )}
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task form modal (two-panel layout) ───────────────────────────────────────

function TaskFormModal({
  task, users, taskCategories, onClose, onCreated,
}: {
  task: Task | null; users: AssignableUser[]; taskCategories: TaskCategoryOption[]; onClose: () => void; onCreated?: (task: Task) => void;
}) {
  const isEdit = task !== null;
  const [form, setForm] = useState<TaskFormData>(
    task
      ? {
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          priority: task.priority,
          progress: task.progress,
          assigned_to: task.assigned_to ?? "",
          assigned_name: task.assigned_name ?? "",
          start_date: task.start_date ? task.start_date.slice(0, 16) : "",
          due_date: task.due_date ? task.due_date.slice(0, 16) : "",
          kra_column_id: task.kra_column_id ?? "",
        }
      : { ...EMPTY_FORM },
  );

  const assigneeCategories = useMemo(
    () => taskCategories.filter((c) => c.employee_id === form.assigned_to),
    [taskCategories, form.assigned_to],
  );
  const selectedCategory = assigneeCategories.find((c) => c.id === form.kra_column_id);

  const [moreOpen, setMoreOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<PendingChecklistItem[]>([]);
  const [checklistInput, setChecklistInput] = useState("");
  const [checklistAssignee, setChecklistAssignee] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAssignee(userId: string) {
    const user = users.find((u) => u.userId === userId);
    setForm((prev) => ({
      ...prev,
      assigned_to: userId,
      assigned_name: user?.displayName ?? user?.email ?? "",
      kra_column_id: userId === prev.assigned_to ? prev.kra_column_id : "",
    }));
  }

  function addChecklistItem() {
    if (!checklistInput.trim()) return;
    const user = users.find((u) => u.userId === checklistAssignee);
    setChecklistItems((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: checklistInput.trim(),
        assigned_to: checklistAssignee,
        assigned_name: user?.displayName ?? user?.email ?? "",
      },
    ]);
    setChecklistInput("");
  }

  function removeChecklistItem(tempId: string) {
    setChecklistItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  function handleSubmit(asDraft = false) {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (form.start_date && form.due_date && new Date(form.start_date) > new Date(form.due_date)) {
      setError("Start date cannot be after the due date.");
      return;
    }
    setError(null);
    const finalForm: TaskFormData = {
      ...form,
      status: asDraft ? "draft" : form.status,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateTask(task.id, finalForm)
        : await createTask(finalForm, checklistItems);
      if (result.success) {
        if (!isEdit) {
          onCreated?.({
            id: result.id,
            title: finalForm.title.trim(),
            description: finalForm.description?.trim() || null,
            status: finalForm.status,
            priority: finalForm.priority,
            progress: finalForm.progress,
            assigned_to: finalForm.assigned_to || null,
            assigned_name: finalForm.assigned_name || null,
            start_date: finalForm.start_date || null,
            due_date: finalForm.due_date || null,
            kra_column_id: finalForm.kra_column_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          });
        }
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const assignedUser = users.find((u) => u.userId === form.assigned_to);
  const underlineCls = "w-full border-0 border-b border-gray-200 bg-transparent px-0.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 transition-colors";
  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5";
  const sectionLabelCls = "text-[11px] font-bold uppercase tracking-widest text-blue-600 mb-3.5";

  const PRIORITY_DOT: Record<TaskPriority, string> = {
    low: "bg-gray-400", medium: "bg-orange-500", high: "bg-red-500",
  };
  const PRIORITY_TEXT: Record<TaskPriority, string> = {
    low: "text-gray-700 border-gray-400", medium: "text-orange-700 border-orange-500", high: "text-red-700 border-red-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Modal header — flat, hairline */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Task Desk</p>
              <h2 className="mt-0.5 text-xl font-bold text-gray-900">{isEdit ? "Edit Task" : "Create Task"}</h2>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Basics */}
          <div className="pb-5">
            <p className={sectionLabelCls}>Basics</p>
            <label className={labelCls}>Task Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Follow up with client on quote"
              className={underlineCls}
            />
            <div className="mt-4">
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                placeholder="Describe task"
                className={cn(underlineCls, "resize-none")}
              />
            </div>
          </div>

          {/* Schedule & owner */}
          <div className="border-t border-gray-100 py-5">
            <p className={sectionLabelCls}>Schedule &amp; Owner</p>

            <label className={labelCls}>Priority</label>
            <div className="flex gap-5">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("priority", p)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 pb-1 text-xs font-semibold capitalize transition-colors",
                    form.priority === p ? PRIORITY_TEXT[p] : "border-transparent text-gray-400 hover:text-gray-600",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", form.priority === p ? PRIORITY_DOT[p] : "bg-gray-200")} />
                  {p === "low" ? "Low" : p === "medium" ? "Medium" : "High"}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Due Date &amp; Time</label>
                <input type="datetime-local" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className={underlineCls} />
              </div>
              <div>
                <label className={labelCls}>Assign To</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => handleAssignee(e.target.value)}
                  className={cn(underlineCls, "text-blue-600 font-medium")}
                >
                  <option value="">— Select member —</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.displayName ?? u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {assignedUser ? (
              <div className="mt-3 flex items-center gap-2.5">
                <UserAvatar name={assignedUser.displayName} email={assignedUser.email} size="sm" />
                <span className="text-xs text-gray-500">
                  {assignedUser.displayName ?? assignedUser.email}
                </span>
              </div>
            ) : null}

            {form.assigned_to ? (
              <div className="mt-4">
                <label className={labelCls}>KRA Category</label>
                <select
                  value={form.kra_column_id}
                  onChange={(e) => set("kra_column_id", e.target.value)}
                  className={underlineCls}
                >
                  <option value="">— None —</option>
                  {assigneeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label} — {c.weightage}%</option>
                  ))}
                </select>
                {assigneeCategories.length === 0 ? (
                  <p className="mt-1.5 text-xs text-gray-400">
                    This member has no task-category KRA columns set up yet.
                  </p>
                ) : selectedCategory ? (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Carries <span className="font-semibold text-blue-600">{selectedCategory.weightage}%</span> weight in {assignedUser?.displayName ?? assignedUser?.email}&apos;s KRA score.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Rolls this task&apos;s completion into the chosen KRA column&apos;s score.
                  </p>
                )}
              </div>
            ) : null}

            {/* Status — only shown when editing */}
            {isEdit ? (
              <div className="mt-4">
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value as TaskStatus)} className={underlineCls}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            ) : null}
          </div>

          {/* Checklist — always visible on create */}
          {!isEdit ? (
            <div className="border-t border-gray-100 py-5">
              <div className="flex items-center justify-between">
                <p className={cn(sectionLabelCls, "mb-0")}>Checklist</p>
                {checklistItems.length > 0 && (
                  <span className="text-xs font-semibold text-gray-400">
                    {checklistItems.length} item{checklistItems.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {checklistItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {checklistItems.map((item) => (
                    <div key={item.tempId} className="flex items-center gap-2 text-sm">
                      <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="flex-1 text-gray-700 truncate">{item.title}</span>
                      {item.assigned_name ? (
                        <span className="text-xs text-gray-400 shrink-0">{item.assigned_name}</span>
                      ) : null}
                      <button type="button" onClick={() => removeChecklistItem(item.tempId)}
                        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder="Add a todo item…"
                  className={cn(underlineCls, "flex-1")}
                />
                <select
                  value={checklistAssignee}
                  onChange={(e) => setChecklistAssignee(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:border-blue-400 focus:outline-none max-w-27.5"
                >
                  <option value="">Assignee</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.displayName ?? u.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          ) : null}

          {/* Advanced options accordion — start date + progress (edit only) */}
          <div className="border-t border-gray-100 py-3">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              {moreOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Advanced options
            </button>

            {moreOpen ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label className={labelCls}>Start Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => set("start_date", e.target.value)}
                    className={underlineCls}
                  />
                </div>
                {isEdit ? (
                  <div>
                    <label className={labelCls}>Progress — {form.progress}%</label>
                    <input
                      type="range" min={0} max={100} step={5} value={form.progress}
                      onChange={(e) => set("progress", Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                    <ProgressBar value={form.progress} className="mt-2" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isPending}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          {!isEdit ? (
            <button type="button" onClick={() => handleSubmit(true)} disabled={isPending}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save as Draft
            </button>
          ) : null}
          <button type="button" onClick={() => handleSubmit(false)} disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task card (grid) ─────────────────────────────────────────────────────────

function TaskCard({
  task, users, taskCategories, onEdit, onDelete, onProgressChange, selectMode = false, selected = false, onToggleSelect,
}: {
  task: Task;
  users: AssignableUser[];
  taskCategories: TaskCategoryOption[];
  onEdit: () => void;
  onDelete: () => void;
  onProgressChange: (id: string, progress: number) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [localProgress, setLocalProgress] = useState(task.progress);
  const status = STATUS_STYLES[task.status];
  const priority = PRIORITY_STYLES[task.priority];
  const assignee = users.find((u) => u.userId === task.assigned_to);
  const category = taskCategories.find((c) => c.id === task.kra_column_id);

  function handleProgressCommit() {
    if (localProgress === task.progress) return;
    startTransition(async () => {
      await updateTaskProgress(task.id, localProgress);
      onProgressChange(task.id, localProgress);
    });
  }

  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div className={cn(
      "relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow group",
      overdue ? "border-red-200 bg-red-50/30" : "border-gray-200",
      selected && "ring-2 ring-blue-400 border-blue-300",
    )}>
      <Link href={`/inventory/tasks/${task.id}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={task.title}>
        <span className="sr-only">View details</span>
      </Link>
      {selectMode ? (
        <button
          type="button"
          onClick={onToggleSelect}
          className="absolute right-3 top-3 z-10 rounded-md bg-white/90 p-0.5 text-gray-400 shadow-sm hover:text-blue-600 transition-colors"
        >
          {selected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
        </button>
      ) : null}
      {/* Overdue banner */}
      {overdue ? (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Overdue — due {formatDate(task.due_date)}
        </div>
      ) : null}

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", status.className)}>
          {status.label}
        </span>
        <div className="flex items-center gap-1">
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", priority.className)}>
            {priority.label}
          </span>
          <button type="button" onClick={onEdit}
            className="relative z-10 rounded-lg p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3 text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
        {task.title}
      </h3>
      {task.description ? (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p>
      ) : null}

      {category ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
          <Tag className="h-3 w-3" />{category.label}
        </span>
      ) : null}

      {/* Dates */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {task.start_date ? (
          <span>Start: <span className="font-medium text-gray-700">{formatDate(task.start_date)}</span></span>
        ) : null}
        {task.due_date && !overdue ? (
          <span>Due: <span className="font-medium text-gray-700">{formatDate(task.due_date)}</span></span>
        ) : null}
      </div>

      {/* Assignee */}
      {assignee ? (
        <div className="mt-3 flex items-center gap-2">
          <UserAvatar name={assignee.displayName} email={assignee.email} />
          <span className="text-xs text-gray-600">{assignee.displayName ?? assignee.email}</span>
        </div>
      ) : null}

      {/* Progress */}
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">Progress</span>
          <span className="text-xs font-semibold text-gray-700">{localProgress}%</span>
        </div>
        <ProgressBar value={localProgress} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-blue-600 group-hover:underline">
          View details →
        </span>
        <button type="button" onClick={onDelete}
          className="relative z-10 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  return (
    <th onClick={() => onSort(sortKey)}
      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-700">
      <span className="inline-flex items-center gap-1">
        {label}
        {current === sortKey ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </span>
    </th>
  );
}

// ─── Task table row (list) ────────────────────────────────────────────────────

function TaskRow({
  task, index, users, taskCategories, isAdmin, onEdit, onDelete, selectMode = false, selected = false, onToggleSelect,
}: {
  task: Task; index: number; users: AssignableUser[]; taskCategories: TaskCategoryOption[]; isAdmin: boolean; onEdit: () => void; onDelete: () => void;
  selectMode?: boolean; selected?: boolean; onToggleSelect?: () => void;
}) {
  const overdue = isOverdue(task.due_date, task.status);
  const status = STATUS_STYLES[task.status];
  const priority = PRIORITY_STYLES[task.priority];
  const assignee = users.find((u) => u.userId === task.assigned_to);
  const category = taskCategories.find((c) => c.id === task.kra_column_id);

  return (
    <tr className={cn(
      "border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors",
      index % 2 === 0 ? "bg-white" : "bg-gray-50/40",
      overdue && "bg-red-50/40 hover:bg-red-50/60",
      selected && "bg-blue-50/60 hover:bg-blue-50/60",
    )}>
      {selectMode ? (
        <td className="px-4 py-3">
          <button type="button" onClick={onToggleSelect} className="text-gray-400 hover:text-blue-600 transition-colors">
            {selected ? <CheckSquare className="h-4.5 w-4.5 text-blue-600" /> : <Square className="h-4.5 w-4.5" />}
          </button>
        </td>
      ) : null}
      <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{index + 1}</td>
      <td className="px-4 py-3 min-w-55">
        <Link href={`/inventory/tasks/${task.id}`} className="block">
          <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">{task.title}</p>
          {task.description ? <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{task.description}</p> : null}
          <ProgressBar value={task.progress} className="mt-1.5" />
        </Link>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", status.className)}>{status.label}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", priority.className)}>{priority.label}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {category ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
            <Tag className="h-3 w-3" />{category.label}
          </span>
        ) : <span className="text-gray-300 text-sm">—</span>}
      </td>
      <td className={cn("px-4 py-3 whitespace-nowrap text-sm", overdue ? "font-semibold text-red-600" : "text-gray-600")}>
        {overdue ? <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formatDate(task.due_date)}</span> : formatDate(task.due_date)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {assignee ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={assignee.displayName} email={assignee.email} />
            <span className="text-sm text-gray-600">{assignee.displayName ?? assignee.email}</span>
          </div>
        ) : <span className="text-gray-300 text-sm">—</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(task.start_date)}</td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <Edit2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDelete}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TasksManagerProps = {
  initialTasks: Task[];
  users: AssignableUser[];
  taskCategories: TaskCategoryOption[];
  currentUserId: string;
  currentUserRole: Role;
};

export function TasksManager({ initialTasks, users, taskCategories, currentUserId, currentUserRole }: TasksManagerProps) {
  const isAdmin = currentUserRole === "admin" || currentUserRole === "superadmin";

  // Staff only see tasks assigned to them
  const scopedInitial = isAdmin
    ? initialTasks
    : initialTasks.filter((t) => t.assigned_to === currentUserId);

  const [tasks, setTasks] = useState<Task[]>(scopedInitial);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [filterDue, setFilterDue] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [modalTask, setModalTask] = useState<Task | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [isBulkDeleting, startBulkDelete] = useTransition();

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDelete(async () => {
      const result = await deleteTasks(ids);
      if (result.success) {
        setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
      }
      setBulkConfirm(false);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleProgressChange(id: string, progress: number) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, progress } : t));
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    startDelete(async () => {
      const result = await deleteTask(targetId);
      if (result.success) setTasks((prev) => prev.filter((t) => t.id !== targetId));
      setDeleteTarget(null);
    });
  }

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = { all: tasks.length, draft: 0, pending: 0, in_progress: 0, pending_approval: 0, completed: 0 };
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (activeTab !== "all") list = list.filter((t) => t.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        [t.title, t.description, t.assigned_name].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
      );
    }
    if (filterDue) list = list.filter((t) => t.due_date?.slice(0, 10) === filterDue);
    if (filterAssigned) list = list.filter((t) => t.assigned_to === filterAssigned);

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "priority") cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === "status") cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      else cmp = ((a[sortKey] ?? "") as string).localeCompare((b[sortKey] ?? "") as string, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, activeTab, search, filterDue, filterAssigned, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [activeTab, search, filterDue, filterAssigned, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {filtered.length} of {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin ? (
          <button type="button" onClick={() => setModalTask("new")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" />
            Create task
          </button>
        ) : null}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
            )}>
            {tab.label}
            <span className={cn("ml-1.5 text-xs", activeTab === tab.key ? "text-gray-300" : "text-gray-400")}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-56 rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={filterDue} onChange={(e) => setFilterDue(e.target.value)}
            className="text-sm text-gray-600 focus:outline-none bg-transparent"
          />
          {filterDue ? (
            <button type="button" onClick={() => setFilterDue("")} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-blue-400 focus:outline-none">
          <option value="">All Assigned</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>{u.displayName ?? u.email}</option>
          ))}
        </select>

        {isAdmin ? (
          <button
            type="button"
            onClick={toggleSelectMode}
            className={cn(
              "ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              selectMode
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            {selectMode ? <XSquare className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
            {selectMode ? "Cancel" : "Select"}
          </button>
        ) : null}

        <div className={cn("flex rounded-xl border border-gray-200 bg-white overflow-hidden", !isAdmin && "ml-auto")}>
          <button type="button" onClick={() => setView("grid")}
            className={cn("p-2 transition-colors", view === "grid" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}>
            <Grid className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setView("list")}
            className={cn("p-2 transition-colors", view === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} of {filtered.length} selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(filtered.map((t) => t.id)))}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Select all
          </button>
          {selectedIds.size > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setBulkConfirm(true)}
            disabled={selectedIds.size === 0}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      ) : null}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-lg font-medium text-gray-400">No tasks found</p>
          <p className="mt-1 text-sm text-gray-400">
            {tasks.length === 0 ? "Create your first task to get started." : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((task) => (
            <TaskCard key={task.id} task={task} users={users} taskCategories={taskCategories}
              onEdit={() => setModalTask(task)}
              onDelete={() => setDeleteTarget(task)}
              onProgressChange={handleProgressChange}
              selectMode={selectMode}
              selected={selectedIds.has(task.id)}
              onToggleSelect={() => toggleSelect(task.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {selectMode ? <th className="px-4 py-3 w-10" /> : null}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">S.NO</th>
                <SortTh label="Name" sortKey="title" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Priority" sortKey="priority" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                <SortTh label="Due Date" sortKey="due_date" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned To</th>
                <SortTh label="Start Date" sortKey="created_at" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((task, idx) => (
                <TaskRow key={task.id} task={task} index={(page - 1) * PAGE_SIZE + idx} users={users} taskCategories={taskCategories} isAdmin={isAdmin}
                  onEdit={() => setModalTask(task)}
                  onDelete={() => setDeleteTarget(task)}
                  selectMode={selectMode}
                  selected={selectedIds.has(task.id)}
                  onToggleSelect={() => toggleSelect(task.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-700">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-medium text-gray-700">{filtered.length}</span> tasks
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item as number)}
                    className={cn(
                      "min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
                      page === item
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* Create / Edit modal */}
      {modalTask !== null ? (
        <TaskFormModal
          task={modalTask === "new" ? null : modalTask}
          users={users}
          taskCategories={taskCategories}
          onClose={() => setModalTask(null)}
          onCreated={(newTask) => setTasks((prev) => [newTask, ...prev])}
        />
      ) : null}

      {/* Delete confirm */}
      {deleteTarget !== null ? (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={isDeleting}
        />
      ) : null}

      {/* Bulk delete confirm */}
      {bulkConfirm ? (
        <DeleteConfirm
          heading={`Delete ${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""}?`}
          message={`${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} will be permanently removed.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkConfirm(false)}
          loading={isBulkDeleting}
        />
      ) : null}
    </div>
  );
}
