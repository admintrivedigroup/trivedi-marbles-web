"use client";

import { useState } from "react";
import {
  AlertCircle,
  Clock,
  MapPin,
  Package,
  TrendingUp,
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

const chartColors = ["#1f2937", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db"];

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
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg md:h-12 md:w-12 md:rounded-xl ${tone}`}
        >
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

function formatStockValue(value: number) {
  if (value >= 100_000) {
    return `${(value / 100_000).toFixed(1)}L`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString("en-IN");
}

type PriceBasis = "selling" | "cost" | "dealer";

function StockValueCard({
  stockValueBySelling,
  stockValueByCost,
  stockValueByDealer,
  canViewCostPrice,
}: {
  stockValueBySelling: number;
  stockValueByCost: number;
  stockValueByDealer: number;
  canViewCostPrice: boolean;
}) {
  const [priceBasis, setPriceBasis] = useState<PriceBasis>("selling");

  const stockValue =
    priceBasis === "cost"
      ? stockValueByCost
      : priceBasis === "dealer"
        ? stockValueByDealer
        : stockValueBySelling;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 md:h-12 md:w-12 md:rounded-xl">
          <span className="text-3xl font-bold md:text-4xl">₹</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 md:text-sm">Stock Value</p>
          <p className="text-xl font-bold text-gray-900 md:text-2xl">
            {formatStockValue(stockValue)}
          </p>
        </div>
      </div>
      {canViewCostPrice && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <select
            value={priceBasis}
            onChange={(e) => setPriceBasis(e.target.value as PriceBasis)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="selling">by Selling Price</option>
            <option value="cost">by Cost Price</option>
            <option value="dealer">by Dealer Price</option>
          </select>
        </div>
      )}
    </article>
  );
}

const warehouseTones = [
  "bg-green-50 text-green-600",
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-rose-50 text-rose-600",
];

export function InventoryDashboard({
  stats,
  canViewCostPrice,
}: {
  stats: DashboardStats;
  canViewCostPrice: boolean;
}) {
  const locationData = stats.warehouseCounts.map(({ name, count }) => ({
    name,
    value: count,
  }));

  return (
    <div className="space-y-6 md:space-y-8">
      <section>
        <h2 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Dashboard
        </h2>
        <p className="text-gray-500">Overview of your marble inventory</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Package}
          label="Total Slabs"
          value={String(stats.totalSlabs)}
          tone="bg-gray-100 text-gray-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Sqft"
          value={stats.totalSqft.toLocaleString("en-IN")}
          tone="bg-blue-50 text-blue-600"
        />
        {stats.warehouseCounts.map(({ name, count }, index) => (
          <StatCard
            key={name}
            icon={MapPin}
            label={name}
            value={String(count)}
            tone={warehouseTones[index % warehouseTones.length]}
          />
        ))}
        <StatCard
          icon={Clock}
          label="Reserved"
          value={String(stats.reservedCount)}
          tone="bg-orange-50 text-orange-600"
        />
        <StockValueCard
          stockValueBySelling={stats.stockValueBySelling}
          canViewCostPrice={canViewCostPrice}
          stockValueByCost={stats.stockValueByCost}
          stockValueByDealer={stats.stockValueByDealer}
        />
      </section>

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
                  {locationData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
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
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1f2937" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Recent Activity
          </h3>
          {stats.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No activity yet
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gray-900" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.text}</p>
                    <p className="mt-1 text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Alerts
          </h3>
          {stats.alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No alerts
            </p>
          ) : (
            <div className="space-y-4">
              {stats.alerts.map((alert) => {
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
      </section>
    </div>
  );
}
