"use client";

import { useState, useTransition, useMemo, useRef, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { KraColumn, KraEntry } from "@/app/inventory/_lib/kra-shared";
import { FISCAL_MONTHS } from "@/app/inventory/_lib/kra-shared";
import {
  upsertKraEntry,
  createKraColumn,
  updateKraColumn,
  deleteKraColumn,
  moveKraColumn,
  type KraColumnFormData,
} from "@/app/inventory/_actions/kra";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KraUser = { userId: string; email: string; displayName: string | null };

type KraManagerProps = {
  columns: KraColumn[];
  entries: KraEntry[];
  users: KraUser[];
  isAdmin: boolean;
  selectedEmployeeId: string;
  selectedYear: string;
  financialYears: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "0";
  return String(parseFloat(n.toFixed(4)));
}

function displayName(u: KraUser): string {
  return u.displayName ? `${u.displayName} (${u.email})` : u.email;
}

function getCurrentFiscalMonth(selectedYear: string): number | null {
  const [startYearStr] = selectedYear.split("-");
  const startYear = parseInt(startYearStr);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const inFirst  = y === startYear     && m >= 3;
  const inSecond = y === startYear + 1 && m <= 2;
  if (!inFirst && !inSecond) return null;
  return m >= 3 ? m - 2 : m + 10;
}

function getFyPhase(selectedYear: string): "past" | "current" | "future" {
  const [startStr] = selectedYear.split("-");
  const fyStart = parseInt(startStr);
  const now = new Date();
  const curFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  if (fyStart < curFyStart) return "past";
  if (fyStart > curFyStart) return "future";
  return "current";
}

function defaultCollapsed(selectedYear: string): Set<number> {
  const cur = getCurrentFiscalMonth(selectedYear);
  if (cur === null) return new Set();
  const s = new Set<number>();
  for (const fm of FISCAL_MONTHS) { if (fm.num !== cur) s.add(fm.num); }
  return s;
}

// Returns green/amber/red text class based on % of max.
function scoreTextClass(score: number, max: number): string {
  if (score === 0 || max === 0) return "text-gray-400";
  const p = score / max;
  if (p >= 0.7)  return "text-emerald-700 font-bold";
  if (p >= 0.4)  return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
}

// ─── Trend chart ──────────────────────────────────────────────────────────────

function TrendChart({
  monthlyTotals,
  maxMonthly,
  currentFiscalMonth,
}: {
  monthlyTotals: number[];
  maxMonthly: number;
  currentFiscalMonth: number | null;
}) {
  const peak = Math.max(maxMonthly, ...monthlyTotals, 1);
  const hasAnyData = monthlyTotals.some((v) => v > 0);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Monthly Score Trend</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-700">
            {hasAnyData ? "Performance over the financial year" : "No data entered yet for this year"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />≥70%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />40–70%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />&lt;40%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-100 ring-1 ring-inset ring-gray-200" />No data
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative" style={{ height: "96px" }}>
        {/* Horizontal grid lines */}
        {[25, 50, 75, 100].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-dashed border-gray-100"
            style={{ bottom: `${pct}%` }}
          >
            <span className="absolute -top-2.5 -left-1 text-[9px] text-gray-300 tabular-nums">
              {fmt((peak * pct) / 100)}
            </span>
          </div>
        ))}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1 pl-4">
          {FISCAL_MONTHS.map((fm, i) => {
            const score  = monthlyTotals[i] ?? 0;
            const hPct   = peak > 0 ? (score / peak) * 100 : 0;
            const pct    = maxMonthly > 0 ? score / maxMonthly : 0;
            const isCur  = fm.num === currentFiscalMonth;
            const color  =
              score === 0    ? "bg-gray-100"
              : pct >= 0.7   ? "bg-emerald-500"
              : pct >= 0.4   ? "bg-amber-400"
              :                "bg-red-400";

            return (
              <div key={fm.num} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full items-end" style={{ height: "80px" }}>
                  {/* Empty placeholder bar */}
                  <div className="absolute bottom-0 w-full rounded-t-sm bg-gray-50" style={{ height: "3px" }} />
                  {/* Actual bar */}
                  {score > 0 && (
                    <div
                      title={`${fm.label}: ${fmt(score)}`}
                      className={cn(
                        "absolute bottom-0 w-full rounded-t-md transition-all duration-500",
                        color,
                        isCur && "ring-2 ring-blue-400 ring-offset-1",
                      )}
                      style={{ height: `${Math.max(hPct, 6)}%` }}
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-bold",
                  isCur ? "text-blue-600" : "text-gray-300",
                )}>
                  {fm.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Max reference line label */}
      {maxMonthly > 0 && (
        <p className="mt-3 text-right text-[10px] text-gray-400">
          Max possible per month: <span className="font-semibold text-gray-500">{fmt(maxMonthly)}</span>
        </p>
      )}
    </div>
  );
}

// ─── Editable cell ────────────────────────────────────────────────────────────

function EditableCell({
  value,
  hasEntry,
  onSave,
  editable,
  saving,
  lastUpdated,
}: {
  value: number | null;
  hasEntry: boolean;
  onSave: (v: number) => void;
  editable: boolean;
  saving: boolean;
  lastUpdated?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const isEmpty   = !hasEntry;
  const display   = isEmpty ? "—" : fmt(value ?? 0);

  if (saving) {
    return <span className="animate-pulse text-xs text-gray-300">…</span>;
  }

  if (!editable || !editing) {
    return (
      <span
        title={
          editable
            ? lastUpdated
              ? `Last updated: ${new Date(lastUpdated).toLocaleString("en-IN")}`
              : "Click to add data"
            : undefined
        }
        onClick={() => {
          if (editable) {
            setDraft(isEmpty ? "" : display === "0" ? "" : display);
            setEditing(true);
          }
        }}
        className={cn(
          "group/cell relative inline-flex items-center gap-1 rounded px-1 py-0.5",
          editable && "cursor-pointer hover:bg-blue-50/60",
          isEmpty ? "text-gray-300" : "tabular-nums text-gray-800",
        )}
      >
        {display}
        {editable && (
          <Pencil className="h-2.5 w-2.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover/cell:opacity-100" />
        )}
      </span>
    );
  }

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(parseFloat(draft) || 0); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-16 rounded-lg border border-blue-300 bg-blue-50 px-1 py-0.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      autoFocus
    />
  );
}

// ─── Column form modal ────────────────────────────────────────────────────────

const EMPTY_COL: KraColumnFormData = {
  label: "", weightage: 40, target: "100", source: "",
  frequency: "MONTHLY", approval_required: true, active: true,
};

function ColumnFormModal({
  initial, onClose, onSave, saving, error,
}: {
  initial: KraColumnFormData | null;
  onClose: () => void;
  onSave: (d: KraColumnFormData) => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<KraColumnFormData>(initial ?? EMPTY_COL);
  function set<K extends keyof KraColumnFormData>(k: K, v: KraColumnFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  const inp = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white transition-shadow";
  const lbl = "block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-blue-50 to-indigo-50 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{initial ? "Edit KRA Column" : "Add KRA Column"}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Configure this performance metric</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className={lbl}>Label</label>
            <input type="text" value={form.label} onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. Tasks Completed On Time" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Weightage %</label>
              <input type="number" min={0} max={100} value={form.weightage}
                onChange={(e) => set("weightage", parseFloat(e.target.value) || 0)} className={inp} />
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, form.weightage)}%` }} />
              </div>
            </div>
            <div>
              <label className={lbl}>Target</label>
              <input type="text" value={form.target} onChange={(e) => set("target", e.target.value)}
                placeholder="e.g. 100% or 10" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Source</label>
            <input type="text" value={form.source} onChange={(e) => set("source", e.target.value)}
              placeholder="e.g. Task Management (Daily Tasks)" className={inp} />
          </div>
          <div>
            <label className={lbl}>Frequency</label>
            <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className={inp}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </div>
          <div className="flex gap-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={form.approval_required}
                onChange={(e) => set("approval_required", e.target.checked)}
                className="h-4 w-4 rounded accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">Approval Required</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600" />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(form)} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Add Column"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, sub,
  accentBorder = "border-l-blue-400",
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
  progress,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accentBorder?: string;
  iconBg?: string;
  iconColor?: string;
  progress?: { value: number; max: number };
}) {
  const progPct = progress && progress.max > 0
    ? Math.round((progress.value / progress.max) * 100)
    : 0;
  const progColor = progPct >= 70 ? "bg-emerald-500" : progPct >= 40 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-gray-100 border-l-4 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md",
      accentBorder,
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-extrabold leading-none text-gray-900">{value}</p>
          {sub ? <p className="mt-1.5 truncate text-xs text-gray-400">{sub}</p> : null}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
      {progress ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">{fmt(progress.value)} of {fmt(progress.max)} max</span>
            <span className={cn(
              "font-bold",
              progPct >= 70 ? "text-emerald-600" : progPct >= 40 ? "text-amber-600" : "text-red-500",
            )}>{progPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progColor)}
              style={{ width: `${Math.min(100, progPct)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Column card (admin config) ───────────────────────────────────────────────

function ColumnCard({
  col, idx, total, onEdit, onDelete, onMove, isMoving,
}: {
  col: KraColumn;
  idx: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  isMoving: boolean;
}) {
  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-2xl border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
      col.active ? "border-l-emerald-400 border border-gray-100" : "border-l-gray-300 border border-gray-100",
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            col.active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", col.active ? "bg-emerald-500" : "bg-gray-400")} />
            {col.active ? "Active" : "Inactive"}
          </span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
            {col.frequency}
          </span>
          {col.approval_required && (
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
              Approval
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" disabled={idx === 0 || isMoving} onClick={() => onMove("up")}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={idx === total - 1 || isMoving} onClick={() => onMove("down")}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Column name */}
      <div>
        <button type="button" onClick={onEdit} className="text-left text-base font-bold text-gray-900 hover:text-blue-600 transition-colors">
          {col.label}
        </button>
        {col.source && (
          <p className="mt-0.5 text-xs text-gray-400 truncate">{col.source}</p>
        )}
      </div>

      {/* Weightage bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-600">Weightage</span>
          <span className="font-extrabold text-gray-900">{col.weightage}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-400 to-blue-600 transition-all"
            style={{ width: `${Math.min(100, col.weightage)}%` }}
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-gray-500">
        <span>Target: <span className="font-semibold text-gray-700">{col.target}</span></span>
        <span className="text-gray-200">·</span>
        <span>Order: <span className="font-semibold text-gray-700">#{col.display_order}</span></span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KraManager({
  columns: initColumns,
  entries: initEntries,
  users,
  isAdmin,
  selectedEmployeeId,
  selectedYear,
  financialYears,
}: KraManagerProps) {
  const router = useRouter();
  const [columns,         setColumns]         = useState<KraColumn[]>(initColumns);
  const [entries,         setEntries]         = useState<KraEntry[]>(initEntries);
  const [savingCells,     setSavingCells]     = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(
    () => defaultCollapsed(selectedYear),
  );
  const [colModal,        setColModal]        = useState<KraColumn | "new" | null>(null);
  const [colModalError,   setColModalError]   = useState<string | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<KraColumn | null>(null);
  const [isColSaving,     startColSave]       = useTransition();
  const [isDeleting,      startDelete]        = useTransition();
  const [isMoving,        startMove]          = useTransition();

  const currentMonthRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      currentMonthRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(id);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentFiscalMonth = useMemo(() => getCurrentFiscalMonth(selectedYear), [selectedYear]);
  const fyPhase            = useMemo(() => getFyPhase(selectedYear), [selectedYear]);

  const activeColumns = useMemo(
    () => columns.filter((c) => c.active).sort((a, b) => a.display_order - b.display_order),
    [columns],
  );

  const entryMap = useMemo(() => {
    const m = new Map<string, KraEntry>();
    for (const e of entries) m.set(`${e.column_id}-${e.fiscal_month}`, e);
    return m;
  }, [entries]);

  const colScore = useMemo(() => {
    const r: Record<string, number[]> = {};
    for (const col of activeColumns) {
      r[col.id] = FISCAL_MONTHS.map((fm) => {
        const e = entryMap.get(`${col.id}-${fm.num}`);
        return (e?.points ?? 0) * (col.weightage / 100);
      });
    }
    return r;
  }, [activeColumns, entryMap]);

  const monthlyTotals = useMemo(
    () => FISCAL_MONTHS.map((_, i) =>
      activeColumns.reduce((s, col) => s + (colScore[col.id]?.[i] ?? 0), 0),
    ),
    [activeColumns, colScore],
  );

  const annualScore  = useMemo(() => monthlyTotals.reduce((s, v) => s + v, 0), [monthlyTotals]);
  const averageScore = annualScore / 12;

  const maxMonthlyScore = useMemo(
    () => activeColumns.reduce((s, c) => s + c.weightage, 0),
    [activeColumns],
  );
  const maxAnnualScore = maxMonthlyScore * 12;

  const topMonth = useMemo(() => {
    let best = { idx: 0, score: -Infinity };
    monthlyTotals.forEach((score, i) => { if (score > best.score) best = { idx: i, score }; });
    return { label: FISCAL_MONTHS[best.idx].label, score: best.score };
  }, [monthlyTotals]);

  const totalActiveWeightage = useMemo(
    () => activeColumns.reduce((s, c) => s + c.weightage, 0),
    [activeColumns],
  );

  const selectedUser = users.find((u) => u.userId === selectedEmployeeId);
  const totalCols    = activeColumns.length + 2;

  // Determine the "phase" of a specific fiscal month for coloring
  function getMonthPhase(fmNum: number): "past-empty" | "past-data" | "current" | "future" {
    if (fyPhase === "past") {
      const hasData = activeColumns.some((c) => entryMap.has(`${c.id}-${fmNum}`));
      return hasData ? "past-data" : "past-empty";
    }
    if (fyPhase === "future") return "future";
    // current FY
    if (fmNum === currentFiscalMonth) return "current";
    if (currentFiscalMonth !== null && fmNum < currentFiscalMonth) {
      const hasData = activeColumns.some((c) => entryMap.has(`${c.id}-${fmNum}`));
      return hasData ? "past-data" : "past-empty";
    }
    return "future";
  }

  // ── Cell save ─────────────────────────────────────────────────────────────

  async function saveEntry(
    columnId: string, fiscalMonth: number,
    field: "points" | "reverse_points", value: number,
  ) {
    const key = `${columnId}-${fiscalMonth}-${field}`;
    setSavingCells((prev) => new Set(prev).add(key));

    const existing  = entryMap.get(`${columnId}-${fiscalMonth}`);
    const newPoints = field === "points" ? value : (existing?.points ?? 0);
    const newRP     = field === "reverse_points" ? value : (existing?.reverse_points ?? null);

    setEntries((prev) => {
      const hit = prev.find((e) => e.column_id === columnId && e.fiscal_month === fiscalMonth);
      if (hit) {
        return prev.map((e) =>
          e.column_id === columnId && e.fiscal_month === fiscalMonth
            ? { ...e, points: newPoints, reverse_points: newRP, updated_at: new Date().toISOString() }
            : e,
        );
      }
      return [...prev, {
        id: `tmp-${key}`, column_id: columnId, employee_id: selectedEmployeeId,
        financial_year: selectedYear, fiscal_month: fiscalMonth,
        points: newPoints, reverse_points: newRP,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }];
    });

    await upsertKraEntry(columnId, selectedEmployeeId, selectedYear, fiscalMonth, newPoints, newRP);
    setSavingCells((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  // ── Column operations ─────────────────────────────────────────────────────

  function handleColSave(data: KraColumnFormData) {
    setColModalError(null);
    if (!data.label.trim()) { setColModalError("Label is required."); return; }
    startColSave(async () => {
      if (colModal === "new") {
        const res = await createKraColumn(selectedEmployeeId, data);
        if (!res.success) { setColModalError(res.error); return; }
        setColumns((prev) => [...prev, {
          id: res.id, employee_id: selectedEmployeeId, ...data,
          display_order: (prev[prev.length - 1]?.display_order ?? 0) + 1,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
      } else if (colModal) {
        const res = await updateKraColumn(colModal.id, data);
        if (!res.success) { setColModalError(res.error); return; }
        setColumns((prev) => prev.map((c) => c.id === colModal.id ? { ...c, ...data } : c));
      }
      setColModal(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startDelete(async () => {
      await deleteKraColumn(id);
      setColumns((prev) => prev.filter((c) => c.id !== id));
      setEntries((prev) => prev.filter((e) => e.column_id !== id));
      setDeleteTarget(null);
    });
  }

  function handleMove(col: KraColumn, dir: "up" | "down") {
    startMove(async () => {
      const res = await moveKraColumn(col.id, dir, selectedEmployeeId);
      if (!res.success) return;
      setColumns((prev) => {
        const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
        const idx  = sorted.findIndex((c) => c.id === col.id);
        const swap = dir === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= sorted.length) return prev;
        const tmp = sorted[idx].display_order;
        sorted[idx]  = { ...sorted[idx],  display_order: sorted[swap].display_order };
        sorted[swap] = { ...sorted[swap], display_order: tmp };
        return sorted;
      });
    });
  }

  function toggleMonth(num: number) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  }

  // ── Sticky cell helper ────────────────────────────────────────────────────
  const sticky = "sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]";

  // ── Month separator config ────────────────────────────────────────────────
  const monthPhaseConfig = {
    "current":    { row: "bg-blue-600 text-white",          td: "border-l-4 border-l-blue-400 bg-blue-600",    badge: null },
    "past-data":  { row: "bg-emerald-50 text-emerald-800",  td: "border-l-4 border-l-emerald-400 bg-emerald-50", badge: null },
    "past-empty": { row: "bg-gray-50 text-gray-500",        td: "border-l-4 border-l-red-300 bg-gray-50",      badge: null },
    "future":     { row: "bg-gray-50/60 text-gray-400",     td: "border-l-4 border-l-gray-200 bg-gray-50/60",  badge: null },
  } as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-blue-900 to-indigo-900 p-7 text-white shadow-xl">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10" />
          <div className="absolute -bottom-10 right-32 h-40 w-40 rounded-full bg-indigo-500/10" />
        </div>
        <div className="relative z-10 flex items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                Monthly Matrix
              </span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                Live
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">KRA / KPI</h1>
            <p className="mt-1.5 text-sm text-blue-200/80">Employee-wise monthly performance matrix</p>
          </div>
          <BarChart2 className="h-16 w-16 shrink-0 text-white/10" aria-hidden />
        </div>
      </div>

      {/* ── Selectors ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Employee */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <User className="h-3 w-3" />Employee
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => router.push(`/inventory/kra?employee=${e.target.value}&year=${selectedYear}`)}
                disabled={!isAdmin}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-sm font-semibold text-gray-800 shadow-sm transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {users.map((u) => <option key={u.userId} value={u.userId}>{displayName(u)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Financial Year */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <Calendar className="h-3 w-3" />Financial Year
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedYear}
                onChange={(e) => router.push(`/inventory/kra?employee=${selectedEmployeeId}&year=${e.target.value}`)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-sm font-semibold text-gray-800 shadow-sm transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {financialYears.map((y) => <option key={y} value={y}>FY {y}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={User}
          label="Employee"
          value={selectedUser?.displayName ?? selectedUser?.email ?? "—"}
          sub={selectedUser?.displayName ? selectedUser.email : undefined}
          accentBorder="border-l-indigo-400"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <SummaryCard
          icon={Calendar}
          label="Financial Year"
          value={`FY ${selectedYear}`}
          sub="Apr – Mar cycle"
          accentBorder="border-l-blue-400"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Average Score / Month"
          value={averageScore > 0 ? fmt(averageScore) : "—"}
          sub={`Max per month: ${fmt(maxMonthlyScore)}`}
          accentBorder="border-l-emerald-400"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          icon={Trophy}
          label="Annual Score"
          value={annualScore > 0 ? fmt(annualScore) : "—"}
          sub={topMonth.score > 0 ? `Top month: ${topMonth.label}` : "No data yet"}
          accentBorder="border-l-violet-400"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          progress={maxAnnualScore > 0 ? { value: annualScore, max: maxAnnualScore } : undefined}
        />
      </div>

      {/* ── Trend chart ── */}
      {activeColumns.length > 0 && (
        <TrendChart
          monthlyTotals={monthlyTotals}
          maxMonthly={maxMonthlyScore}
          currentFiscalMonth={currentFiscalMonth}
        />
      )}

      {/* ── Monthly performance matrix ── */}
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Monthly Performance Matrix</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Click a month header to expand / collapse · Click a cell to edit
            </p>
          </div>
          {annualScore > 0 && (
            <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm shadow-sm">
              <span className="text-gray-400">Avg <span className="font-bold text-gray-800">{fmt(averageScore)}</span></span>
              <span className="h-4 w-px bg-gray-200" />
              <span className="text-gray-400">Annual <span className="font-bold text-gray-800">{fmt(annualScore)}</span>
                {maxAnnualScore > 0 && <span className="ml-1 text-gray-400 font-normal">/ {fmt(maxAnnualScore)}</span>}
              </span>
            </div>
          )}
        </div>

        {activeColumns.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
            <BarChart2 className="mx-auto h-12 w-12 text-gray-200" />
            <p className="mt-4 text-base font-semibold text-gray-400">No active KRA columns yet</p>
            {isAdmin && (
              <p className="mt-1 text-sm text-gray-400">
                Add columns in the <span className="font-medium text-gray-500">Admin Configuration</span> section below.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                {/* Column name headers */}
                <tr className="bg-slate-900 text-white">
                  <th className={cn(sticky, "bg-slate-900 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest min-w-36")}>
                    KRA Measure
                  </th>
                  {activeColumns.map((col) => (
                    <th key={col.id} className="min-w-36 px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest">
                      <div>{col.label}</div>
                      <div className="mt-1 text-[9px] font-normal text-white/40">{col.weightage}% weight</div>
                    </th>
                  ))}
                  <th className="min-w-28 px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest text-blue-300">
                    Final Score
                  </th>
                </tr>
                {/* Meta rows: Target / Source / Frequency */}
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <td className={cn(sticky, "bg-gray-50 px-4 py-2")}>
                    <span className="inline-flex rounded-md bg-gray-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Target</span>
                  </td>
                  {activeColumns.map((col) => (
                    <td key={col.id} className="px-4 py-2 text-center text-xs font-semibold text-gray-700">{col.target}</td>
                  ))}
                  <td />
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50/40">
                  <td className={cn(sticky, "bg-gray-50 px-4 py-2")}>
                    <span className="inline-flex rounded-md bg-gray-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Source</span>
                  </td>
                  {activeColumns.map((col) => (
                    <td key={col.id} className="px-4 py-2 text-center text-xs text-gray-400 italic">{col.source || "—"}</td>
                  ))}
                  <td />
                </tr>
                <tr className="border-b-2 border-gray-200 bg-gray-50/80">
                  <td className={cn(sticky, "bg-gray-50 px-4 py-2")}>
                    <span className="inline-flex rounded-md bg-gray-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Frequency</span>
                  </td>
                  {activeColumns.map((col) => (
                    <td key={col.id} className="px-4 py-2 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {col.frequency}
                      </span>
                    </td>
                  ))}
                  <td />
                </tr>
              </thead>

              <tbody>
                {FISCAL_MONTHS.map((fm, monthIdx) => {
                  const phase       = getMonthPhase(fm.num);
                  const isCollapsed = collapsedMonths.has(fm.num);
                  const monthTotal  = monthlyTotals[monthIdx];
                  const cfg         = monthPhaseConfig[phase];

                  const sepIcon =
                    phase === "current"    ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    : phase === "past-data"  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : phase === "past-empty" ? <AlertCircle  className="h-3.5 w-3.5 text-red-400" />
                    :                          <Clock         className="h-3.5 w-3.5 text-gray-300" />;

                  return (
                    <Fragment key={fm.num}>
                      {/* Month separator toggle */}
                      <tr
                        ref={phase === "current" ? currentMonthRef : null}
                        onClick={() => toggleMonth(fm.num)}
                        className={cn("cursor-pointer select-none transition-all hover:brightness-95", cfg.row)}
                      >
                        <td colSpan={totalCols} className={cn("py-2.5 pl-0 pr-4", cfg.td)}>
                          <span className="flex items-center justify-between pl-4">
                            <span className="flex items-center gap-2.5">
                              {sepIcon}
                              <span className={cn(
                                "text-[11px] font-bold uppercase tracking-widest",
                                phase === "current" ? "text-white" : "",
                              )}>
                                {phase === "current" && (
                                  <span className="mr-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold tracking-widest text-white">
                                    CURRENT
                                  </span>
                                )}
                                {fm.label} Review Block
                              </span>
                              {phase === "past-data" && monthTotal > 0 && (
                                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold",
                                  scoreTextClass(monthTotal, maxMonthlyScore).includes("green")
                                    ? "bg-emerald-100 text-emerald-700"
                                    : scoreTextClass(monthTotal, maxMonthlyScore).includes("amber")
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-600",
                                )}>
                                  {fmt(monthTotal)}
                                </span>
                              )}
                              {phase === "past-empty" && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-500">
                                  No data
                                </span>
                              )}
                            </span>
                            {isCollapsed
                              ? <ChevronDown className={cn("h-4 w-4", phase === "current" ? "text-white/70" : "text-gray-400")} />
                              : <ChevronUp   className={cn("h-4 w-4", phase === "current" ? "text-white/70" : "text-gray-400")} />
                            }
                          </span>
                        </td>
                      </tr>

                      {!isCollapsed && (
                        <>
                          {/* Reverse Points */}
                          <tr className="border-b border-gray-50 bg-violet-50/30">
                            <td className={cn(sticky, "bg-violet-50/50 px-4 py-2.5")}>
                              <span className="text-[11px] font-semibold text-violet-600">Reverse Points</span>
                            </td>
                            {activeColumns.map((col) => {
                              const entry  = entryMap.get(`${col.id}-${fm.num}`);
                              const saving = savingCells.has(`${col.id}-${fm.num}-reverse_points`);
                              return (
                                <td key={col.id} className="px-4 py-2.5 text-center">
                                  {col.approval_required ? (
                                    <EditableCell
                                      value={entry?.reverse_points ?? null}
                                      hasEntry={!!entry}
                                      onSave={(v) => saveEntry(col.id, fm.num, "reverse_points", v)}
                                      editable={isAdmin}
                                      saving={saving}
                                      lastUpdated={entry?.updated_at}
                                    />
                                  ) : (
                                    <span className="text-[11px] text-gray-300">N/A</span>
                                  )}
                                </td>
                              );
                            })}
                            <td />
                          </tr>

                          {/* Points */}
                          <tr className="border-b border-gray-50 bg-blue-50/20">
                            <td className={cn(sticky, "bg-blue-50/40 px-4 py-2.5")}>
                              <span className="text-[11px] font-semibold text-blue-600">Points</span>
                            </td>
                            {activeColumns.map((col) => {
                              const entry  = entryMap.get(`${col.id}-${fm.num}`);
                              const saving = savingCells.has(`${col.id}-${fm.num}-points`);
                              return (
                                <td key={col.id} className="px-4 py-2.5 text-center">
                                  <EditableCell
                                    value={entry?.points ?? null}
                                    hasEntry={!!entry}
                                    onSave={(v) => saveEntry(col.id, fm.num, "points", v)}
                                    editable={isAdmin}
                                    saving={saving}
                                    lastUpdated={entry?.updated_at}
                                  />
                                </td>
                              );
                            })}
                            <td />
                          </tr>

                          {/* Weightage */}
                          <tr className="border-b border-gray-50 bg-white">
                            <td className={cn(sticky, "bg-white px-4 py-2")}>
                              <span className="text-[11px] font-semibold text-gray-400">Weightage</span>
                            </td>
                            {activeColumns.map((col) => (
                              <td key={col.id} className="px-4 py-2 text-center text-[11px] font-semibold text-gray-400">
                                {col.weightage}%
                              </td>
                            ))}
                            <td />
                          </tr>

                          {/* Final Score */}
                          <tr className="border-b-2 border-gray-200 bg-slate-50">
                            <td className={cn(sticky, "bg-slate-100 px-4 py-3")}>
                              <span className="text-xs font-bold text-slate-700">Final Score</span>
                            </td>
                            {activeColumns.map((col) => {
                              const score  = colScore[col.id]?.[monthIdx] ?? 0;
                              const entry  = entryMap.get(`${col.id}-${fm.num}`);
                              return (
                                <td key={col.id} className="px-4 py-3 text-center">
                                  {entry ? (
                                    <span className={cn("text-sm", scoreTextClass(score, col.weightage))}>
                                      {fmt(score)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center">
                              {monthTotal > 0 ? (
                                <span className={cn("text-sm", scoreTextClass(monthTotal, maxMonthlyScore))}>
                                  {fmt(monthTotal)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        </>
                      )}
                    </Fragment>
                  );
                })}

                {/* Average Score */}
                <tr className="border-b border-amber-100 bg-amber-50">
                  <td className={cn(sticky, "bg-amber-100 px-4 py-3 text-xs font-bold text-amber-800")}>
                    Average Score
                  </td>
                  {activeColumns.map((col) => {
                    const colAvg = (colScore[col.id] ?? []).reduce((s, v) => s + v, 0) / 12;
                    return (
                      <td key={col.id} className="px-4 py-3 text-center text-sm font-semibold text-amber-700">
                        {colAvg > 0 ? fmt(colAvg) : <span className="text-amber-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-sm font-bold text-amber-700">
                    {averageScore > 0 ? fmt(averageScore) : <span className="text-amber-300">—</span>}
                  </td>
                </tr>

                {/* Annual Score */}
                <tr className="bg-linear-to-r from-slate-800 to-slate-900 text-white">
                  <td className={cn(sticky, "bg-slate-800 px-4 py-4 text-xs font-bold tracking-wide")}>
                    Annual Score
                  </td>
                  {activeColumns.map((col) => {
                    const colAnn = (colScore[col.id] ?? []).reduce((s, v) => s + v, 0);
                    return (
                      <td key={col.id} className="px-4 py-4 text-center text-sm font-semibold text-white/60">
                        {colAnn > 0 ? fmt(colAnn) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-center">
                    <span className="text-base font-extrabold text-white">{annualScore > 0 ? fmt(annualScore) : "—"}</span>
                    {maxAnnualScore > 0 && annualScore > 0 && (
                      <span className="ml-1.5 text-xs text-white/40">/ {fmt(maxAnnualScore)}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Admin Config ── */}
      {isAdmin && (
        <div>
          {/* Section header */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  ⚙ Admin Configuration
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">KRA Column Setup</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Configuring columns for{" "}
                <span className="font-semibold text-gray-600">{selectedUser?.displayName ?? selectedUser?.email ?? "—"}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setColModalError(null); setColModal("new"); }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />Add Column
            </button>
          </div>

          {/* Weightage summary */}
          <div className="mb-5 flex flex-wrap items-stretch gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Weightage</p>
                <p className="mt-0.5 text-2xl font-extrabold text-gray-900">{totalActiveWeightage}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remaining</p>
                <p className="mt-0.5 text-2xl font-extrabold text-gray-900">{Math.max(0, 100 - totalActiveWeightage)}%</p>
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-5 py-4",
              totalActiveWeightage <= 100
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            )}>
              {totalActiveWeightage <= 100
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : <AlertCircle className="h-5 w-5 text-amber-500" />
              }
              <span className={cn(
                "text-sm font-semibold",
                totalActiveWeightage <= 100 ? "text-emerald-700" : "text-amber-700",
              )}>
                {totalActiveWeightage <= 100 ? "Weightage within limit" : "Total exceeds 100%"}
              </span>
            </div>
          </div>

          {/* Column cards */}
          {columns.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
              <p className="text-sm text-gray-400">No KRA columns yet.</p>
              <p className="mt-1 text-xs text-gray-400">Click <strong>Add Column</strong> to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...columns].sort((a, b) => a.display_order - b.display_order).map((col, idx, arr) => (
                <ColumnCard
                  key={col.id}
                  col={col}
                  idx={idx}
                  total={arr.length}
                  onEdit={() => { setColModalError(null); setColModal(col); }}
                  onDelete={() => setDeleteTarget(col)}
                  onMove={(dir) => handleMove(col, dir)}
                  isMoving={isMoving}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Column modal ── */}
      {colModal !== null && (
        <ColumnFormModal
          initial={colModal === "new" ? null : {
            label: colModal.label, weightage: colModal.weightage, target: colModal.target,
            source: colModal.source, frequency: colModal.frequency,
            approval_required: colModal.approval_required, active: colModal.active,
          }}
          onClose={() => setColModal(null)}
          onSave={handleColSave}
          saving={isColSaving}
          error={colModalError}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-red-100 bg-red-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Remove column?</h3>
                  <p className="text-xs text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">&ldquo;{deleteTarget.label}&rdquo;</span>{" "}
                and all its entry data will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Remove Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
