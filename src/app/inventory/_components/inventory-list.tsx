"use client";

import { Fragment, startTransition, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUpRight, ChevronLeft, ChevronRight, Download, Edit, Filter, Package, Search } from "lucide-react";

import { withCloudinaryTransforms } from "@/lib/cloudinary/upload";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import type { InventoryListSlab, SortBy } from "@/app/inventory/_lib/inventory-list";

type InventoryListProps = {
  error: string | null;
  slabs: InventoryListSlab[];
  canViewCostPrice: boolean;
  canAddStock: boolean;
  inTransitSlabIds?: Set<string>;
  sortBy?: SortBy;
};

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "newest",    label: "Newest First"  },
  { value: "oldest",    label: "Oldest First"  },
  { value: "name_asc",  label: "Name A–Z"      },
  { value: "name_desc", label: "Name Z–A"      },
  { value: "sqft_desc", label: "Sqft: High–Low" },
  { value: "sqft_asc",  label: "Sqft: Low–High" },
];

type LotGroup = {
  lotId: string;
  lotNumber: string | null;
  marbleName: string | null;
  slabs: InventoryListSlab[];
};

const LOTS_PER_PAGE = 20;

function getStatusColor(status: string | null) {
  switch (status) {
    case "Available":
      return "bg-green-100 text-green-700";
    case "Reserved":
      return "bg-orange-100 text-orange-700";
    case "Sold":
      return "bg-gray-100 text-gray-700";
    case "In Transit":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-IN");
}

function formatThicknessLabel(value: string | null) {
  if (!value) return "-";
  return /^\d+(\.\d+)?$/.test(value) ? `${value}mm` : value;
}

function formatSize(length: number | null, width: number | null) {
  if (length === null || width === null) return "-";
  return `${formatNumber(length)}' x ${formatNumber(width)}'`;
}

function getDisplayText(value: string | null) {
  return value ?? "-";
}

function SlabThumbnail({ imageUrl, className }: { imageUrl: string | null; className: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={withCloudinaryTransforms(imageUrl)}
        alt="Slab"
        className={`rounded-lg object-cover shadow-sm ${className}`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center rounded-lg bg-gray-100 shadow-sm ${className}`}>
      <Package className="h-6 w-6 text-gray-400" />
    </div>
  );
}

function groupSlabsByLot(slabs: InventoryListSlab[]): LotGroup[] {
  const map = new Map<string, LotGroup>();
  for (const slab of slabs) {
    const key = slab.lotId ?? `__slab_${slab.id}`;
    if (!map.has(key)) {
      map.set(key, {
        lotId: key,
        lotNumber: slab.lotNumber,
        marbleName: slab.marbleName,
        slabs: [],
      });
    }
    map.get(key)!.slabs.push(slab);
  }
  return Array.from(map.values());
}

function getLotStatusSummary(slabs: InventoryListSlab[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const slab of slabs) {
    const status = slab.statusName ?? "Unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return Object.entries(counts);
}

function getLotTotalSqft(slabs: InventoryListSlab[]): number {
  return slabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0);
}

function getLotPriceRange(slabs: InventoryListSlab[]): string {
  const prices = slabs
    .map((s) => s.sellingPrice)
    .filter((p): p is number => p !== null);
  if (prices.length === 0) return "-";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `Rs. ${formatNumber(min)}`;
  return `Rs. ${formatNumber(min)} – ${formatNumber(max)}`;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function PaginationControls({
  page,
  totalPages,
  totalLots,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalLots: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * LOTS_PER_PAGE + 1;
  const to = Math.min(page * LOTS_PER_PAGE, totalLots);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="mt-4 flex flex-col items-center gap-3 md:mt-6">
      <p className="text-sm text-gray-500">
        Showing lots {from}–{to} of {totalLots}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function InventoryList({ error, slabs, canViewCostPrice, canAddStock, inTransitSlabIds = new Set(), sortBy = "newest" }: InventoryListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { options } = useLookupOptions();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const warehouseId = searchParams.get("warehouse") ?? "";
  const statusId = searchParams.get("status") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const urlPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function setFilter(key: string, value: string) {
    navigate({ [key]: value, page: "" });
  }

  function setPage(p: number) {
    navigate({ page: p === 1 ? "" : String(p) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleLot(lotId: string) {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  }

  const isFiltering = searchTerm.length > 0 || warehouseId !== "" || statusId !== "";

  const allLots = groupSlabsByLot(slabs);
  const totalPages = Math.max(1, Math.ceil(allLots.length / LOTS_PER_PAGE));
  const activePage = Math.min(urlPage, totalPages);
  const paginatedLots = allLots.slice(
    (activePage - 1) * LOTS_PER_PAGE,
    activePage * LOTS_PER_PAGE,
  );

  function isLotExpanded(lotId: string) {
    return isFiltering || expandedLots.has(lotId);
  }

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (warehouseId) params.set("warehouse", warehouseId);
    if (statusId) params.set("status", statusId);
    if (sortBy !== "newest") params.set("sort", sortBy);
    const q = searchParams.get("q") ?? "";
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/inventory/export${qs ? `?${qs}` : ""}`;
  })();

  const emptyMessage = error
    ? "Unable to load inventory right now"
    : slabs.length === 0
      ? "No slabs added yet. Use Add New Lot to get started."
      : "No slabs match your filters";

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
            Inventory
          </h1>
          <p className="text-gray-500">
            {allLots.length} {allLots.length === 1 ? "lot" : "lots"} &middot;{" "}
            {slabs.length} slabs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportHref}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            title="Export current view to CSV"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          {canAddStock && (
            <Link
              href="/inventory/add"
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white! transition-all hover:scale-[1.02] hover:shadow-lg hover:text-white! [&_svg]:text-white!"
            >
              <Package className="h-5 w-5" />
              Add New Lot
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mb-6">
          {error}
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:mb-6 md:rounded-2xl md:p-6">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-5 md:gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, slab ID or lot..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                  navigate({ q: value, page: "" });
                }, 400);
              }}
              className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              value={warehouseId}
              onChange={(e) => setFilter("warehouse", e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              <option value="">All Locations</option>
              {options.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              value={statusId}
              onChange={(e) => setFilter("status", e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              <option value="">All Status</option>
              {options.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setFilter("sort", e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {paginatedLots.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center text-gray-500 shadow-sm">
          {emptyMessage}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="max-md:hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Photo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Slab ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Sqft <span className="font-light text-gray-400">(estimate)</span>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Thickness
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Rack
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    {canViewCostPrice && (
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Price
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedLots.map((lot) => {
                    const expanded = isLotExpanded(lot.lotId);
                    const statusSummary = getLotStatusSummary(lot.slabs);
                    const totalSqft = getLotTotalSqft(lot.slabs);
                    const priceRange = getLotPriceRange(lot.slabs);

                    return (
                      <Fragment key={lot.lotId}>
                        {/* Lot header row */}
                        <tr
                          onClick={() => toggleLot(lot.lotId)}
                          className="cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <td colSpan={11} className="px-6 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <ChevronRight
                                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                              />
                              <span className="font-mono text-sm font-bold text-gray-900">
                                {getDisplayText(lot.lotNumber)}
                              </span>
                              <span className="font-medium text-gray-800">
                                {getDisplayText(lot.marbleName)}
                              </span>
                              <span className="text-sm text-gray-400">·</span>
                              <span className="text-sm text-gray-500">
                                {lot.slabs.length}{" "}
                                {lot.slabs.length === 1 ? "slab" : "slabs"}
                              </span>
                              <span className="text-sm text-gray-400">·</span>
                              <span className="text-sm text-gray-500">
                                {formatNumber(totalSqft)} sqft <span className="font-light text-gray-400">(estimate)</span>
                              </span>
                              {canViewCostPrice && (
                                <>
                                  <span className="text-sm text-gray-400">·</span>
                                  <span className="text-sm font-semibold text-gray-700">
                                    {priceRange}
                                  </span>
                                </>
                              )}
                              <div className="ml-auto flex flex-wrap items-center gap-2">
                                {statusSummary.map(([status, count]) => (
                                  <span
                                    key={status}
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)}`}
                                  >
                                    {count} {status}
                                  </span>
                                ))}
                                {!lot.lotId.startsWith("__slab_") && (
                                  <Link
                                    href={`/inventory/lot/${lot.lotId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white! transition-colors hover:bg-gray-700 hover:text-white! [&_svg]:text-white!"
                                  >
                                    View Lot
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Slab sub-rows */}
                        {expanded &&
                          lot.slabs.map((slab) => {
                            const isInTransit = inTransitSlabIds.has(slab.id);
                            return (
                              <tr
                                key={slab.id}
                                onClick={() => router.push(`/inventory/slab/${slab.id}`)}
                                className={`cursor-pointer transition-colors border-l-4 border-l-transparent hover:border-l-gray-200 ${isInTransit ? "bg-blue-50/40 hover:bg-blue-50" : "bg-white hover:bg-gray-50"}`}
                              >
                                <td className="pl-14 pr-6 py-4">
                                  <SlabThumbnail imageUrl={slab.thumbnailUrl} className="h-14 w-14" />
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-medium text-gray-900">
                                    {getDisplayText(slab.marbleName)}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {getDisplayText(slab.categoryName)}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-mono text-sm text-gray-700">
                                    {getDisplayText(slab.slabCode)}
                                  </p>
                                </td>
                                <td className="px-6 py-4 text-gray-700">
                                  {formatSize(slab.length, slab.width)}
                                </td>
                                <td className="px-6 py-4 font-semibold text-gray-700">
                                  {formatNumber(slab.sqft)}
                                </td>
                                <td className="px-6 py-4 text-gray-700">
                                  {formatThicknessLabel(slab.thicknessName)}
                                </td>
                                <td className="px-6 py-4 text-gray-700">
                                  {getDisplayText(slab.warehouseName)}
                                </td>
                                <td className="px-6 py-4 font-mono text-sm text-gray-700">
                                  {getDisplayText(slab.rackNumber)}
                                </td>
                                <td className="px-6 py-4">
                                  {isInTransit ? (
                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                      In Transit
                                    </span>
                                  ) : (
                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(slab.statusName)}`}>
                                      {getDisplayText(slab.statusName)}
                                    </span>
                                  )}
                                </td>
                                {canViewCostPrice && (
                                  <td className="px-6 py-4 font-semibold text-gray-900">
                                    Rs. {formatNumber(slab.sellingPrice)}
                                  </td>
                                )}
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {isInTransit ? (
                                      <span
                                        className="cursor-not-allowed rounded-lg p-2 opacity-30"
                                        title="Cannot edit — slab is in transit"
                                      >
                                        <Edit className="h-4 w-4 text-gray-400" />
                                      </span>
                                    ) : (
                                      <Link
                                        href={`/inventory/edit/${slab.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                                        title="Edit"
                                      >
                                        <Edit className="h-4 w-4 text-gray-600" />
                                      </Link>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {paginatedLots.map((lot) => {
              const expanded = isLotExpanded(lot.lotId);
              const statusSummary = getLotStatusSummary(lot.slabs);
              const totalSqft = getLotTotalSqft(lot.slabs);

              return (
                <div
                  key={lot.lotId}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
                >
                  {/* Lot header */}
                  <button
                    type="button"
                    onClick={() => toggleLot(lot.lotId)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left"
                  >
                    <ChevronRight
                      className={`mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-900">
                          {getDisplayText(lot.lotNumber)}
                        </span>
                        <span className="text-sm text-gray-400">·</span>
                        <span className="text-sm text-gray-500">
                          {lot.slabs.length}{" "}
                          {lot.slabs.length === 1 ? "slab" : "slabs"}
                        </span>
                      </div>
                      <p className="mb-2 font-medium text-gray-900">
                        {getDisplayText(lot.marbleName)}
                      </p>
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        {statusSummary.map(([status, count]) => (
                          <span
                            key={status}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(status)}`}
                          >
                            {count} {status}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatNumber(totalSqft)} sqft total <span className="font-light text-gray-400">(estimate)</span>
                      </p>
                      {!lot.lotId.startsWith("__slab_") && (
                        <Link
                          href={`/inventory/lot/${lot.lotId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 flex items-center gap-1 self-start rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white! hover:text-white! [&_svg]:text-white!"
                        >
                          View Lot
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </button>

                  {/* Slab sub-cards */}
                  {expanded && (
                    <div className="divide-y divide-gray-50 border-t border-gray-100">
                      {lot.slabs.map((slab) => {
                        const isInTransit = inTransitSlabIds.has(slab.id);
                        return (
                          <div
                            key={slab.id}
                            onClick={() => router.push(`/inventory/slab/${slab.id}`)}
                            className={`cursor-pointer px-4 py-3 pl-11 ${isInTransit ? "bg-blue-50/40 active:bg-blue-100" : "bg-gray-50/60 active:bg-gray-100"}`}
                          >
                            <div className="mb-2 flex gap-3">
                              <SlabThumbnail imageUrl={slab.thumbnailUrl} className="h-16 w-16 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900">
                                  {getDisplayText(slab.marbleName)}
                                </p>
                                <p className="mb-1 text-sm text-gray-500">
                                  {getDisplayText(slab.categoryName)}
                                </p>
                                {isInTransit ? (
                                  <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                    In Transit
                                  </span>
                                ) : (
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(slab.statusName)}`}>
                                    {getDisplayText(slab.statusName)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-500">Slab ID</p>
                                <p className="font-mono text-gray-900">
                                  {getDisplayText(slab.slabCode)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Size</p>
                                <p className="text-gray-900">
                                  {formatSize(slab.length, slab.width)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Sqft <span className="font-light text-gray-400">(estimate)</span></p>
                                <p className="font-semibold text-gray-900">
                                  {formatNumber(slab.sqft)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Thickness</p>
                                <p className="text-gray-900">
                                  {formatThicknessLabel(slab.thicknessName)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Location</p>
                                <p className="text-gray-900">
                                  {getDisplayText(slab.warehouseName)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Rack</p>
                                <p className="font-mono text-gray-900">
                                  {getDisplayText(slab.rackNumber)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                              {canViewCostPrice && (
                                <div>
                                  <p className="text-xs text-gray-500">Price</p>
                                  <p className="font-semibold text-gray-900">
                                    Rs. {formatNumber(slab.sellingPrice)}/sqft <span className="font-light text-gray-400">(estimate)</span>
                                  </p>
                                </div>
                              )}
                              <div className="flex gap-1">
                                {isInTransit ? (
                                  <span
                                    className="cursor-not-allowed rounded-lg p-2 opacity-30"
                                    title="Cannot edit — slab is in transit"
                                  >
                                    <Edit className="h-4 w-4 text-gray-400" />
                                  </span>
                                ) : (
                                  <Link
                                    href={`/inventory/edit/${slab.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-lg p-2 transition-colors hover:bg-gray-200"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4 text-gray-600" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <PaginationControls
            page={activePage}
            totalPages={totalPages}
            totalLots={allLots.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
