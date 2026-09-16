import { Suspense } from "react";

import { AdvancedSlabSearch } from "@/app/inventory/_components/advanced-slab-search";
import { searchSlabsBySize } from "@/app/inventory/_lib/advanced-search";
import { parseSizeQuery } from "@/app/inventory/_lib/size-query";
import { getLookupOptions } from "@/app/inventory/_lib/lookup-options";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

import AdvancedSlabSearchLoading from "./loading";

export default async function AdvancedSlabSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; size?: string; warehouse?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const sizeQuery = typeof sp.size === "string" ? sp.size.trim() : "";
  const warehouseId = typeof sp.warehouse === "string" ? sp.warehouse : "";
  const statusId = typeof sp.status === "string" ? sp.status : "";
  const parsedSize = sizeQuery ? parseSizeQuery(sizeQuery) : null;
  const isInvalidSize = sizeQuery.length > 0 && parsedSize === null;

  const [profile, lookupOptions] = await Promise.all([
    getCurrentUserProfile(),
    getLookupOptions(),
  ]);

  const searchResult = parsedSize
    ? await searchSlabsBySize({
        categoryId,
        length: parsedSize.length,
        width: parsedSize.width,
        warehouseId,
        statusId,
        allowedWarehouseIds: profile?.warehouseIds ?? null,
      })
    : null;

  return (
    <Suspense fallback={<AdvancedSlabSearchLoading />}>
      <AdvancedSlabSearch
        categories={lookupOptions.categories}
        warehouses={lookupOptions.warehouses}
        statuses={lookupOptions.statuses}
        categoryId={categoryId}
        sizeQuery={sizeQuery}
        warehouseId={warehouseId}
        statusId={statusId}
        isInvalidSize={isInvalidSize}
        error={searchResult?.error ?? null}
        results={searchResult?.results ?? null}
        totalMatches={searchResult?.totalMatches ?? 0}
      />
    </Suspense>
  );
}
