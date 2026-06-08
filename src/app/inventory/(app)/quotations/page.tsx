import { InventoryQuotation } from "@/app/inventory/_components/inventory-quotation";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

type QuotationsPageProps = {
  searchParams: Promise<{ lotId?: string; slabId?: string }>;
};

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  const { lotId, slabId } = await searchParams;
  const profile = await getCurrentUserProfile();

  const [{ slabs }, inTransitSlabIds] = await Promise.all([
    getInventorySlabs({
      warehouseId: "",
      statusId: "",
      sortBy: "newest",
      allowedWarehouseIds: profile?.warehouseIds ?? null,
    }),
    getInTransitSlabIds(),
  ]);

  const availableSlabs = slabs.filter((s) => !inTransitSlabIds.has(s.id));

  return (
    <InventoryQuotation
      slabs={availableSlabs}
      initialLotId={lotId ?? null}
      initialSlabId={slabId ?? null}
    />
  );
}
