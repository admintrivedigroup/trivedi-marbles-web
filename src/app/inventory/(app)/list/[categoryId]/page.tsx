import { Suspense } from "react";

import { CategoryLotGrid } from "@/app/inventory/_components/category-lot-grid";
import { getCategoryLots } from "@/app/inventory/_lib/category-lots";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import type { LotFolderSortBy } from "@/app/inventory/_lib/lot-folders";

import CategoryLotGridLoading from "./loading";

const VALID_SORTS: LotFolderSortBy[] = ["newest", "oldest", "name_asc", "name_desc", "sqft_desc", "sqft_asc"];

export default async function CategoryLotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ warehouse?: string; status?: string; sort?: string; q?: string; page?: string }>;
}) {
  const { categoryId } = await params;
  const sp = await searchParams;

  const warehouseId = typeof sp.warehouse === "string" ? sp.warehouse : "";
  const statusId = typeof sp.status === "string" ? sp.status : "";
  const sortBy: LotFolderSortBy = VALID_SORTS.includes(sp.sort as LotFolderSortBy) ? (sp.sort as LotFolderSortBy) : "newest";
  const search = typeof sp.q === "string" ? sp.q.trim() : "";
  const rawPage = Number(sp.page ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const profile = await getCurrentUserProfile();

  const { error, categoryName, lots, totalLots, totalPages, totalSlabs } = await getCategoryLots({
    categoryId,
    warehouseId,
    statusId,
    sortBy,
    search,
    allowedWarehouseIds: profile?.warehouseIds ?? null,
    page,
  });

  return (
    <Suspense fallback={<CategoryLotGridLoading />}>
      <CategoryLotGrid
        error={error}
        categoryId={categoryId}
        categoryName={categoryName}
        lots={lots}
        totalLots={totalLots}
        totalPages={totalPages}
        totalSlabs={totalSlabs}
        sortBy={sortBy}
        canAddStock={profile?.permissions.add_stock ?? false}
      />
    </Suspense>
  );
}
