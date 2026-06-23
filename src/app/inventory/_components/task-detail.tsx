"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import type { TaskWithChecklist, ChecklistItem, TaskStatus, TaskPriority } from "@/app/inventory/_lib/tasks";
import { updateTaskStatus } from "@/app/inventory/_actions/tasks";
import {
  createChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  approveTaskCompletion,
} from "@/app/inventory/_actions/task-checklist";
import type { AssignableUser } from "@/app/inventory/_components/tasks-manager";
import type { Role } from "@/app/inventory/_lib/permissions";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TaskStatus, { label: string; badge: string }> = {
  draft:            { label: "Draft",            badge: "bg-gray-100 text-gray-600 border-gray-200" },
  pending:          { label: "Pending",          badge: "bg-orange-100 text-orange-700 border-orange-200" },
  in_progress:      { label: "In Progress",      badge: "bg-blue-100 text-blue-700 border-blue-200" },
  pending_approval: { label: "Pending Approval", badge: "bg-purple-100 text-purple-700 border-purple-200" },
  completed:        { label: "Completed",        badge: "bg-green-100 text-green-700 border-green-200" },
};

const PRIORITY_LABELS: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High" };
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-gray-500", medium: "text-orange-600", high: "text-red-600",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isOverdue(iso: string | null, status: TaskStatus): boolean {
  if (!iso || status === "completed") return false;
  return new Date(iso) < new Date();
}

function computeStatusFromChecklist(
  checklist: ChecklistItem[],
  currentStatus: TaskStatus,
): TaskStatus {
  if (checklist.length === 0) return currentStatus;
  const done = checklist.filter((i) => i.completed).length;
  if (done === 0) return "pending";
  if (done === checklist.length) return "pending_approval";
  return "in_progress";
}

function computeProgress(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  return Math.round((checklist.filter((i) => i.completed).length / checklist.length) * 100);
}

function initials(name: string | null, email: string): string {
  if (name) return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}
const AVATAR_COLORS = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserAvatar({ name, email, size = "md" }: { name: string | null; email: string; size?: "sm" | "md" | "lg" }) {
  const color = AVATAR_COLORS[((name ?? email).charCodeAt(0)) % AVATAR_COLORS.length];
  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
      size === "sm" && "h-6 w-6 text-xs",
      size === "md" && "h-10 w-10 text-sm",
      size === "lg" && "h-12 w-12 text-base",
      color,
    )}>
      {initials(name, email)}
    </span>
  );
}

// ─── Status explanation banner ─────────────────────────────────────────────────

function StatusBanner({ checklist, status }: { checklist: ChecklistItem[]; status: TaskStatus }) {
  if (checklist.length === 0) return null;
  const done = checklist.filter((i) => i.completed).length;
  const total = checklist.length;

  if (status === "pending_approval") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-purple-800">All todos completed — awaiting admin approval</p>
          <p className="text-xs text-purple-600 mt-0.5">An admin or superadmin must review and mark this task as complete.</p>
        </div>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Clock className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <p className="text-sm text-blue-700">
          <span className="font-semibold">{done} of {total}</span> todos completed — keep going!
        </p>
      </div>
    );
  }

  return null;
}

// ─── Checklist row ─────────────────────────────────────────────────────────────

function ChecklistRow({
  item, taskId, users, canEdit, onToggle, onDelete,
}: {
  item: ChecklistItem;
  taskId: string;
  users: AssignableUser[];
  canEdit: boolean;
  onToggle: (id: string, completed: boolean, newStatus?: TaskStatus, newProgress?: number) => void;
  onDelete: (id: string, newStatus?: TaskStatus, newProgress?: number) => void;
}) {
  const [isToggling, startToggle] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const assignee = users.find((u) => u.userId === item.assigned_to);

  function handleToggle() {
    if (!canEdit) return;
    const next = !item.completed;
    startToggle(async () => {
      const res = await toggleChecklistItem(item.id, taskId, next);
      onToggle(item.id, next, res.newStatus, res.newProgress);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const res = await deleteChecklistItem(item.id, taskId);
      onDelete(item.id, res.newStatus, res.newProgress);
    });
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 group transition-colors hover:border-gray-200">
      {/* Checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isToggling || !canEdit}
        title={canEdit ? (item.completed ? "Mark incomplete" : "Mark complete") : "Only the assignee can update todos"}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded border-2 transition-all flex items-center justify-center",
          item.completed
            ? "border-blue-500 bg-blue-500"
            : "border-gray-300",
          canEdit && !item.completed && "hover:border-blue-400",
          !canEdit && "cursor-not-allowed opacity-60",
        )}
      >
        {isToggling ? (
          <Loader2 className="h-3 w-3 animate-spin text-white" />
        ) : item.completed ? (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 10 10">
            <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm text-gray-900 leading-snug", item.completed && "line-through text-gray-400")}>
          {item.title}
        </p>
        {assignee ? (
          <div className="mt-1 flex items-center gap-1.5">
            <UserAvatar name={assignee.displayName} email={assignee.email} size="sm" />
            <span className="text-xs text-gray-400">
              Assigned to {assignee.displayName ?? assignee.email}
            </span>
          </div>
        ) : null}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="shrink-0 rounded-lg p-1 text-gray-200 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Add checklist item form ───────────────────────────────────────────────────

function AddChecklistForm({
  taskId, users, onAdd,
}: {
  taskId: string;
  users: AssignableUser[];
  onAdd: (item: ChecklistItem, newStatus?: TaskStatus, newProgress?: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!title.trim()) return;
    const user = users.find((u) => u.userId === assignedTo);
    setError(null);
    startTransition(async () => {
      const result = await createChecklistItem(taskId, {
        title: title.trim(),
        assigned_to: assignedTo,
        assigned_name: user?.displayName ?? user?.email ?? "",
      });
      if (result.success) {
        onAdd({
          id: result.id,
          task_id: taskId,
          title: title.trim(),
          assigned_to: assignedTo || null,
          assigned_name: user?.displayName ?? user?.email ?? null,
          completed: false,
          created_at: new Date().toISOString(),
        });
        setTitle("");
        setAssignedTo("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Add a checklist item…"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-blue-400 focus:outline-none max-w-36"
        >
          <option value="">Assignee</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>{u.displayName ?? u.email}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TaskDetailProps = {
  task: TaskWithChecklist;
  users: AssignableUser[];
  currentUserId: string;
  currentUserRole: Role;
};

type ActiveTab = "details" | "channel";

export function TaskDetail({ task: initialTask, users, currentUserId, currentUserRole }: TaskDetailProps) {
  const [task, setTask] = useState(initialTask);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialTask.checklist);
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [isApproving, startApprove] = useTransition();

  const isAdmin = currentUserRole === "admin" || currentUserRole === "superadmin";
  // Staff can only check/uncheck if the task is assigned to them
  const isAssignee = task.assigned_to === currentUserId;
  const canEditChecklist = isAdmin || isAssignee;
  const hasChecklist = checklist.length > 0;

  // Derive display status and progress from checklist when one exists
  const displayStatus = hasChecklist
    ? computeStatusFromChecklist(checklist, task.status)
    : task.status;
  const displayProgress = hasChecklist ? computeProgress(checklist) : task.progress;

  const statusStyle = STATUS_STYLES[displayStatus];
  const overdue = isOverdue(task.due_date, displayStatus);
  const completedCount = checklist.filter((i) => i.completed).length;
  const assignee = users.find((u) => u.userId === task.assigned_to);

  function handleChecklistToggle(
    id: string, completed: boolean,
    newStatus?: TaskStatus, newProgress?: number,
  ) {
    setChecklist((prev) => prev.map((i) => i.id === id ? { ...i, completed } : i));
    if (newStatus) setTask((prev) => ({ ...prev, status: newStatus, progress: newProgress ?? prev.progress }));
  }

  function handleChecklistDelete(id: string, newStatus?: TaskStatus, newProgress?: number) {
    setChecklist((prev) => prev.filter((i) => i.id !== id));
    if (newStatus) setTask((prev) => ({ ...prev, status: newStatus, progress: newProgress ?? prev.progress }));
  }

  function handleChecklistAdd(item: ChecklistItem) {
    setChecklist((prev) => [...prev, item]);
  }

  function handleApprove() {
    startApprove(async () => {
      await approveTaskCompletion(task.id);
      setTask((prev) => ({ ...prev, status: "completed" }));
    });
  }

  // Admin can still manually change status when no checklist
  function handleManualStatusChange(status: TaskStatus) {
    startApprove(async () => {
      await updateTaskStatus(task.id, status);
      setTask((prev) => ({ ...prev, status }));
    });
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/inventory/tasks"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </Link>

      {/* Page header */}
      <div className="rounded-2xl bg-linear-to-r from-slate-50 to-blue-50 border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
            <p className="mt-1 text-sm text-gray-500">Task details, status, and checklist progress.</p>
          </div>
          {/* Approve button — admin only, when pending_approval */}
          {isAdmin && displayStatus === "pending_approval" ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark as Complete
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Status badge — auto-managed when checklist exists */}
          <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold", statusStyle.badge)}>
            {hasChecklist ? "Auto: " : ""}{statusStyle.label}
          </span>

          {/* Manual status selector — admin only, no checklist */}
          {isAdmin && !hasChecklist ? (
            <select
              value={task.status}
              onChange={(e) => handleManualStatusChange(e.target.value as TaskStatus)}
              disabled={isApproving}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="completed">Completed</option>
            </select>
          ) : null}

          <span className={cn("text-sm font-semibold", PRIORITY_COLORS[task.priority])}>
            Priority: {PRIORITY_LABELS[task.priority]}
          </span>

          {task.due_date ? (
            <span className={cn("flex items-center gap-1 text-sm font-medium", overdue ? "text-red-600" : "text-gray-600")}>
              {overdue ? <AlertCircle className="h-3.5 w-3.5" /> : null}
              Due: {formatDateTime(task.due_date)}
              {overdue ? " — Overdue" : ""}
            </span>
          ) : null}

          {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden w-fit">
        {(["details", "channel"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors",
              activeTab === tab ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50",
            )}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "details" ? (
        <div className="space-y-5">
          {/* Status banner */}
          <StatusBanner checklist={checklist} status={displayStatus} />

          {/* Description */}
          {task.description ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          ) : null}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Priority</p>
              <p className={cn("text-sm font-bold", PRIORITY_COLORS[task.priority])}>
                {PRIORITY_LABELS[task.priority]}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Start Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDateTime(task.start_date)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Due Date</p>
              <p className={cn("text-sm font-medium", overdue ? "text-red-600" : "text-gray-900")}>
                {formatDateTime(task.due_date)}
                {overdue ? <span className="ml-1 text-xs text-red-500">(Overdue)</span> : null}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Assigned To</p>
              {assignee ? (
                <div className="flex flex-col items-center gap-1 pt-1">
                  <UserAvatar name={assignee.displayName} email={assignee.email} />
                  <p className="text-xs font-medium text-gray-700 text-center mt-1">
                    {assignee.displayName ?? assignee.email}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Unassigned</p>
              )}
            </div>
          </div>

          {/* Todo checklist */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Todo Checklist</h2>
                {hasChecklist ? (
                  <p className="mt-0.5 text-xs text-gray-400">
                    {completedCount} of {checklist.length} completed
                    {hasChecklist ? " — status auto-updates as you check items" : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-gray-400">No items yet. Add todos below.</p>
                )}
              </div>
              {hasChecklist ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-8 text-right">{displayProgress}%</span>
                </div>
              ) : null}
            </div>

            {/* Workflow hint for staff */}
            {!isAdmin && !isAssignee && hasChecklist ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-700">Only the task assignee can check off todos.</p>
              </div>
            ) : null}

            {/* Checklist items */}
            {checklist.length > 0 ? (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    taskId={task.id}
                    users={users}
                    canEdit={canEditChecklist}
                    onToggle={handleChecklistToggle}
                    onDelete={handleChecklistDelete}
                  />
                ))}
              </div>
            ) : null}

            {/* Add item — admin only */}
            {isAdmin ? (
              <AddChecklistForm taskId={task.id} users={users} onAdd={handleChecklistAdd} />
            ) : null}
          </div>

          {/* Project Pulse */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-bold text-gray-900">Project Pulse</h2>
            <p className="mt-0.5 text-xs text-gray-400">Track status, due dates and collaboration at a glance.</p>
            <div className="mt-5 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={cn(
                  "text-3xl font-bold",
                  displayProgress >= 100 ? "text-green-500" : displayProgress > 0 ? "text-blue-500" : "text-gray-400",
                )}>
                  {displayProgress}%
                </p>
                <p className="mt-1 text-xs text-gray-400">Progress</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-700">{checklist.length}</p>
                <p className="mt-1 text-xs text-gray-400">Total todos</p>
              </div>
              <div>
                <p className={cn("text-3xl font-bold", completedCount === checklist.length && checklist.length > 0 ? "text-green-500" : "text-gray-700")}>
                  {completedCount}
                </p>
                <p className="mt-1 text-xs text-gray-400">Completed</p>
              </div>
            </div>

            {/* Visual status flow */}
            {hasChecklist ? (
              <div className="mt-5 flex items-center gap-0">
                {(["pending", "in_progress", "pending_approval", "completed"] as TaskStatus[]).map((s, i, arr) => {
                  const style = STATUS_STYLES[s];
                  const isActive = displayStatus === s;
                  const isPast = arr.indexOf(displayStatus) > i;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <div className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center transition-all",
                        isActive ? "ring-2 ring-blue-400 ring-offset-1" : "",
                      )}>
                        <span className={cn(
                          "h-3 w-3 rounded-full",
                          isActive ? "bg-blue-500" : isPast ? "bg-green-400" : "bg-gray-200",
                        )} />
                        <span className={cn(
                          "text-[10px] font-semibold leading-tight",
                          isActive ? "text-blue-700" : isPast ? "text-green-600" : "text-gray-400",
                        )}>
                          {style.label}
                        </span>
                      </div>
                      {i < arr.length - 1 ? (
                        <div className={cn("h-0.5 w-3 shrink-0", isPast || isActive ? "bg-blue-300" : "bg-gray-200")} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-400">Channel / messaging coming soon.</p>
          <p className="mt-1 text-xs text-gray-300">Team comments and updates will appear here.</p>
        </div>
      )}
    </div>
  );
}
