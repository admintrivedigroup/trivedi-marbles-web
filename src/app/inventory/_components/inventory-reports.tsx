"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Calendar, Download, MapPin, Package, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { downloadCsv, toCsv, type CsvCell } from "@/app/inventory/_lib/csv";
import { formatCurrency, formatNumber } from "@/app/inventory/_lib/format";
import type { ReportData } from "@/app/inventory/_lib/report-data";

type InventoryReportsProps = {
  data: ReportData;
  /** The inventory was too large to load in full, so figures are incomplete. */
  truncated: boolean;
  generatedAt: string;
};

type ReportKey = "valuation" | "location" | "sold" | "ageing";

function buildSection(key: ReportKey, data: ReportData): { title: string; rows: CsvCell[][] } {
  switch (key) {
    case "valuation":
      return {
        title: "Stock valuation by category",
        rows: [
          ["Category", "Slabs in stock", "Sqft in stock", "Selling value (INR)"],
          ...data.valueByCategory.map((c) => [c.name, c.slabs, c.sqft, c.value]),
          ["Total", data.totals.stockSlabs, data.totals.stockSqft, data.totals.stockValue],
        ],
      };
    case "location":
      return {
        title: "Stock by location",
        rows: [
          ["Warehouse", "Available", "Reserved", "Sold", "Sqft in stock"],
          ...data.byWarehouse.map((w) => [w.name, w.available, w.reserved, w.sold, w.stockSqft]),
        ],
      };
    case "sold":
      return {
        title: "Sold slabs by marble",
        rows: [["Marble", "Slabs sold", "Sqft sold"], ...data.soldByMarble.map((m) => [m.name, m.slabs, m.sqft])],
      };
    case "ageing":
      return {
        title: "Inventory ageing (in stock)",
        rows: [["Age", "Slabs", "Sqft"], ...data.ageing.map((a) => [a.label, a.slabs, a.sqft])],
      };
  }
}

const QUICK_REPORTS: { key: ReportKey; label: string; hint: string; icon: typeof Calendar }[] = [
  { key: "valuation", label: "Stock Valuation", hint: "Selling value by category", icon: BarChart3 },
  { key: "location", label: "Stock by Location", hint: "Slabs per warehouse", icon: MapPin },
  { key: "sold", label: "Sold by Marble", hint: "Most-sold marbles", icon: Trophy },
  { key: "ageing", label: "Inventory Ageing", hint: "How long stock has sat", icon: Calendar },
];

function StatCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg md:h-12 md:w-12 md:rounded-xl ${tone}`}>
          <Package className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
          <p className="text-xl font-bold text-foreground md:text-2xl">{value}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
    </article>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-62.5 items-center justify-center text-sm text-muted-foreground">{message}</div>
  );
}

export function InventoryReports({ data, truncated, generatedAt }: InventoryReportsProps) {
  const { totals } = data;
  const fileDate = generatedAt.slice(0, 10);

  function exportAll() {
    const sections = (["valuation", "location", "sold", "ageing"] as ReportKey[]).map((key) =>
      buildSection(key, data),
    );
    const rows: CsvCell[][] = [["Inventory report", fileDate]];
    for (const section of sections) {
      rows.push([], [section.title], ...section.rows);
    }
    downloadCsv(`inventory-report-${fileDate}.csv`, toCsv(rows));
  }

  function exportOne(key: ReportKey) {
    const section = buildSection(key, data);
    downloadCsv(`inventory-${key}-${fileDate}.csv`, toCsv(section.rows));
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Reports</h1>
          <p className="text-muted-foreground">
            Live figures from current stock. Sales revenue and monthly trends need a sale record per slab, which
            isn&apos;t captured yet.
          </p>
        </div>
        <button
          type="button"
          onClick={exportAll}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:shadow-lg"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>

      {truncated && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Inventory is too large to load in full, so these figures are incomplete.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mb-8 md:gap-6">
        <StatCard
          label="Stock value (selling)"
          value={formatCurrency(totals.stockValue)}
          note={
            totals.unpricedSlabs > 0
              ? `${formatNumber(totals.unpricedSlabs)} slab${totals.unpricedSlabs === 1 ? "" : "s"} without a price not counted`
              : "Available + reserved"
          }
          tone="bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
        />
        <StatCard
          label="Slabs in stock"
          value={formatNumber(totals.stockSlabs)}
          note={`${formatNumber(totals.stockSqft)} sqft`}
          tone="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
        />
        <StatCard
          label="Slabs sold"
          value={formatNumber(totals.soldSlabs)}
          note={`${formatNumber(totals.soldSqft)} sqft`}
          tone="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
        />
        <StatCard
          label="Avg. value per sqft"
          value={totals.stockSqft > 0 ? formatCurrency(Math.round(totals.stockValue / totals.stockSqft)) : "-"}
          note="Priced in-stock slabs"
          tone="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 md:mb-8 md:gap-6">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">Stock Value by Category</h2>
          {data.valueByCategory.length === 0 ? (
            <EmptyChart message="No stock yet." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.valueByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} name="Value (Rs.)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">Slabs by Warehouse</h2>
          {data.byWarehouse.length === 0 ? (
            <EmptyChart message="No stock yet." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.byWarehouse}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="available" stackId="s" fill="var(--chart-1)" name="Available" />
                <Bar dataKey="reserved" stackId="s" fill="var(--chart-2)" name="Reserved" />
                <Bar dataKey="sold" stackId="s" fill="var(--chart-3)" name="Sold" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-2 md:mb-6">
            <h2 className="text-base font-bold text-foreground md:text-lg">Inventory Ageing</h2>
            <Link href="/inventory/reports/slow-moving" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Slow-moving lots →
            </Link>
          </div>
          {totals.stockSlabs === 0 ? (
            <EmptyChart message="No stock yet." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.ageing}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="slabs" fill="var(--chart-1)" radius={[8, 8, 0, 0]} name="Slabs" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">Most Sold Marbles</h2>
          {data.soldByMarble.length === 0 ? (
            <EmptyChart message="Nothing sold yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Marble</th>
                  <th className="pb-2 text-right font-medium">Slabs</th>
                  <th className="pb-2 text-right font-medium">Sqft</th>
                </tr>
              </thead>
              <tbody>
                {data.soldByMarble.map((m) => (
                  <tr key={m.name} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-foreground">{m.name}</td>
                    <td className="py-2 text-right text-foreground">{formatNumber(m.slabs)}</td>
                    <td className="py-2 text-right text-muted-foreground">{formatNumber(m.sqft)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
        <h2 className="mb-4 text-base font-bold text-foreground md:mb-6 md:text-lg">Download Reports (CSV)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          {QUICK_REPORTS.map(({ key, label, hint, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => exportOne(key)}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
            >
              <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-foreground">{label}</p>
              <p className="text-sm text-muted-foreground">{hint}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
