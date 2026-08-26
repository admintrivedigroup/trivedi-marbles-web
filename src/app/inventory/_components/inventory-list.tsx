"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUpRight, Check, ChevronLeft, ChevronRight, DollarSign, Download, Edit, Filter, Package, Search, Trash2, X } from "lucide-react";
import { ActivitySpinner } from "@/components/ui/activity-spinner";

import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import type { InventoryListSlab, SortBy } from "@/app/inventory/_lib/inventory-list";
import { formatNumber, formatThickness, getStatusColor } from "@/app/inventory/_lib/format";
import { batchDeleteLots } from "@/app/inventory/_actions/batch-delete-lots";
import { updateSlabStatus, type SlabStatusName } from "@/app/inventory/_actions/update-slab-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type InventoryListProps = {
  error: string | null;
  slabs: InventoryListSlab[];
  canAddStock: boolean;
  inTransitSlabIds?: Set<string>;
  sortBy?: SortBy;
  totalLots: number;
  totalPages: number;
  totalSlabs: number;
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
        src={withCloudinaryThumbnail(imageUrl)}
        alt="Slab"
        className={`block shrink-0 rounded-lg object-cover shadow-sm ${className}`}
      />
    );
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg bg-muted shadow-sm ${className}`}>
      <Package className="h-6 w-6 text-muted-foreground" />
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

function getLotAvailableRatio(slabs: InventoryListSlab[]): { available: number; reserved: number; sold: number; total: number } {
  let available = 0, reserved = 0, sold = 0;
  for (const s of slabs) {
    if (s.statusName === "Available") available++;
    else if (s.statusName === "Reserved") reserved++;
    else if (s.statusName === "Sold") sold++;
  }
  return { available, reserved, sold, total: slabs.length };
}

function getLotTotalSqft(slabs: InventoryListSlab[]): number {
  return slabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0);
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

function SlabQuickActions({
  slabId,
  statusName,
  isInTransit,
  onSuccess,
}: {
  slabId: string;
  statusName: string | null;
  isInTransit: boolean;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function change(status: SlabStatusName) {
    startTransition(async () => {
      const result = await updateSlabStatus(slabId, status);
      if (!result.error) onSuccess();
    });
  }

  if (isInTransit || statusName === "In Transit") return null;

  return (
    <>
      {statusName === "Available" && (
        <button
          type="button"
          title="Mark as Sold"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); change("Sold"); }}
          className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-30 dark:text-green-400 dark:hover:bg-green-950/30"
        >
          <DollarSign className="h-4 w-4" />
        </button>
      )}
      {(statusName === "Reserved" || statusName === "Sold") && (
        <button
          type="button"
          title={statusName === "Reserved" ? "Release reservation" : "Mark as Available"}
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); change("Available"); }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </>
  );
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
      <p className="text-sm text-muted-foreground">
        Showing lots {from}–{to} of {totalLots}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted"
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function InventoryList({ error, slabs, canAddStock, inTransitSlabIds = new Set(), sortBy = "newest", totalLots, totalPages, totalSlabs }: InventoryListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { options } = useLookupOptions();
  const [isPending, startBatchTransition] = useTransition();
  const [isNavPending, startNavTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Selection state ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
    startNavTransition(() => {
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
    if (isSelectMode) {
      setSelectedLotIds((prev) => {
        const next = new Set(prev);
        if (next.has(lotId)) next.delete(lotId);
        else next.add(lotId);
        return next;
      });
      return;
    }
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  }

  function toggleSelectMode() {
    setIsSelectMode((v) => !v);
    setSelectedLotIds(new Set());
    setActionError(null);
  }

  function selectAllOnPage() {
    setSelectedLotIds(new Set(paginatedLots.map((l) => l.lotId)));
  }

  function confirmDelete() {
    setShowDeleteConfirm(false);
    const ids = Array.from(selectedLotIds).filter((id) => !id.startsWith("__slab_"));
    if (ids.length === 0) return;
    startBatchTransition(async () => {
      const result = await batchDeleteLots(ids);
      if (result.error) {
        setActionError(result.error);
      } else {
        setSelectedLotIds(new Set());
        router.refresh();
      }
    });
  }

  const isFiltering = searchTerm.length > 0 || warehouseId !== "" || statusId !== "";

  // Slabs are already scoped to the current page by the server; just group them.
  const paginatedLots = groupSlabsByLot(slabs);
  const activePage = Math.min(urlPage, totalPages);

  function isLotExpanded(lotId: string) {
    return !isSelectMode && (isFiltering || expandedLots.has(lotId));
  }

  // Only real lots (not orphan slabs) can be selected for deletion.
  // selectableLots is scoped to the current page (selecting across pages is not supported).
  const selectableLots = paginatedLots.filter((l) => !l.lotId.startsWith("__slab_"));
  const selectedCount = selectedLotIds.size;

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
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
            Inventory
          </h1>
          <p className="text-muted-foreground">
            {totalLots} {totalLots === 1 ? "lot" : "lots"} &middot;{" "}
            {totalSlabs} slabs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
              {selectableLots.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllOnPage}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Select all {selectableLots.length}
                </button>
              )}
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-xl border border-border px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-xl border border-border px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Select
              </button>
              <a
                href={exportHref}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted"
                title="Export current filters to Excel (.xlsx)"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </a>
              {canAddStock && (
                <Link
                  href="/inventory/add"
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground! transition-all hover:scale-[1.02] hover:shadow-lg hover:text-primary-foreground! [&_svg]:text-primary-foreground!"
                >
                  <Package className="h-5 w-5" />
                  Add New Lot
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mb-6 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {actionError}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mb-6 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className={`mb-4 rounded-xl border border-border bg-card p-4 shadow-sm md:mb-6 md:rounded-2xl md:p-6 ${isNavPending ? "pointer-events-none opacity-60" : ""}`}>
        <div className="flex flex-col gap-3 md:grid md:grid-cols-5 md:gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
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
              className="w-full rounded-xl border border-border py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={warehouseId}
              onChange={(e) => setFilter("warehouse", e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
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
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusId}
              onChange={(e) => setFilter("status", e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
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
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setFilter("sort", e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
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

      <div className={`relative transition-opacity duration-150 ${isNavPending ? "pointer-events-none opacity-50" : ""}`}>
        {isNavPending && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <ActivitySpinner size={44} />
          </div>
        )}
      {paginatedLots.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
          {emptyMessage}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="max-md:hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted">
                  <tr>
                    {isSelectMode && <th className="w-10 px-4 py-4" />}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground" style={{ minWidth: "120px" }}>
                      Photo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Slab ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Sqft <span className="font-light text-muted-foreground">(estimate)</span>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Thickness
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Rack
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedLots.map((lot) => {
                    const expanded = isLotExpanded(lot.lotId);
                    const statusSummary = getLotStatusSummary(lot.slabs);
                    const totalSqft = getLotTotalSqft(lot.slabs);
                    const availRatio = getLotAvailableRatio(lot.slabs);
                    const isSelectable = !lot.lotId.startsWith("__slab_");
                    const isSelected = selectedLotIds.has(lot.lotId);

                    return (
                      <Fragment key={lot.lotId}>
                        {/* Lot header row */}
                        <tr
                          onClick={() => toggleLot(lot.lotId)}
                          className={`cursor-pointer transition-colors ${
                            isSelectMode && isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "bg-muted hover:bg-accent"
                          }`}
                        >
                          {isSelectMode && (
                            <td className="px-4 py-3">
                              {isSelectable ? (
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded border-2 transition-colors"
                                  style={{
                                    background: isSelected ? "var(--primary)" : "var(--card)",
                                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                                  }}
                                >
                                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </span>
                              ) : (
                                <span className="block h-5 w-5" />
                              )}
                            </td>
                          )}
                          <td colSpan={isSelectMode ? 9 : 10} className="px-6 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <ChevronRight
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                              />
                              <span className="font-mono text-sm font-bold text-foreground">
                                {getDisplayText(lot.lotNumber)}
                              </span>
                              <span className="font-medium text-foreground">
                                {getDisplayText(lot.marbleName)}
                              </span>
                              <span className="text-sm text-muted-foreground">·</span>
                              <span className="text-sm text-muted-foreground">
                                {lot.slabs.length}{" "}
                                {lot.slabs.length === 1 ? "slab" : "slabs"}
                              </span>
                              <span className="text-sm text-muted-foreground">·</span>
                              <span className="text-sm text-muted-foreground">
                                {formatNumber(totalSqft)} sqft <span className="font-light text-muted-foreground">(estimate)</span>
                              </span>
                              <div className="ml-auto flex flex-wrap items-center gap-2">
                                {statusSummary.map(([status, count]) => (
                                  <span
                                    key={status}
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)}`}
                                  >
                                    {count} {status}
                                  </span>
                                ))}
                                {!isSelectMode && !lot.lotId.startsWith("__slab_") && (
                                  <Link
                                    href={`/inventory/lot/${lot.lotId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground! transition-colors hover:bg-primary/80 hover:text-primary-foreground! [&_svg]:text-primary-foreground!"
                                  >
                                    View Lot
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </div>
                            </div>
                            {availRatio.total > 0 && (
                              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                                <div className="flex h-full">
                                  <div style={{ width: `${(availRatio.available / availRatio.total) * 100}%` }} className="bg-green-400" />
                                  <div style={{ width: `${(availRatio.reserved / availRatio.total) * 100}%` }} className="bg-orange-400" />
                                  <div style={{ width: `${(availRatio.sold / availRatio.total) * 100}%` }} className="bg-border" />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Slab sub-rows */}
                        {expanded &&
                          lot.slabs.map((slab) => {
                            const isInTransit = inTransitSlabIds.has(slab.id);
                            return (
                              <tr
                                key={slab.id}
                                onClick={() => startNavTransition(() => router.push(`/inventory/slab/${slab.id}`))}
                                className={`cursor-pointer transition-colors border-l-4 border-l-transparent hover:border-l-border ${isInTransit ? "bg-blue-50/40 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30" : "bg-card hover:bg-muted"}`}
                              >
                                {isSelectMode && <td />}
                                <td className="py-3 pl-10 pr-4" style={{ minWidth: "120px" }}>
                                  <SlabThumbnail imageUrl={slab.thumbnailUrl} className="h-14 w-20 rounded-lg" />
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-medium text-foreground">
                                    {getDisplayText(slab.marbleName)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {getDisplayText(slab.categoryName)}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-mono text-sm text-muted-foreground">
                                    {getDisplayText(slab.slabCode)}
                                  </p>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {formatSize(slab.length, slab.width)}
                                </td>
                                <td className="px-6 py-4 font-semibold text-muted-foreground">
                                  {formatNumber(slab.sqft)}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {formatThickness(slab.thicknessName) ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {getDisplayText(slab.warehouseName)}
                                </td>
                                <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                                  {getDisplayText(slab.rackNumber)}
                                </td>
                                <td className="px-6 py-4">
                                  {isInTransit ? (
                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                      In Transit
                                    </span>
                                  ) : (
                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(slab.statusName)}`}>
                                      {getDisplayText(slab.statusName)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-1">
                                    <SlabQuickActions
                                      slabId={slab.id}
                                      statusName={slab.statusName}
                                      isInTransit={isInTransit}
                                      onSuccess={() => router.refresh()}
                                    />
                                    {isInTransit ? (
                                      <span
                                        className="cursor-not-allowed rounded-lg p-2 opacity-30"
                                        title="Cannot edit — slab is in transit"
                                      >
                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                      </span>
                                    ) : (
                                      <Link
                                        href={`/inventory/edit/${slab.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-lg p-2 transition-colors hover:bg-muted"
                                        title="Edit"
                                      >
                                        <Edit className="h-4 w-4 text-muted-foreground" />
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
              const isSelectable = !lot.lotId.startsWith("__slab_");
              const isSelected = selectedLotIds.has(lot.lotId);

              return (
                <div
                  key={lot.lotId}
                  className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-all ${
                    isSelectMode && isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {/* Lot header */}
                  <button
                    type="button"
                    onClick={() => toggleLot(lot.lotId)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left"
                  >
                    {isSelectMode ? (
                      isSelectable ? (
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors"
                          style={{
                            background: isSelected ? "var(--primary)" : "var(--card)",
                            borderColor: isSelected ? "var(--primary)" : "var(--border)",
                          }}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                      ) : (
                        <span className="mt-0.5 block h-5 w-5 shrink-0" />
                      )
                    ) : (
                      <ChevronRight
                        className={`mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {getDisplayText(lot.lotNumber)}
                        </span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">
                          {lot.slabs.length}{" "}
                          {lot.slabs.length === 1 ? "slab" : "slabs"}
                        </span>
                      </div>
                      <p className="mb-2 font-medium text-foreground">
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
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(totalSqft)} sqft total <span className="font-light text-muted-foreground">(estimate)</span>
                      </p>
                      {!isSelectMode && !lot.lotId.startsWith("__slab_") && (
                        <Link
                          href={`/inventory/lot/${lot.lotId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 flex items-center gap-1 self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground! hover:text-primary-foreground! [&_svg]:text-primary-foreground!"
                        >
                          View Lot
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </button>

                  {/* Slab sub-cards */}
                  {expanded && (
                    <div className="divide-y divide-border border-t border-border">
                      {lot.slabs.map((slab) => {
                        const isInTransit = inTransitSlabIds.has(slab.id);
                        return (
                          <div
                            key={slab.id}
                            onClick={() => startNavTransition(() => router.push(`/inventory/slab/${slab.id}`))}
                            className={`cursor-pointer px-4 py-3 pl-11 ${isInTransit ? "bg-blue-50/40 active:bg-blue-100 dark:bg-blue-950/20 dark:active:bg-blue-950/30" : "bg-muted/60 active:bg-muted"}`}
                          >
                            <div className="mb-2 flex gap-3">
                              <SlabThumbnail imageUrl={slab.thumbnailUrl} className="h-16 w-24 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">
                                  {getDisplayText(slab.marbleName)}
                                </p>
                                <p className="mb-1 text-sm text-muted-foreground">
                                  {getDisplayText(slab.categoryName)}
                                </p>
                                {isInTransit ? (
                                  <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
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
                                <p className="text-muted-foreground">Slab ID</p>
                                <p className="font-mono text-foreground">
                                  {getDisplayText(slab.slabCode)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Size</p>
                                <p className="text-foreground">
                                  {formatSize(slab.length, slab.width)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Sqft <span className="font-light text-muted-foreground">(estimate)</span></p>
                                <p className="font-semibold text-foreground">
                                  {formatNumber(slab.sqft)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Thickness</p>
                                <p className="text-foreground">
                                  {formatThickness(slab.thicknessName) ?? "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Location</p>
                                <p className="text-foreground">
                                  {getDisplayText(slab.warehouseName)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Rack</p>
                                <p className="font-mono text-foreground">
                                  {getDisplayText(slab.rackNumber)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-end border-t border-border pt-2">
                              <div className="flex gap-1">
                                {isInTransit ? (
                                  <span
                                    className="cursor-not-allowed rounded-lg p-2 opacity-30"
                                    title="Cannot edit — slab is in transit"
                                  >
                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                  </span>
                                ) : (
                                  <Link
                                    href={`/inventory/edit/${slab.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-lg p-2 transition-colors hover:bg-muted"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4 text-muted-foreground" />
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
            totalLots={totalLots}
            onPageChange={setPage}
          />
        </>
      )}

      </div>

      {/* Floating selection action bar */}
      {isSelectMode && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedCount} lot{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setActionError(null); setShowDeleteConfirm(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLotIds(new Set())}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title={`Delete ${selectedCount} lot${selectedCount !== 1 ? "s" : ""}?`}
        description={`This will permanently delete the selected lots and all their slabs and photos. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
