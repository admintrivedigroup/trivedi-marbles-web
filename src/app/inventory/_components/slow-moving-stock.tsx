"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronRight, Download, Hourglass } from "lucide-react";

import { downloadCsv, toCsv, type CsvCell } from "@/app/inventory/_lib/csv";
import { formatCurrency, formatDate, formatNumber } from "@/app/inventory/_lib/format";
import {
  AGE_MILESTONES,
  WAREHOUSE_AGE_BUCKETS,
  totalSlowStock,
  type SlowMovingLot,
  type WarehouseAgeing,
} from "@/app/inventory/_lib/stock-ageing";

type SlowMovingStockProps = {
  minDays: number;
  lots: SlowMovingLot[];
  warehouseAgeing: WarehouseAgeing[];
  /** The inventory was too large to load in full, so figures are incomplete. */
  truncated: boolean;
  generatedAt: string;
};

function ageLabel(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }
  return `${days} days`;
}

function ageTone(days: number): string {
  if (days >= 365) return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  if (days >= 180) return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

function milestoneLabel(days: number): string {
  return days >= 365 ? "1 year+" : `${days}+ days`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
      <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
      <p className="text-xl font-bold text-foreground md:text-2xl">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </article>
  );
}

export function SlowMovingStock({ minDays, lots, warehouseAgeing, truncated, generatedAt }: SlowMovingStockProps) {
  const totals = totalSlowStock(lots);
  const unpriced = lots.reduce((n, l) => n + l.unpricedSlabs, 0);
  const fileDate = generatedAt.slice(0, 10);

  function exportCsv() {
    const rows: CsvCell[][] = [
      [
        "Marble",
        "Lot",
        "Category",
        "Warehouses",
        "Oldest slab added",
        "Age (days)",
        "Available slabs",
        "Reserved slabs",
        "Sqft",
        "Selling value (INR)",
      ],
      ...lots.map((l) => [
        l.marbleName,
        l.lotNumber,
        l.categoryName,
        l.warehouses.join(" / "),
        l.oldestAddedAt.slice(0, 10),
        l.ageDays,
        l.availableSlabs,
        l.reservedSlabs,
        l.sqft,
        l.value,
      ]),
    ];
    downloadCsv(`slow-moving-stock-${minDays}d-${fileDate}.csv`, toCsv(rows));
  }

  return (
    <div className="p-4 md:p-8">
      <Link
        href="/inventory/reports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Reports
      </Link>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Slow-Moving Stock</h1>
          <p className="text-muted-foreground">
            Lots with unsold slabs (available or reserved) older than the selected age. A lot&apos;s age is its oldest
            unsold slab.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={lots.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:shadow-lg disabled:opacity-50"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {truncated && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Inventory is too large to load in full, so this list may be incomplete.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Unsold for</span>
        {AGE_MILESTONES.map((m) => (
          <Link
            key={m}
            href={`/inventory/reports/slow-moving?min=${m}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              m === minDays ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {milestoneLabel(m)}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 md:mb-8 md:gap-6">
        <Stat label="Lots" value={formatNumber(totals.lots)} />
        <Stat label="Unsold slabs" value={formatNumber(totals.slabs)} />
        <Stat label="Sqft tied up" value={formatNumber(totals.sqft)} />
        <Stat
          label="Selling value tied up"
          value={formatCurrency(totals.value)}
          note={unpriced > 0 ? `${formatNumber(unpriced)} slab${unpriced === 1 ? "" : "s"} without a price not counted` : undefined}
        />
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card shadow-sm md:mb-8 md:rounded-2xl">
        <h2 className="p-4 text-base font-bold text-foreground md:px-6 md:pt-6 md:text-lg">
          Lots unsold for {milestoneLabel(minDays)}
        </h2>
        {lots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 pb-10 pt-4 text-center">
            <Hourglass className="h-8 w-8 text-emerald-400" />
            <p className="text-sm text-muted-foreground">No lots have had unsold stock this long.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead>
                <tr className="border-y border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium md:px-6">Marble</th>
                  <th className="px-3 py-2 font-medium">Warehouse</th>
                  <th className="px-3 py-2 font-medium">Age</th>
                  <th className="px-3 py-2 text-right font-medium">Available</th>
                  <th className="px-3 py-2 text-right font-medium">Reserved</th>
                  <th className="px-3 py-2 text-right font-medium">Sqft</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="w-10 px-4 py-2 md:px-6" />
                </tr>
              </thead>
              <tbody>
                {lots.map((lot, i) => {
                  const href = lot.lotId ? `/inventory/lot/${lot.lotId}` : null;
                  return (
                    <tr key={lot.lotId ?? `slab-${i}`} className="border-b border-border/50 last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 md:px-6">
                        {href ? (
                          <Link href={href} className="font-medium text-foreground hover:underline">
                            {lot.marbleName}
                          </Link>
                        ) : (
                          <p className="font-medium text-foreground">{lot.marbleName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {[lot.lotNumber ? `Lot ${lot.lotNumber}` : "No lot", lot.categoryName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{lot.warehouses.join(", ")}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ageTone(lot.ageDays)}`}>
                          {ageLabel(lot.ageDays)}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">since {formatDate(lot.oldestAddedAt)}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-foreground">{formatNumber(lot.availableSlabs)}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{formatNumber(lot.reservedSlabs)}</td>
                      <td className="px-3 py-3 text-right text-foreground">{formatNumber(lot.sqft)}</td>
                      <td className="px-3 py-3 text-right text-foreground">
                        {lot.value > 0 ? formatCurrency(lot.value) : "-"}
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        {href && (
                          <Link
                            href={href}
                            aria-label={`Open ${lot.marbleName}${lot.lotNumber ? ` lot ${lot.lotNumber}` : ""}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm md:rounded-2xl">
        <h2 className="p-4 text-base font-bold text-foreground md:px-6 md:pt-6 md:text-lg">Ageing by Warehouse</h2>
        {warehouseAgeing.length === 0 ? (
          <p className="px-4 pb-10 pt-4 text-center text-sm text-muted-foreground">No unsold stock.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-sm">
              <thead>
                <tr className="border-y border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium md:px-6">Warehouse</th>
                  {WAREHOUSE_AGE_BUCKETS.map((b) => (
                    <th key={b.label} className="px-3 py-2 text-right font-medium">
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warehouseAgeing.map((w) => (
                  <tr key={w.name} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground md:px-6">{w.name}</td>
                    {w.slabs.map((count, i) => (
                      <td key={i} className="px-3 py-3 text-right">
                        <span className={count > 0 && i > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
                          {formatNumber(count)} slab{count === 1 ? "" : "s"}
                        </span>
                        <p className="text-xs text-muted-foreground">{formatNumber(w.sqft[i])} sqft</p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
