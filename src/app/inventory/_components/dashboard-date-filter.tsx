"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import { DASHBOARD_DATE_PRESETS } from "@/app/inventory/_lib/dashboard-date-range";

export function DashboardDateFilter({
  preset,
  from,
  to,
}: {
  preset: string | null;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromVal, setFromVal] = useState(from ?? "");
  const [toVal, setToVal] = useState(to ?? "");
  const [showCustom, setShowCustom] = useState(!!(from || to));

  function applyPreset(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", value);
    params.delete("from");
    params.delete("to");
    setFromVal("");
    setToVal("");
    setShowCustom(false);
    router.push(`?${params.toString()}`);
  }

  function applyCustom() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("preset");
    if (fromVal) params.set("from", fromVal); else params.delete("from");
    if (toVal) params.set("to", toVal); else params.delete("to");
    router.push(`?${params.toString()}`);
  }

  function clearFilter() {
    setFromVal("");
    setToVal("");
    setShowCustom(false);
    router.push("?");
  }

  const hasFilter = !!(preset || from || to);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 md:rounded-2xl">
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={clearFilter}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            !hasFilter ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          All Time
        </button>
        {DASHBOARD_DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => applyPreset(p.value)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              preset === p.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            from || to ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 md:border-t-0 md:border-l md:pl-3 md:pt-0">
          <input
            type="date"
            value={fromVal}
            max={toVal || undefined}
            onChange={(e) => setFromVal(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={toVal}
            min={fromVal || undefined}
            onChange={(e) => setToVal(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!fromVal && !toVal}
            className="rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-colors hover:opacity-90 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {hasFilter && (
        <button
          type="button"
          onClick={clearFilter}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
