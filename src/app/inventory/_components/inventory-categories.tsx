"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Package, Search, X } from "lucide-react";
import { ActivitySpinner } from "@/components/ui/activity-spinner";

import type { CategoryFolder } from "@/app/inventory/_lib/category-overview";
import { getLotFolderHref, type LotFolder } from "@/app/inventory/_lib/lot-folders";
import { CategoryCard } from "@/app/inventory/_components/category-card";
import { LotFolderCard } from "@/app/inventory/_components/lot-folder-card";

type InventoryCategoriesProps = {
  error: string | null;
  categories: CategoryFolder[];
  uncategorized: CategoryFolder | null;
  searchResults: LotFolder[] | null;
  totalLots: number;
  totalSlabs: number;
  canAddStock: boolean;
};

export function InventoryCategories({
  error,
  categories,
  uncategorized,
  searchResults,
  totalLots,
  totalSlabs,
  canAddStock,
}: InventoryCategoriesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavPending, startNavTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    startNavTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const isSearching = searchResults !== null;
  const allCategories = uncategorized ? [...categories, uncategorized] : categories;

  const emptyMessage = error
    ? "Unable to load inventory right now"
    : isSearching
      ? "No lots match your search"
      : "No categories yet. Add your first lot to get started.";

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Inventory</h1>
          <p className="text-muted-foreground">
            {totalLots} {totalLots === 1 ? "lot" : "lots"} &middot; {totalSlabs} slabs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/inventory/export"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted"
            title="Export all inventory to Excel (.xlsx)"
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
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mb-6 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="relative mb-6 md:mb-8">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, slab ID or lot..."
          value={searchTerm}
          onChange={(e) => {
            const value = e.target.value;
            setSearchTerm(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => navigateSearch(value), 400);
          }}
          className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-11 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              navigateSearch("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={`relative transition-opacity duration-150 ${isNavPending ? "pointer-events-none opacity-50" : ""}`}>
        {isNavPending && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <ActivitySpinner size={44} />
          </div>
        )}

        {isSearching ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchResults!.length} {searchResults!.length === 1 ? "lot" : "lots"} match &ldquo;{searchTerm}&rdquo;
            </p>
            {searchResults!.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
                {emptyMessage}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                {searchResults!.map((lot) => (
                  <LotFolderCard key={lot.lotId} lot={lot} href={getLotFolderHref(lot)} showCategoryBadge />
                ))}
              </div>
            )}
          </>
        ) : allCategories.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {allCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
