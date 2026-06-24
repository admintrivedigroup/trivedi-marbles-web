"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Task, TaskStatus } from "@/app/inventory/_lib/tasks";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; pill: string }> = {
  draft:            { label: "Draft",            dot: "bg-gray-400",   pill: "bg-gray-100 border-gray-200 text-gray-600"    },
  pending:          { label: "Pending",          dot: "bg-orange-400", pill: "bg-orange-50 border-orange-200 text-orange-700" },
  in_progress:      { label: "In Progress",      dot: "bg-blue-500",   pill: "bg-blue-50 border-blue-200 text-blue-700"      },
  pending_approval: { label: "Pending Approval", dot: "bg-purple-500", pill: "bg-purple-50 border-purple-200 text-purple-700" },
  completed:        { label: "Completed",        dot: "bg-green-500",  pill: "bg-green-50 border-green-200 text-green-700"   },
};

const ALL_STATUSES: TaskStatus[] = ["draft", "pending", "in_progress", "pending_approval", "completed"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSunday(d: Date)   { return d.getDay() === 0; }
function isSaturday(d: Date) { return d.getDay() === 6; }

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function hasIncomplete(tasks: Task[]): boolean {
  return tasks.some((t) => t.status !== "completed" && t.status !== "draft");
}

// ─── Month / Year picker ──────────────────────────────────────────────────────

function MonthYearPicker({
  year, month, onSelect, onClose,
}: {
  year: number; month: number;
  onSelect: (y: number, m: number) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setPickerYear((y) => y - 1)}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-gray-900">{pickerYear}</span>
        <button type="button" onClick={() => setPickerYear((y) => y + 1)}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(pickerYear, i)}
            className={cn(
              "rounded-lg py-1.5 text-xs font-medium transition-colors",
              month === i && year === pickerYear
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {m.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Upcoming 7-day strip ─────────────────────────────────────────────────────

function UpcomingStrip({
  tasks, todayStr, onSelect,
}: {
  tasks: Task[];
  todayStr: string;
  onSelect: (dateStr: string, year: number, month: number) => void;
}) {
  const days = useMemo(() => {
    const base = new Date(todayStr + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTasks = tasks.filter((t) => t.due_date?.slice(0, 10) === dateStr);
      return { date: d, dateStr, tasks: dayTasks };
    });
  }, [tasks, todayStr]);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-2 min-w-max">
        {days.map(({ date, dateStr, tasks: dt }, i) => {
          const isToday     = i === 0;
          const isTomorrow  = i === 1;
          const label       = isToday ? "Today" : isTomorrow ? "Tomorrow" : DAYS[date.getDay()];
          const hasTasks    = dt.length > 0;
          const statusesPresent = ALL_STATUSES.filter((s) => dt.some((t) => t.status === s));

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelect(dateStr, date.getFullYear(), date.getMonth())}
              className={cn(
                "flex min-w-18 flex-col items-center rounded-xl border px-3 py-2.5 transition-all",
                isToday
                  ? "border-blue-200 bg-blue-50"
                  : hasTasks
                  ? "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  : "border-gray-100 bg-gray-50/60 hover:bg-gray-50",
              )}
            >
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                isToday ? "text-blue-500" : "text-gray-400",
              )}>
                {label}
              </span>
              <span className={cn(
                "my-1 text-xl font-extrabold leading-none",
                isToday ? "text-blue-700" : hasTasks ? "text-gray-800" : "text-gray-300",
              )}>
                {date.getDate()}
              </span>
              {hasTasks ? (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {statusesPresent.map((s) => (
                    <span key={s} className={cn("h-1.5 w-1.5 rounded-full", STATUS_CONFIG[s].dot)} />
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-gray-300">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TasksCalendarProps = { initialTasks: Task[] };

export function TasksCalendar({ initialTasks }: TasksCalendarProps) {
  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [year,          setYear]          = useState(today.getFullYear());
  const [month,         setMonth]         = useState(today.getMonth());
  const [selectedDate,  setSelectedDate]  = useState(todayStr);
  const [activeStatuses, setActiveStatuses] = useState<Set<TaskStatus>>(new Set(ALL_STATUSES));
  const [showPicker,    setShowPicker]    = useState(false);

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
    setSelectedDate(todayStr);
  }
  function toggleStatus(s: TaskStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }
  function handleUpcomingSelect(dateStr: string, y: number, m: number) {
    setSelectedDate(dateStr);
    setYear(y);
    setMonth(m);
  }

  // Tasks filtered by active status chips
  const filteredTasks = useMemo(
    () => initialTasks.filter((t) => activeStatuses.has(t.status)),
    [initialTasks, activeStatuses],
  );

  // Calendar grid (uses filtered tasks for pill display)
  const calendarDays = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    const dueMap = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const d = task.due_date?.slice(0, 10);
      if (!d) continue;
      if (!dueMap.has(d)) dueMap.set(d, []);
      dueMap.get(d)!.push(task);
    }

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; tasks: Task[] }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrev - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: false, tasks: dueMap.get(dateStr) ?? [] });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: true, tasks: dueMap.get(dateStr) ?? [] });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, isCurrentMonth: false, tasks: dueMap.get(dateStr) ?? [] });
    }
    return days;
  }, [filteredTasks, year, month]);

  // Stats (always from all tasks regardless of filter)
  const dueThisMonth = useMemo(
    () => initialTasks.filter((t) => {
      const d = t.due_date ? new Date(t.due_date) : null;
      return d && d.getFullYear() === year && d.getMonth() === month;
    }).length,
    [initialTasks, year, month],
  );
  const dueToday = useMemo(
    () => initialTasks.filter((t) => t.due_date?.slice(0, 10) === todayStr).length,
    [initialTasks, todayStr],
  );
  const overdueCount = useMemo(
    () => initialTasks.filter((t) => {
      const ds = t.due_date?.slice(0, 10);
      return ds && ds < todayStr && t.status !== "completed" && t.status !== "draft";
    }).length,
    [initialTasks, todayStr],
  );

  // Side panel: selected date tasks (filtered)
  const selectedTasks = useMemo(
    () => filteredTasks.filter((t) => t.due_date?.slice(0, 10) === selectedDate),
    [filteredTasks, selectedDate],
  );
  const selectedDisplayDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [selectedDate]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Calendar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Visualize upcoming work and spot busy dates quickly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth}
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Month / year picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker((p) => !p)}
              className="min-w-36 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              {MONTHS[month]} {year}
            </button>
            {showPicker && (
              <MonthYearPicker
                year={year}
                month={month}
                onSelect={(y, m) => { setYear(y); setMonth(m); setShowPicker(false); }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>

          <button type="button" onClick={nextMonth}
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={goToday}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
            Today
          </button>
        </div>
      </div>

      {/* ── Stats chips ── */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          {dueThisMonth} due in {MONTHS[month]}
        </span>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {dueToday} due today
        </span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            <AlertCircle className="h-3 w-3" />
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* ── Status filter chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Filter:</span>
        {ALL_STATUSES.map((s) => {
          const active = activeStatuses.has(s);
          const cfg    = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                active
                  ? cn("border", cfg.pill)
                  : "border-gray-200 bg-white text-gray-400 opacity-50 hover:opacity-75",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", active ? cfg.dot : "bg-gray-300")} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Upcoming 7 days ── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Upcoming 7 days</p>
        <UpcomingStrip tasks={filteredTasks} todayStr={todayStr} onSelect={handleUpcomingSelect} />
      </div>

      {/* ── Calendar + side panel ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Calendar grid */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white">

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Due dates per day</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Today</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-300" />Weekend</span>
              <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-400" />Overdue</span>
              {ALL_STATUSES.map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_CONFIG[s].dot)} />
                  {STATUS_CONFIG[s].label}
                </span>
              ))}
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, dateStr, isCurrentMonth, tasks }) => {
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isWeekend  = isSunday(date) || isSaturday(date);
              const isPast     = dateStr < todayStr;
              const hasOverdue = isPast && isCurrentMonth && hasIncomplete(tasks);

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "relative min-h-20 cursor-pointer border-b border-r border-gray-100 p-1.5 transition-colors",
                    isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/40 hover:bg-gray-100/40",
                    isWeekend && isCurrentMonth && !hasOverdue && "bg-red-50/20 hover:bg-red-50/40",
                    hasOverdue && "bg-red-50/60 hover:bg-red-50/80",
                    isSelected && "ring-2 ring-inset ring-gray-900",
                  )}
                >
                  {/* Day number row */}
                  <div className="mb-1 flex items-center gap-1">
                    <span className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday      ? "bg-blue-500 text-white"
                        : isCurrentMonth ? "text-gray-700"
                        : "text-gray-300",
                      isWeekend && isCurrentMonth && !isToday && "text-red-400",
                    )}>
                      {date.getDate()}
                    </span>
                    {hasOverdue && <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />}
                    {isToday && !hasOverdue && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400">Today</span>
                    )}
                  </div>

                  {/* Task pills */}
                  {tasks.length > 0 && (
                    <div className="space-y-0.5">
                      {tasks.slice(0, 2).map((t) => (
                        <Link
                          key={t.id}
                          href={`/inventory/tasks/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t.title}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight hover:opacity-80 transition-opacity",
                            STATUS_CONFIG[t.status].pill,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_CONFIG[t.status].dot)} />
                          <span className="truncate">{t.title}</span>
                        </Link>
                      ))}
                      {tasks.length > 2 && (
                        <span className="block pl-1 text-[10px] text-gray-400">
                          +{tasks.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="w-full shrink-0 lg:w-80">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">

            {/* Panel header */}
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tasks Due</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900 leading-snug">{selectedDisplayDate}</p>
              {selectedDate === todayStr && (
                <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Today
                </span>
              )}
            </div>

            {/* Task list */}
            {selectedTasks.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <CalendarDays className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">No tasks due</p>
                <p className="mt-1 text-xs text-gray-300">Click a date on the calendar to see tasks.</p>
              </div>
            ) : (
              <div className="max-h-140 divide-y divide-gray-50 overflow-y-auto">
                {selectedTasks.map((task) => {
                  const cfg = STATUS_CONFIG[task.status];
                  return (
                    <Link
                      key={task.id}
                      href={`/inventory/tasks/${task.id}`}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", cfg.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{task.description}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.pill)}>
                            {cfg.label}
                          </span>
                          {task.due_date ? (
                            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                              <Clock className="h-3 w-3" />
                              {formatTime(task.due_date)}
                            </span>
                          ) : null}
                          {task.assigned_name ? (
                            <span className="truncate text-[10px] text-gray-400">{task.assigned_name}</span>
                          ) : null}
                        </div>
                        {/* Progress */}
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">Progress</span>
                            <span className="text-[10px] font-semibold text-gray-600">{task.progress}%</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-gray-100">
                            <div
                              className={cn("h-full rounded-full transition-all", task.progress >= 100 ? "bg-green-500" : "bg-blue-500")}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
