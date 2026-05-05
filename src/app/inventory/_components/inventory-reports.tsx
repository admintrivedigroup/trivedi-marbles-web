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
          <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
            Reports
          </h1>
          <p className="text-gray-500">Inventory analytics and insights</p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:shadow-lg"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:mb-8 md:gap-6">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-green-600 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 md:text-sm">
                Total Revenue (May)
              </p>
              <p className="text-xl font-bold text-gray-900 md:text-2xl">
                Rs. 0
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-blue-600 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 md:text-sm">Slabs Sold (May)</p>
              <p className="text-xl font-bold text-gray-900 md:text-2xl">0</p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 md:h-12 md:w-12 md:rounded-xl">
              <BarChart3 className="h-5 w-5 text-violet-600 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 md:text-sm">Avg. Deal Size</p>
              <p className="text-xl font-bold text-gray-900 md:text-2xl">
                Rs. 0
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 md:mb-8 md:gap-6">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
            Revenue & Sales Trend
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#1f2937"
                strokeWidth={2}
                name="Revenue (Rs.)"
              />
              <Line
                type="monotone"
                dataKey="slabs"
                stroke="#6b7280"
                strokeWidth={2}
                name="Slabs Sold"
              />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
            Stock Value by Category
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#1f2937"
                radius={[8, 8, 0, 0]}
                name="Value (Rs.)"
              />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h2 className="mb-4 text-base font-bold text-gray-900 md:mb-6 md:text-lg">
          Quick Reports
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          <button
            type="button"
            className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <Calendar className="mb-2 h-8 w-8 text-gray-600" />
            <p className="font-medium text-gray-900">Monthly Summary</p>
            <p className="text-sm text-gray-500">Last 30 days</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-gray-600" />
            <p className="font-medium text-gray-900">Stock Valuation</p>
            <p className="text-sm text-gray-500">Current inventory</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-gray-600" />
            <p className="font-medium text-gray-900">Sales by Location</p>
            <p className="text-sm text-gray-500">Performance comparison</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <BarChart3 className="mb-2 h-8 w-8 text-gray-600" />
            <p className="font-medium text-gray-900">Top Sellers</p>
            <p className="text-sm text-gray-500">Best performing marble</p>
          </button>
        </div>
      </section>
    </div>
  );
}
