import { Suspense } from "react";

import { InventoryList } from "@/app/inventory/_components/inventory-list";
import { getInventorySlabs, type SortBy } from "@/app/inventory/_lib/inventory-list";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

import InventoryListLoading from "./loading";

const VALID_SORTS: SortBy[] = ["newest", "oldest", "name_asc", "name_desc", "sqft_desc", "sqft_asc"];

export default async function InventoryListPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string; status?: string; sort?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const warehouseId = typeof params.warehouse === "string" ? params.warehouse : "";
  const statusId = typeof params.status === "string" ? params.status : "";
  const sortBy: SortBy = VALID_SORTS.includes(params.sort as SortBy) ? (params.sort as SortBy) : "newest";
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const rawPage = Number(params.page ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const profile = await getCurrentUserProfile();

  const [{ error, slabs, totalLots, totalPages, totalSlabs }, inTransitSlabIds] = await Promise.all([
    getInventorySlabs({
      warehouseId,
      statusId,
      sortBy,
      search,
      allowedWarehouseIds: profile?.warehouseIds ?? null,
      page,
    }),
    getInTransitSlabIds(),
  ]);

  return (
    <Suspense fallback={<InventoryListLoading />}>
      <InventoryList
        error={error}
        slabs={slabs}
        inTransitSlabIds={inTransitSlabIds}
        canViewCostPrice={profile?.permissions.view_cost_price ?? false}
        canAddStock={profile?.permissions.add_stock ?? false}
        sortBy={sortBy}
        totalLots={totalLots}
        totalPages={totalPages}
        totalSlabs={totalSlabs}
      />
    </Suspense>
  );
}
