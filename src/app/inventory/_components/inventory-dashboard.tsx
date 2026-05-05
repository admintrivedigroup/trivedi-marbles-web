"use client";

import {
  AlertCircle,
  Clock,
  DollarSign,
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

import { activities, alerts, slabs } from "@/data/inventory";

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

export function InventoryDashboard() {
  const totalSlabs = slabs.length;
  const totalSqft = slabs.reduce((sum, slab) => sum + slab.sqft, 0);
  const ahmedabadStock = slabs.filter((slab) => slab.location === "Ahmedabad").length;
  const ambajiStock = slabs.filter((slab) => slab.location === "Ambaji").length;
  const reserved = slabs.filter((slab) => slab.status === "Reserved").length;
  const stockValue = slabs
    .filter((slab) => slab.status !== "Sold")
    .reduce((sum, slab) => sum + slab.sellPrice * slab.sqft, 0);

  const locationData = [
    { name: "Ahmedabad", value: ahmedabadStock },
    { name: "Ambaji", value: ambajiStock },
  ];

  const typeData = slabs.reduce<{ count: number; name: string }[]>((acc, slab) => {
    if (slab.status === "Sold") {
      return acc;
    }

    const existing = acc.find((item) => item.name === slab.category);

    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ name: slab.category, count: 1 });
    }

    return acc;
  }, []);

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
          value={String(totalSlabs)}
          tone="bg-gray-100 text-gray-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Sqft"
          value={totalSqft.toLocaleString("en-IN")}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={MapPin}
          label="Ahmedabad"
          value={String(ahmedabadStock)}
          tone="bg-green-50 text-green-600"
        />
        <StatCard
          icon={MapPin}
          label="Ambaji"
          value={String(ambajiStock)}
          tone="bg-violet-50 text-violet-600"
        />
        <StatCard
          icon={Clock}
          label="Reserved"
          value={String(reserved)}
          tone="bg-orange-50 text-orange-600"
        />
        <StatCard
          icon={DollarSign}
          label="Stock Value"
          value={`Rs. ${(stockValue / 1000).toFixed(0)}K`}
          tone="bg-emerald-50 text-emerald-600"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
            Stock by Location
          </h3>
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
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
            Stock by Marble Type
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={typeData}>
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
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
              >
                <div className="mt-2 h-2 w-2 rounded-full bg-gray-900" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.text}</p>
                  <p className="mt-1 text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Alerts
          </h3>
          <div className="space-y-4">
            {alerts.map((alert) => {
              const toneClass =
                alert.severity === "medium"
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
        </article>
      </section>
    </div>
  );
}
