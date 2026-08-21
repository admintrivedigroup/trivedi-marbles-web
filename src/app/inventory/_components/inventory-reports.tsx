"use client";

import { BarChart3, Calendar, Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { slabs } from "@/data/inventory";

const salesData: { month: string; revenue: number; slabs: number }[] = [];

export function InventoryReports() {
  const categoryData = slabs.reduce<{ name: string; value: number }[]>(
    (acc, slab) => {
      if (slab.status === "Sold") {
        return acc;
      }

      const existing = acc.find((item) => item.name === slab.category);
      const value = slab.sellPrice * slab.sqft;

      if (existing) {
        existing.value += value;
      } else {
        acc.push({ name: slab.category, value });
      }

      return acc;
    },
    [],
  );

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
            Reports
          </h1>
          <p className="text-muted-foreground">Inventory analytics and insights</p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:shadow-lg"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:mb-8 md:gap-6">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/30 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground md:text-sm">
                Total Revenue (May)
              </p>
              <p className="text-xl font-bold text-foreground md:text-2xl">
                Rs. 0
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground md:text-sm">Slabs Sold (May)</p>
              <p className="text-xl font-bold text-foreground md:text-2xl">0</p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground md:text-sm">Avg. Deal Size</p>
              <p className="text-xl font-bold text-foreground md:text-2xl">
                Rs. 0
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 md:mb-8 md:gap-6">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">
            Revenue & Sales Trend
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-1)"
                strokeWidth={2}
                name="Revenue (Rs.)"
              />
              <Line
                type="monotone"
                dataKey="slabs"
                stroke="var(--chart-2)"
                strokeWidth={2}
                name="Slabs Sold"
              />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">
            Stock Value by Category
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="var(--chart-1)"
                radius={[8, 8, 0, 0]}
                name="Value (Rs.)"
              />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
        <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">
          Quick Reports
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <Calendar className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Monthly Summary</p>
            <p className="text-sm text-muted-foreground">Last 30 days</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Stock Valuation</p>
            <p className="text-sm text-muted-foreground">Current inventory</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Sales by Location</p>
            <p className="text-sm text-muted-foreground">Performance comparison</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Top Sellers</p>
            <p className="text-sm text-muted-foreground">Best performing marble</p>
          </button>
        </div>
      </section>
    </div>
  );
}
