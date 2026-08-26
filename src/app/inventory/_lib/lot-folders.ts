// No "server-only" here — this module is pure data-shaping logic imported by
// both server libs (category-overview, category-lots) and client components
// (category-lot-grid, which needs LOTS_PER_PAGE for its pagination labels).

import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";

export const LOTS_PER_PAGE = 20;

export type LotFolder = {
  lotId: string;
  lotNumber: string | null;
  marbleName: string | null;
  categoryName: string | null;
  thumbnailUrl: string | null;
  slabCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  totalSqft: number;
  latestCreatedAt: string | null;
  isOrphan: boolean;
};

export type LotFolderSortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "sqft_desc" | "sqft_asc";

export const LOT_FOLDER_SORT_OPTIONS: { value: LotFolderSortBy; label: string }[] = [
  { value: "newest",    label: "Newest First"   },
  { value: "oldest",    label: "Oldest First"   },
  { value: "name_asc",  label: "Name A–Z"       },
  { value: "name_desc", label: "Name Z–A"       },
  { value: "sqft_desc", label: "Sqft: High–Low" },
  { value: "sqft_asc",  label: "Sqft: Low–High" },
];

/** Groups slabs (already in a stable order) into per-lot folders, preserving first-seen order. */
export function groupSlabsIntoLotFolders(slabs: InventoryListSlab[]): LotFolder[] {
  const map = new Map<string, LotFolder>();

  for (const slab of slabs) {
    const isOrphan = !slab.lotId;
    const key = slab.lotId ?? `__slab_${slab.id}`;

    let folder = map.get(key);
    if (!folder) {
      folder = {
        lotId: key,
        lotNumber: slab.lotNumber,
        marbleName: slab.marbleName,
        categoryName: slab.categoryName,
        thumbnailUrl: null,
        slabCount: 0,
        availableCount: 0,
        reservedCount: 0,
        soldCount: 0,
        totalSqft: 0,
        latestCreatedAt: null,
        isOrphan,
      };
      map.set(key, folder);
    }

    folder.slabCount++;
    folder.totalSqft += slab.sqft ?? 0;
    if (slab.statusName === "Available") folder.availableCount++;
    else if (slab.statusName === "Reserved") folder.reservedCount++;
    else if (slab.statusName === "Sold") folder.soldCount++;

    if (!folder.thumbnailUrl && slab.thumbnailUrl) folder.thumbnailUrl = slab.thumbnailUrl;

    if (slab.createdAt && (!folder.latestCreatedAt || slab.createdAt > folder.latestCreatedAt)) {
      folder.latestCreatedAt = slab.createdAt;
    }
  }

  return Array.from(map.values());
}

export function sortLotFolders(folders: LotFolder[], sortBy: LotFolderSortBy): LotFolder[] {
  const sorted = [...folders];
  switch (sortBy) {
    case "oldest":
      sorted.sort((a, b) => (a.latestCreatedAt ?? "").localeCompare(b.latestCreatedAt ?? ""));
      break;
    case "name_asc":
      sorted.sort((a, b) => (a.marbleName ?? "").localeCompare(b.marbleName ?? ""));
      break;
    case "name_desc":
      sorted.sort((a, b) => (b.marbleName ?? "").localeCompare(a.marbleName ?? ""));
      break;
    case "sqft_desc":
      sorted.sort((a, b) => b.totalSqft - a.totalSqft);
      break;
    case "sqft_asc":
      sorted.sort((a, b) => a.totalSqft - b.totalSqft);
      break;
    case "newest":
    default:
      sorted.sort((a, b) => (b.latestCreatedAt ?? "").localeCompare(a.latestCreatedAt ?? ""));
      break;
  }
  return sorted;
}

/** Orphan slabs (no lot_id) have no lot page — route straight to the slab instead. */
export function getLotFolderHref(folder: LotFolder): string {
  if (folder.isOrphan) {
    return `/inventory/slab/${folder.lotId.slice("__slab_".length)}`;
  }
  return `/inventory/lot/${folder.lotId}`;
}

/** Matches the old flat list's search behaviour: name, slab ID, or lot number. */
export function matchesSlabSearch(slab: InventoryListSlab, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    (slab.marbleName?.toLowerCase().includes(q) ?? false) ||
    (slab.slabCode?.toLowerCase().includes(q) ?? false) ||
    (slab.lotNumber?.toLowerCase().includes(q) ?? false)
  );
}
