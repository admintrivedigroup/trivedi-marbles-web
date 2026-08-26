import { Suspense } from "react";

import { InventoryCategories } from "@/app/inventory/_components/inventory-categories";
import { getCategoryOverview } from "@/app/inventory/_lib/category-overview";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

import InventoryListLoading from "./loading";

export default async function InventoryListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim() : "";

  const profile = await getCurrentUserProfile();

  const { error, categories, uncategorized, searchResults, totalLots, totalSlabs } = await getCategoryOverview(
    profile?.warehouseIds ?? null,
    search,
  );

  return (
    <Suspense fallback={<InventoryListLoading />}>
      <InventoryCategories
        error={error}
        categories={categories}
        uncategorized={uncategorized}
        searchResults={searchResults}
        totalLots={totalLots}
        totalSlabs={totalSlabs}
        canAddStock={profile?.permissions.add_stock ?? false}
      />
    </Suspense>
  );
}
