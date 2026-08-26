"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  MapPin,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { actionLabel } from "@/app/inventory/_lib/audit-labels";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardStats } from "@/app/inventory/_lib/dashboard";
import type { UserProfile } from "@/app/inventory/_lib/user-profile";
import { resolveDashboardDateRange, formatDashboardDateRangeLabel } from "@/app/inventory/_lib/dashboard-date-range";
import { DashboardDateFilter } from "@/app/inventory/_components/dashboard-date-filter";

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const warehouseTones = [
  "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300",
  "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
  "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
];

const ROLE_BADGE = {
  superadmin: { label: "Super Admin", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  staff: { label: "Staff", className: "bg-muted text-muted-foreground" },
} as const;

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg md:h-12 md:w-12 md:rounded-xl ${tone}`}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
          <p className="text-xl font-bold text-foreground md:text-2xl">{value}</p>
        </div>
      </div>
    </article>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-base font-bold text-foreground md:text-lg">{children}</h3>
  );
}

// ─── Staff cards ──────────────────────────────────────────────────────────────

function IncomingTransfersCard({ count }: { count: number }) {
  return (
    <Link href="/inventory/movement" className="block">
      <article
        className={`h-full rounded-xl border bg-card p-4 shadow-sm transition-colors md:rounded-2xl md:p-6 ${
          count > 0 ? "border-sky-200 hover:border-sky-400 dark:border-sky-800 dark:hover:border-sky-600" : "border-border hover:border-border"
        }`}
      >
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 md:h-12 md:w-12 md:rounded-xl">
            <Truck className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground md:text-sm">Incoming</p>
            <p className="text-xl font-bold text-foreground md:text-2xl">{count}</p>
          </div>
        </div>
        {count > 0 && (
          <p className="mt-3 text-xs font-medium text-sky-600 dark:text-sky-400">Tap to receive →</p>
        )}
      </article>
    </Link>
  );
}

function ExpiringTodayCard({
  slabs,
}: {
  slabs: DashboardStats["expiringTodaySlabs"];
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Reservations Expiring Today</SectionHeading>
      {slabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-muted-foreground">No reservations expiring today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slabs.map((slab) => (
            <div key={slab.id} className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {slab.marbleName ?? "Unknown"} · {slab.slabCode ?? "—"}
                </p>
                {slab.reservedFor && (
                  <p className="text-xs text-muted-foreground">For: {slab.reservedFor}</p>
                )}
                <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Expires{" "}
                  {new Date(slab.reservedUntil).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Admin cards ──────────────────────────────────────────────────────────────

function LeadConversionCard({
  totalLeads,
  convertedLeads,
  newLeadsThisWeek,
  rangeLabel,
}: {
  totalLeads: number;
  convertedLeads: number;
  newLeadsThisWeek: number;
  rangeLabel: string | null;
}) {
  const rate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <SectionHeading>Lead Pipeline</SectionHeading>
          <p className="-mt-3 text-xs text-muted-foreground">{rangeLabel ?? "All time"}</p>
        </div>
        <Link
          href="/inventory/leads"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all →
        </Link>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted p-3 text-center">
          <p className="text-xl font-bold text-foreground">{totalLeads}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{convertedLeads}</p>
          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Converted</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/30">
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{newLeadsThisWeek}</p>
          <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">New this week</p>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Conversion rate</span>
          <span className="font-semibold text-foreground">{rate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function StaffActivityCard({
  staffActivityToday,
  rangeLabel,
}: {
  staffActivityToday: { email: string; actionCount: number }[];
  rangeLabel: string | null;
}) {
  const maxCount = staffActivityToday[0]?.actionCount ?? 1;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <SectionHeading>Staff Activity</SectionHeading>
          <p className="-mt-3 text-xs text-muted-foreground">{rangeLabel ?? "Today"}</p>
        </div>
        <Link
          href="/inventory/audit"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Full log →
        </Link>
      </div>
      {staffActivityToday.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No activity logged today</p>
        </div>
      ) : (
        <div className="space-y-4">
          {staffActivityToday.map(({ email, actionCount }, i) => (
            <div key={email} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                  <p className="shrink-0 text-xs font-semibold text-foreground">
                    {actionCount}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.round((actionCount / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Superadmin cards ─────────────────────────────────────────────────────────

function InventoryAgeCard({
  inventoryAgeBuckets,
}: {
  inventoryAgeBuckets: { label: string; count: number }[];
}) {
  const maxCount = Math.max(...inventoryAgeBuckets.map((b) => b.count), 1);
  const bucketColors = [
    "bg-emerald-400",
    "bg-amber-400",
    "bg-orange-500",
    "bg-red-500",
  ];

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Inventory Age</SectionHeading>
      <div className="space-y-4">
        {inventoryAgeBuckets.map(({ label, count }, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${bucketColors[i]}`}
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-muted-foreground">
              {count}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Active slabs by days since added</p>
    </article>
  );
}

function SoldQualityCard({
  soldLotsCount,
  soldSqft,
}: {
  soldLotsCount: number;
  soldSqft: number;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Stock Intelligence</SectionHeading>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">Lots sold</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {soldLotsCount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">Sqft sold</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {soldSqft.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </article>
  );
}

function UserAuditFeedCard({
  recentAuditActivity,
  rangeLabel,
}: {
  recentAuditActivity: NonNullable<DashboardStats["recentAuditActivity"]>;
  rangeLabel: string | null;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <SectionHeading>User Activity</SectionHeading>
          {rangeLabel && <p className="-mt-3 text-xs text-muted-foreground">{rangeLabel}</p>}
        </div>
        <Link
          href="/inventory/audit"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Full log →
        </Link>
      </div>
      {recentAuditActivity.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {recentAuditActivity.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {actionLabel(entry.action)}
                  {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.userEmail ?? "Unknown"} · {entry.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Shared bottom cards ──────────────────────────────────────────────────────

function RecentActivityCard({
  activity,
  rangeLabel,
}: {
  activity: DashboardStats["recentActivity"];
  rangeLabel: string | null;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Recent Activity</SectionHeading>
      <p className="-mt-3 mb-4 text-xs text-muted-foreground">{rangeLabel ?? "All time"}</p>
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {activity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function AlertsCard({ alerts }: { alerts: DashboardStats["alerts"] }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Alerts</SectionHeading>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-muted-foreground">All clear — no alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const toneClass =
              alert.severity === "high"
                ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : alert.severity === "medium"
                  ? "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400";
            return (
              <div key={alert.id} className={`flex items-start gap-3 rounded-xl p-4 ${toneClass}`}>
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm text-foreground">{alert.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

// ─── Task summary card (all roles) ───────────────────────────────────────────

function TaskSummaryCard({
  taskSummary,
  isStaff,
}: {
  taskSummary: DashboardStats["taskSummary"];
  isStaff: boolean;
}) {
  const hasPending = taskSummary.pendingApproval > 0;
  const hasOverdue = taskSummary.overdue > 0;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>{isStaff ? "My Tasks" : "Task Overview"}</SectionHeading>
        <Link href="/inventory/tasks" className="-mt-4 text-xs text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>

      {taskSummary.total === 0 && !hasPending ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle className="h-7 w-7 text-emerald-400" />
          <p className="text-sm text-muted-foreground">No active tasks</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xl font-bold text-foreground">{taskSummary.total}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Active</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/30">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{taskSummary.inProgress}</p>
              <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">In Progress</p>
            </div>
            <div className={cn("rounded-lg p-3 text-center", hasPending ? "bg-purple-50 dark:bg-purple-950/30" : "bg-muted")}>
              <p className={cn("text-xl font-bold", hasPending ? "text-purple-700 dark:text-purple-400" : "text-muted-foreground")}>
                {taskSummary.pendingApproval}
              </p>
              <p className={cn("mt-0.5 text-xs leading-tight", hasPending ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground")}>
                {isStaff ? "In Review" : "Need Approval"}
              </p>
            </div>
            <div className={cn("rounded-lg p-3 text-center", hasOverdue ? "bg-red-50 dark:bg-red-950/30" : "bg-muted")}>
              <p className={cn("text-xl font-bold", hasOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                {taskSummary.overdue}
              </p>
              <p className={cn("mt-0.5 text-xs", hasOverdue ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>Overdue</p>
            </div>
          </div>

          {hasPending && (
            <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 dark:border-purple-800 dark:bg-purple-950/30">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
              <p className="text-xs text-purple-700 dark:text-purple-400">
                {isStaff
                  ? `${taskSummary.pendingApproval} task${taskSummary.pendingApproval === 1 ? "" : "s"} awaiting admin review`
                  : `${taskSummary.pendingApproval} task${taskSummary.pendingApproval === 1 ? "" : "s"} need${taskSummary.pendingApproval === 1 ? "s" : ""} your approval`}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function InventoryDashboard({
  stats,
  profile,
  dateFilter,
}: {
  stats: DashboardStats;
  profile: UserProfile | null;
  dateFilter: { preset: string | null; from: string | null; to: string | null };
}) {
  const role = profile?.role ?? "staff";
  const isStaff = role === "staff";
  const isAdmin = role === "admin";
  const isSuperadmin = role === "superadmin";
  const isAdminOrAbove = isAdmin || isSuperadmin;

  const locationData = stats.warehouseCounts.map(({ name, count }) => ({ name, value: count }));

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const rangeLabel = useMemo(() => {
    const range = resolveDashboardDateRange(dateFilter.preset, dateFilter.from, dateFilter.to);
    return formatDashboardDateRangeLabel(range);
  }, [dateFilter.preset, dateFilter.from, dateFilter.to]);

  const badge = ROLE_BADGE[role];

  return (
    <div className="space-y-6 md:space-y-8">

      {/* Greeting */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            {greeting}{profile?.displayName ? `, ${profile.displayName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStaff
              ? "Here's your warehouse status for today."
              : isAdmin
                ? "Operational overview of your inventory."
                : "Full business overview — all warehouses."}
          </p>
        </div>
        <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </section>

      {/* Date filter */}
      <DashboardDateFilter preset={dateFilter.preset} from={dateFilter.from} to={dateFilter.to} />

      {/* Staff: quick action bar */}
      {isStaff && (
        <section className="flex flex-wrap gap-3">
          <Link
            href="/inventory/movement"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Start Movement
          </Link>
          <Link
            href="/inventory/quotations"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4" />
            New Quotation
          </Link>
        </section>
      )}

      {/* Admin: pending transfers banner */}
      {isAdminOrAbove && (stats.pendingTransfersCount ?? 0) > 0 && (
        <Link href="/inventory/movement" className="block">
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 transition-colors hover:border-sky-400 dark:border-sky-800 dark:bg-sky-950/30 dark:hover:border-sky-600">
            <Truck className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-sm text-sky-800 dark:text-sky-300">
              <span className="font-semibold">{stats.pendingTransfersCount}</span> transfer
              {stats.pendingTransfersCount === 1 ? "" : "s"} currently in transit →
            </p>
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Layers}
          label={rangeLabel ? "Lots Added" : "Total Lots"}
          value={String(stats.totalLots)}
          tone="bg-muted text-muted-foreground"
        />
        <StatCard
          icon={TrendingUp}
          label={rangeLabel ? "Sqft Added" : "Total Sqft"}
          value={stats.totalSqft.toLocaleString("en-IN")}
          tone="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
        />
        {stats.warehouseCounts.map(({ name, count }, i) => (
          <StatCard
            key={name}
            icon={MapPin}
            label={rangeLabel ? `${name} (added)` : name}
            value={String(count)}
            tone={warehouseTones[i % warehouseTones.length]}
          />
        ))}
        <StatCard
          icon={Clock}
          label="Reserved"
          value={String(stats.reservedCount)}
          tone="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300"
        />
        {isAdminOrAbove && (
          <StatCard
            icon={UserCheck}
            label="Leads"
            value={String(stats.totalLeads ?? 0)}
            tone="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
          />
        )}
        {isStaff && <IncomingTransfersCard count={stats.incomingTransfersCount} />}
      </section>

      {/* Charts — admin / superadmin only */}
      {isAdminOrAbove && (
        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
            <SectionHeading>Stock by Location</SectionHeading>
            <p className="-mt-3 mb-4 text-xs text-muted-foreground">
              {rangeLabel ? `Added — ${rangeLabel}` : "All time"}
            </p>
            {locationData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={locationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {locationData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </article>

          <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
            <SectionHeading>Stock by Marble Type</SectionHeading>
            <p className="-mt-3 mb-4 text-xs text-muted-foreground">
              {rangeLabel ? `Added — ${rangeLabel}` : "All time"}
            </p>
            {stats.typeData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.typeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--foreground)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </article>
        </section>
      )}

      {/* Superadmin: business intelligence row */}
      {isSuperadmin && stats.inventoryAgeBuckets && (
        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <InventoryAgeCard inventoryAgeBuckets={stats.inventoryAgeBuckets} />
          <SoldQualityCard
            soldLotsCount={stats.soldLotsCount ?? 0}
            soldSqft={stats.soldSqft ?? 0}
          />
        </section>
      )}

      {/* Admin + Superadmin: ops row — 3 cols */}
      {isAdminOrAbove && stats.staffActivityToday && (
        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <LeadConversionCard
            totalLeads={stats.totalLeads ?? 0}
            convertedLeads={stats.convertedLeads ?? 0}
            newLeadsThisWeek={stats.newLeadsThisWeek ?? 0}
            rangeLabel={rangeLabel}
          />
          <StaffActivityCard staffActivityToday={stats.staffActivityToday} rangeLabel={rangeLabel} />
          <TaskSummaryCard taskSummary={stats.taskSummary} isStaff={false} />
        </section>
      )}

      {/* Bottom: activity + alerts (+ task summary for staff) */}
      <section className={`grid grid-cols-1 gap-4 md:gap-6 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {isStaff && <TaskSummaryCard taskSummary={stats.taskSummary} isStaff={true} />}
        {isStaff ? (
          <ExpiringTodayCard slabs={stats.expiringTodaySlabs} />
        ) : isSuperadmin && stats.recentAuditActivity ? (
          <UserAuditFeedCard recentAuditActivity={stats.recentAuditActivity} rangeLabel={rangeLabel} />
        ) : (
          <RecentActivityCard activity={stats.recentActivity} rangeLabel={rangeLabel} />
        )}
        <AlertsCard alerts={stats.alerts} />
      </section>
    </div>
  );
}
