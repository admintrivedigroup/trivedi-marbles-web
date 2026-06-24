"use client";

import { useMemo, useState } from "react";
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

const chartColors = ["#1f2937", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db"];

const warehouseTones = [
  "bg-green-50 text-green-600",
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-rose-50 text-rose-600",
];

const ROLE_BADGE = {
  superadmin: { label: "Super Admin", className: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700" },
  staff: { label: "Staff", className: "bg-gray-100 text-gray-600" },
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
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg md:h-12 md:w-12 md:rounded-xl ${tone}`}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div>
          <p className="text-xs text-gray-500 md:text-sm">{label}</p>
          <p className="text-xl font-bold text-gray-900 md:text-2xl">{value}</p>
        </div>
      </div>
    </article>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">{children}</h3>
  );
}

// ─── Staff cards ──────────────────────────────────────────────────────────────

function IncomingTransfersCard({ count }: { count: number }) {
  return (
    <Link href="/inventory/movement" className="block">
      <article
        className={`h-full rounded-xl border bg-white p-4 shadow-sm transition-colors md:rounded-2xl md:p-6 ${
          count > 0 ? "border-sky-200 hover:border-sky-400" : "border-gray-100 hover:border-gray-300"
        }`}
      >
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 md:h-12 md:w-12 md:rounded-xl">
            <Truck className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 md:text-sm">Incoming</p>
            <p className="text-xl font-bold text-gray-900 md:text-2xl">{count}</p>
          </div>
        </div>
        {count > 0 && (
          <p className="mt-3 text-xs font-medium text-sky-600">Tap to receive →</p>
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
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Reservations Expiring Today</SectionHeading>
      {slabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-gray-500">No reservations expiring today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slabs.map((slab) => (
            <div key={slab.id} className="flex items-start gap-3 rounded-xl bg-amber-50 p-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {slab.marbleName ?? "Unknown"} · {slab.slabCode ?? "—"}
                </p>
                {slab.reservedFor && (
                  <p className="text-xs text-gray-500">For: {slab.reservedFor}</p>
                )}
                <p className="mt-0.5 text-xs font-medium text-amber-700">
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
}: {
  totalLeads: number;
  convertedLeads: number;
  newLeadsThisWeek: number;
}) {
  const rate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>Lead Pipeline</SectionHeading>
        <Link
          href="/inventory/leads"
          className="-mt-4 text-xs text-gray-400 hover:text-gray-600"
        >
          View all →
        </Link>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{totalLeads}</p>
          <p className="mt-0.5 text-xs text-gray-500">Total</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-center">
          <p className="text-xl font-bold text-emerald-700">{convertedLeads}</p>
          <p className="mt-0.5 text-xs text-emerald-600">Converted</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{newLeadsThisWeek}</p>
          <p className="mt-0.5 text-xs text-blue-600">New this week</p>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-gray-500">
          <span>Conversion rate</span>
          <span className="font-semibold text-gray-800">{rate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
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
}: {
  staffActivityToday: { email: string; actionCount: number }[];
}) {
  const maxCount = staffActivityToday[0]?.actionCount ?? 1;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>Today's Activity</SectionHeading>
        <Link
          href="/inventory/audit"
          className="-mt-4 text-xs text-gray-400 hover:text-gray-600"
        >
          Full log →
        </Link>
      </div>
      {staffActivityToday.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Users className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">No activity logged today</p>
        </div>
      ) : (
        <div className="space-y-4">
          {staffActivityToday.map(({ email, actionCount }, i) => (
            <div key={email} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs text-gray-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-gray-700">{email}</p>
                  <p className="shrink-0 text-xs font-semibold text-gray-900">
                    {actionCount}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-800 transition-all duration-500"
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
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Inventory Age</SectionHeading>
      <div className="space-y-4">
        {inventoryAgeBuckets.map(({ label, count }, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-gray-500">{label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${bucketColors[i]}`}
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-700">
              {count}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-400">Active slabs by days since added</p>
    </article>
  );
}

function SoldQualityCard({
  soldLotsCount,
  soldSqft,
  dataQualityIssues,
}: {
  soldLotsCount: number;
  soldSqft: number;
  dataQualityIssues: number;
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Stock Intelligence</SectionHeading>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Lots sold</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {soldLotsCount.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Sqft sold</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {soldSqft.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <div
          className={`flex items-start gap-3 rounded-xl p-3 ${
            dataQualityIssues > 0 ? "bg-amber-50" : "bg-emerald-50"
          }`}
        >
          {dataQualityIssues > 0 ? (
            <>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {dataQualityIssues} slab{dataQualityIssues === 1 ? "" : "s"} missing prices
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Incomplete data may affect quotations
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm text-gray-700">All active slabs have pricing data</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function UserAuditFeedCard({
  recentAuditActivity,
}: {
  recentAuditActivity: NonNullable<DashboardStats["recentAuditActivity"]>;
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>User Activity</SectionHeading>
        <Link
          href="/inventory/audit"
          className="-mt-4 text-xs text-gray-400 hover:text-gray-600"
        >
          Full log →
        </Link>
      </div>
      {recentAuditActivity.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {recentAuditActivity.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gray-900" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900">
                  {entry.action}
                  {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-400">
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
}: {
  activity: DashboardStats["recentActivity"];
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Recent Activity</SectionHeading>
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {activity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gray-900" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">{item.text}</p>
                <p className="mt-1 text-xs text-gray-500">{item.time}</p>
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
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <SectionHeading>Alerts</SectionHeading>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-gray-500">All clear — no alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const toneClass =
              alert.severity === "high"
                ? "bg-red-50 text-red-600"
                : alert.severity === "medium"
                  ? "bg-orange-50 text-orange-600"
                  : "bg-blue-50 text-blue-600";
            return (
              <div key={alert.id} className={`flex items-start gap-3 rounded-xl p-4 ${toneClass}`}>
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm text-gray-900">{alert.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

// ─── Stock Value card (admin/superadmin) ──────────────────────────────────────

function formatStockValue(value: number) {
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("en-IN");
}

type PriceBasis = "selling" | "dealer";

function StockValueCard({
  stockValueBySelling,
  stockValueByDealer,
}: {
  stockValueBySelling: number;
  stockValueByDealer: number;
}) {
  const [priceBasis, setPriceBasis] = useState<PriceBasis>("selling");
  const stockValue = priceBasis === "dealer" ? stockValueByDealer : stockValueBySelling;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 md:h-12 md:w-12 md:rounded-xl">
          <span className="text-3xl font-bold md:text-4xl">₹</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 md:text-sm">Stock Value</p>
          <p className="text-xl font-bold text-gray-900 md:text-2xl">{formatStockValue(stockValue)}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-gray-100 pt-3">
        <select
          value={priceBasis}
          onChange={(e) => setPriceBasis(e.target.value as PriceBasis)}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
        >
          <option value="selling">by Selling Price</option>
          <option value="dealer">by Dealer Price</option>
        </select>
      </div>
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
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>{isStaff ? "My Tasks" : "Task Overview"}</SectionHeading>
        <Link href="/inventory/tasks" className="-mt-4 text-xs text-gray-400 hover:text-gray-600">
          View all →
        </Link>
      </div>

      {taskSummary.total === 0 && !hasPending ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle className="h-7 w-7 text-emerald-400" />
          <p className="text-sm text-gray-500">No active tasks</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{taskSummary.total}</p>
              <p className="mt-0.5 text-xs text-gray-500">Active</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{taskSummary.inProgress}</p>
              <p className="mt-0.5 text-xs text-blue-600">In Progress</p>
            </div>
            <div className={cn("rounded-lg p-3 text-center", hasPending ? "bg-purple-50" : "bg-gray-50")}>
              <p className={cn("text-xl font-bold", hasPending ? "text-purple-700" : "text-gray-400")}>
                {taskSummary.pendingApproval}
              </p>
              <p className={cn("mt-0.5 text-xs leading-tight", hasPending ? "text-purple-600" : "text-gray-400")}>
                {isStaff ? "In Review" : "Need Approval"}
              </p>
            </div>
            <div className={cn("rounded-lg p-3 text-center", hasOverdue ? "bg-red-50" : "bg-gray-50")}>
              <p className={cn("text-xl font-bold", hasOverdue ? "text-red-600" : "text-gray-400")}>
                {taskSummary.overdue}
              </p>
              <p className={cn("mt-0.5 text-xs", hasOverdue ? "text-red-500" : "text-gray-400")}>Overdue</p>
            </div>
          </div>

          {hasPending && (
            <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <p className="text-xs text-purple-700">
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
}: {
  stats: DashboardStats;
  profile: UserProfile | null;
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

  const badge = ROLE_BADGE[role];

  return (
    <div className="space-y-6 md:space-y-8">

      {/* Greeting */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {greeting}{profile?.displayName ? `, ${profile.displayName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
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

      {/* Staff: quick action bar */}
      {isStaff && (
        <section className="flex flex-wrap gap-3">
          <Link
            href="/inventory/movement"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Start Movement
          </Link>
          <Link
            href="/inventory/quotations"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            New Quotation
          </Link>
        </section>
      )}

      {/* Admin: pending transfers banner */}
      {isAdminOrAbove && (stats.pendingTransfersCount ?? 0) > 0 && (
        <Link href="/inventory/movement" className="block">
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 transition-colors hover:border-sky-400">
            <Truck className="h-4 w-4 shrink-0 text-sky-600" />
            <p className="text-sm text-sky-800">
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
          label="Total Lots"
          value={String(stats.totalLots)}
          tone="bg-gray-100 text-gray-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Sqft"
          value={stats.totalSqft.toLocaleString("en-IN")}
          tone="bg-blue-50 text-blue-600"
        />
        {stats.warehouseCounts.map(({ name, count }, i) => (
          <StatCard
            key={name}
            icon={MapPin}
            label={name}
            value={String(count)}
            tone={warehouseTones[i % warehouseTones.length]}
          />
        ))}
        <StatCard
          icon={Clock}
          label="Reserved"
          value={String(stats.reservedCount)}
          tone="bg-orange-50 text-orange-600"
        />
        {isAdminOrAbove && (
          <StatCard
            icon={UserCheck}
            label="Leads"
            value={String(stats.totalLeads ?? 0)}
            tone="bg-purple-50 text-purple-600"
          />
        )}
        {isStaff ? (
          <IncomingTransfersCard count={stats.incomingTransfersCount} />
        ) : (
          <StockValueCard
            stockValueBySelling={stats.stockValueBySelling}
            stockValueByDealer={stats.stockValueByDealer}
          />
        )}
      </section>

      {/* Charts — admin / superadmin only */}
      {isAdminOrAbove && (
        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <SectionHeading>Stock by Location</SectionHeading>
            {locationData.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">No data yet</p>
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

          <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <SectionHeading>Stock by Marble Type</SectionHeading>
            {stats.typeData.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.typeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#9ca3af" tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1f2937" radius={[8, 8, 0, 0]} />
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
            dataQualityIssues={stats.dataQualityIssues ?? 0}
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
          />
          <StaffActivityCard staffActivityToday={stats.staffActivityToday} />
          <TaskSummaryCard taskSummary={stats.taskSummary} isStaff={false} />
        </section>
      )}

      {/* Bottom: activity + alerts (+ task summary for staff) */}
      <section className={`grid grid-cols-1 gap-4 md:gap-6 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {isStaff && <TaskSummaryCard taskSummary={stats.taskSummary} isStaff={true} />}
        {isStaff ? (
          <ExpiringTodayCard slabs={stats.expiringTodaySlabs} />
        ) : isSuperadmin && stats.recentAuditActivity ? (
          <UserAuditFeedCard recentAuditActivity={stats.recentAuditActivity} />
        ) : (
          <RecentActivityCard activity={stats.recentActivity} />
        )}
        <AlertsCard alerts={stats.alerts} />
      </section>
    </div>
  );
}
