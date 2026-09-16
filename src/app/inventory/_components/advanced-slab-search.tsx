"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, Package, Ruler, Search, X } from "lucide-react";

import { ActivitySpinner } from "@/components/ui/activity-spinner";
import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import type { RankedSlab } from "@/app/inventory/_lib/advanced-search";
import type { StockLookupOption } from "@/app/inventory/_lib/stock";
import { formatNumber, formatSize, getStatusColor } from "@/app/inventory/_lib/format";

type AdvancedSlabSearchProps = {
  categories: StockLookupOption[];
  warehouses: StockLookupOption[];
  statuses: StockLookupOption[];
  categoryId: string;
  sizeQuery: string;
  warehouseId: string;
  statusId: string;
  isInvalidSize: boolean;
  error: string | null;
  results: RankedSlab[] | null;
  totalMatches: number;
};

export function AdvancedSlabSearch({
  categories,
  warehouses,
  statuses,
  categoryId,
  sizeQuery,
  warehouseId,
  statusId,
  isInvalidSize,
  error,
  results,
  totalMatches,
}: AdvancedSlabSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavPending, startNavTransition] = useTransition();
  const [sizeInput, setSizeInput] = useState(sizeQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startNavTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSizeChange(value: string) {
    setSizeInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ size: value }), 500);
  }

  const hasQuery = sizeQuery.length > 0;
  const exactMatches = results?.filter((r) => r.isExactMatch) ?? [];
  const closeMatches = results?.filter((r) => !r.isExactMatch) ?? [];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/inventory/list"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
      </div>

      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Advanced Search</h1>
        <p className="text-muted-foreground">Find slabs by category and size — closest matches shown first.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 md:mb-8 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={categoryId}
            onChange={(e) => updateParams({ category: e.target.value })}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Size (ft)</label>
          <div className="relative">
            <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={sizeInput}
              onChange={(e) => handleSizeChange(e.target.value)}
              placeholder="e.g. 10 x 15"
              className={`w-full rounded-xl border bg-card py-2.5 pl-9 pr-9 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring ${
                isInvalidSize ? "border-red-300 dark:border-red-900/50" : "border-border"
              }`}
            />
            {sizeInput && (
              <button
                type="button"
                onClick={() => {
                  setSizeInput("");
                  updateParams({ size: "" });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Clear size"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Warehouse</label>
          <select
            value={warehouseId}
            onChange={(e) => updateParams({ warehouse: e.target.value })}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={statusId}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any Status</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isInvalidSize ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          Enter size as length × width in feet, e.g. &ldquo;10x15&rdquo; or &ldquo;10*15&rdquo;.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className={`relative transition-opacity duration-150 ${isNavPending ? "pointer-events-none opacity-50" : ""}`}>
        {isNavPending && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <ActivitySpinner size={44} />
          </div>
        )}

        {!hasQuery || isInvalidSize ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-sm">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            Enter a size like &ldquo;10x15&rdquo; to find matching slabs, closest first.
          </div>
        ) : results === null || results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-sm">
            No slabs found near that size.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {totalMatches} {totalMatches === 1 ? "slab" : "slabs"} found near {sizeQuery}
              {results.length < totalMatches ? ` (showing top ${results.length})` : ""}
            </p>

            {exactMatches.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Exact size match ({exactMatches.length})
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                  {exactMatches.map((slab) => (
                    <SlabResultCard key={slab.id} slab={slab} />
                  ))}
                </div>
              </div>
            )}

            {closeMatches.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Closest matches
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                  {closeMatches.map((slab) => (
                    <SlabResultCard key={slab.id} slab={slab} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SlabResultCard({ slab }: { slab: RankedSlab }) {
  const size = formatSize(slab.length, slab.width);

  return (
    <Link
      href={`/inventory/slab/${slab.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
        {slab.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryThumbnail(slab.thumbnailUrl)}
            alt={slab.marbleName ?? "Slab"}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusColor(slab.statusName)}`}>
          {slab.statusName ?? "—"}
        </span>
        {slab.isExactMatch && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Exact
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs font-bold text-foreground">{slab.slabCode ?? "—"}</span>
          {slab.categoryName && (
            <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {slab.categoryName}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-medium text-foreground">{slab.marbleName ?? "Untitled"}</p>
        {size ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {size} &middot; {formatNumber(slab.sqft)} sqft
          </p>
        ) : null}
        {slab.lotNumber ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">Lot {slab.lotNumber}</p>
        ) : null}
        {slab.warehouseName ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {slab.warehouseName}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
