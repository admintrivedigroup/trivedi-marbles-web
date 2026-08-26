"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, ChevronLeft, ChevronRight, Download, Filter, Package, Search, Trash2 } from "lucide-react";
import { ActivitySpinner } from "@/components/ui/activity-spinner";

import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import { LOT_FOLDER_SORT_OPTIONS, LOTS_PER_PAGE, getLotFolderHref, type LotFolder, type LotFolderSortBy } from "@/app/inventory/_lib/lot-folders";
import { batchDeleteLots } from "@/app/inventory/_actions/batch-delete-lots";
import { LotFolderCard } from "@/app/inventory/_components/lot-folder-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CategoryLotGridProps = {
  error: string | null;
  categoryId: string;
  categoryName: string | null;
  lots: LotFolder[];
  totalLots: number;
  totalPages: number;
  totalSlabs: number;
  sortBy: LotFolderSortBy;
  canAddStock: boolean;
};

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function CategoryLotGrid({
  error,
  categoryId,
  categoryName,
  lots,
  totalLots,
  totalPages,
  totalSlabs,
  sortBy,
  canAddStock,
}: CategoryLotGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { options } = useLookupOptions();
  const [isPending, startBatchTransition] = useTransition();
  const [isNavPending, startNavTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const warehouseId = searchParams.get("warehouse") ?? "";
  const statusId = searchParams.get("status") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const activePage = Math.min(page, totalPages);

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
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

  function toggleSelectMode() {
    setIsSelectMode((v) => !v);
    setSelectedLotIds(new Set());
    setActionError(null);
  }

  function toggleLot(lotId: string) {
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  }

  const selectableLots = lots.filter((l) => !l.isOrphan);
  const selectedCount = selectedLotIds.size;

  function selectAllOnPage() {
    setSelectedLotIds(new Set(selectableLots.map((l) => l.lotId)));
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

  const exportHref = (() => {
    const params = new URLSearchParams();
    params.set("category", categoryId);
    if (warehouseId) params.set("warehouse", warehouseId);
    if (statusId) params.set("status", statusId);
    if (sortBy !== "newest") params.set("sort", sortBy);
    const q = searchParams.get("q") ?? "";
    if (q) params.set("q", q);
    return `/inventory/export?${params.toString()}`;
  })();

  const emptyMessage = error
    ? "Unable to load inventory right now"
    : totalSlabs === 0
      ? "No slabs in this category yet."
      : "No lots match your filters";

  return (
    <div className="p-4 md:p-8">
      <Link
        href="/inventory/list"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Categories
      </Link>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">{categoryName ?? "Category"}</h1>
          <p className="text-muted-foreground">
            {totalLots} {totalLots === 1 ? "lot" : "lots"} &middot; {totalSlabs} slabs
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

      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm md:mb-6 md:rounded-2xl md:p-6">
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
                debounceRef.current = setTimeout(() => navigate({ q: value, page: "" }), 400);
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
              {LOT_FOLDER_SORT_OPTIONS.map((opt) => (
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

        {lots.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {lots.map((lot) => (
              <LotFolderCard
                key={lot.lotId}
                lot={lot}
                href={getLotFolderHref(lot)}
                selectMode={isSelectMode}
                selected={selectedLotIds.has(lot.lotId)}
                onToggleSelect={lot.isOrphan ? undefined : () => toggleLot(lot.lotId)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex flex-col items-center gap-3 md:mt-6">
            <p className="text-sm text-muted-foreground">
              Showing lots {(activePage - 1) * LOTS_PER_PAGE + 1}–{Math.min(activePage * LOTS_PER_PAGE, totalLots)} of {totalLots}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(activePage - 1)}
                disabled={activePage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageNumbers(activePage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p === activePage
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
                onClick={() => setPage(activePage + 1)}
                disabled={activePage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
        description="This will permanently delete the selected lots and all their slabs and photos. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
