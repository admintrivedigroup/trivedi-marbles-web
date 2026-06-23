"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task, TaskStatus } from "@/app/inventory/_lib/tasks";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_DOT: Record<TaskStatus, string> = {
  draft: "bg-gray-400",
  pending: "bg-orange-400",
  in_progress: "bg-blue-500",
  pending_approval: "bg-purple-500",
  completed: "bg-green-500",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  completed: "Completed",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

function formatTaskTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TasksCalendarProps = {
  initialTasks: Task[];
};

// ─── Main component ───────────────────────────────────────────────────────────

export function TasksCalendar({ initialTasks }: TasksCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().slice(0, 10),
  );

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(today.toISOString().slice(0, 10));
  }

  // Build calendar grid
  const { calendarDays, dueThisMonth } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    // Map of yyyy-mm-dd → tasks due that day
    const dueMap = new Map<string, Task[]>();
    for (const task of initialTasks) {
      const date = task.due_date?.slice(0, 10);
      if (!date) continue;
      if (!dueMap.has(date)) dueMap.set(date, []);
      dueMap.get(date)!.push(task);
    }

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; tasks: Task[] }[] = [];

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrev - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: false, tasks: dueMap.get(dateStr) ?? [] });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: true, tasks: dueMap.get(dateStr) ?? [] });
    }

    // Trailing days to fill last row
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: false, tasks: dueMap.get(dateStr) ?? [] });
    }

    // Count due this month
    let dueThisMonth = 0;
    for (const task of initialTasks) {
      const d = task.due_date ? new Date(task.due_date) : null;
      if (d && d.getFullYear() === year && d.getMonth() === month) dueThisMonth++;
    }

    return { calendarDays: days, dueThisMonth };
  }, [initialTasks, year, month]);

  const todayStr = today.toISOString().slice(0, 10);
  const dueToday = initialTasks.filter((t) => t.due_date?.slice(0, 10) === todayStr).length;

  const selectedTasks = useMemo(
    () => initialTasks.filter((t) => t.due_date?.slice(0, 10) === selectedDate),
    [initialTasks, selectedDate],
  );

  const selectedDisplayDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return formatDateHeader(d);
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Calendar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Visualize upcoming work and spot busy dates quickly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          Month — {MONTHS[month]} {year}
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          {dueThisMonth} due this month
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          {dueToday} due today
        </span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Calendar</p>
            <p className="text-sm text-gray-700 font-medium">Due dates mapped per day</p>
            <p className="text-xs text-gray-400">Tap a date tile to see every task due that day.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-200" /> Weekends
            </span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, dateStr, isCurrentMonth, tasks }) => {
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isWeekend = isSunday(date) || isSaturday(date);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "relative min-h-[72px] border-b border-r border-gray-100 p-2 text-left transition-colors last:border-r-0",
                  isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100/60",
                  isWeekend && !isCurrentMonth && "bg-red-50/30",
                  isWeekend && isCurrentMonth && "bg-red-50/20",
                  isSelected && "ring-2 ring-inset ring-gray-900",
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday
                      ? "bg-blue-500 text-white"
                      : isCurrentMonth
                      ? "text-gray-700"
                      : "text-gray-300",
                    isWeekend && isCurrentMonth && !isToday && "text-red-400",
                  )}
                >
                  {date.getDate()}
                </span>
                {isToday && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-blue-400">Today</span>}
                {isWeekend && isCurrentMonth && !isToday && (
                  <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide text-red-300">
                    {isSunday(date) ? "Sunday" : "Saturday"}
                  </span>
                )}

                {/* Task indicators */}
                {tasks.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {tasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 overflow-hidden"
                        title={t.title}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[t.status])} />
                        <span className="truncate text-[10px] text-gray-600">{t.title}</span>
                      </div>
                    ))}
                    {tasks.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{tasks.length - 2} more</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks due on selected date */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tasks Due</p>
            <p className="text-base font-semibold text-gray-900">{selectedDisplayDate}</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-orange-500">• Pending</span>
            <span className="text-blue-500">• In Progress</span>
            <span className="text-green-500">• Completed</span>
          </div>
        </div>

        {selectedTasks.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-10 text-center">
            <p className="text-sm text-gray-400">No tasks are due on this date. Pick another day from the calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", STATUS_DOT[task.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  {task.description ? (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{task.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className={cn("font-medium", STATUS_DOT[task.status].replace("bg-", "text-"))}>
                      {STATUS_LABEL[task.status]}
                    </span>
                    {task.due_date ? (
                      <span>{formatTaskTime(task.due_date)}</span>
                    ) : null}
                    {task.assigned_name ? (
                      <span>Assigned: {task.assigned_name}</span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="w-16 text-right text-xs font-semibold text-gray-700">{task.progress}%</div>
                  <div className="mt-1 h-1.5 w-16 rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
