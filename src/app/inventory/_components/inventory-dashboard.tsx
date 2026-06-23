"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle,
  Clock,
  FileText,
  Layers,
  MapPin,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function ExpiringTodayCard({
  slabs,
}: {
  slabs: DashboardStats["expiringTodaySlabs"];
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
        Reservations Expiring Today
      </h3>
      {slabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-gray-500">No reservations expiring today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slabs.map((slab) => (
            <div
              key={slab.id}
              className="flex items-start gap-3 rounded-xl bg-amber-50 p-3"
            >
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

function RecentActivityCard({
  activity,
}: {
  activity: DashboardStats["recentActivity"];
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Recent Activity</h3>
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
      <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Alerts</h3>
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
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-xl p-4 ${toneClass}`}
              >
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

export function InventoryDashboard({
  stats,
  profile,
}: {
  stats: DashboardStats;
  profile: UserProfile | null;
}) {
  const role = profile?.role ?? "staff";
  const isStaff = role === "staff";
  const locationData = stats.warehouseCounts.map(({ name, count }) => ({ name, value: count }));

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const displayName = profile?.displayName;
  const badge = ROLE_BADGE[role];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Greeting */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {greeting}{displayName ? `, ${displayName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isStaff
              ? "Here's your warehouse status for today."
              : "Overview of your marble inventory"}
          </p>
        </div>
        <span
          className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </section>

      {/* Staff: quick action bar */}
      {isStaff && (
        <section className="flex flex-wrap gap-3">
          <Link
            href="/inventory/movement"
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
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
      {!isStaff && (
        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <h3 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
              Stock by Location
            </h3>
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
            <h3 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
              Stock by Marble Type
            </h3>
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

      {/* Bottom section */}
      <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        {isStaff ? (
          <ExpiringTodayCard slabs={stats.expiringTodaySlabs} />
        ) : (
          <RecentActivityCard activity={stats.recentActivity} />
        )}
        <AlertsCard alerts={stats.alerts} />
      </section>
    </div>
  );
}
