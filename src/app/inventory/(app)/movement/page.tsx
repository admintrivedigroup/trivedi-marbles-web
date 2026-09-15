import { StockMovement } from "@/app/inventory/_components/stock-movement";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { getRecentMovements } from "@/app/inventory/_lib/movement";
import { getIncomingTransfers, getOutgoingTransfers } from "@/app/inventory/_lib/transfers";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ histFrom?: string; histTo?: string }>;
}) {
  const { histFrom, histTo } = await searchParams;
  const profile = await getCurrentUserProfile();
  const warehouseIds = profile?.warehouseIds ?? null;

  const [{ slabs }, recentMovements, incomingTransfers, outgoingTransfers] = await Promise.all([
    getInventorySlabs({
      warehouseId: "",
      statusId: "",
      sortBy: "newest",
      allowedWarehouseIds: warehouseIds,
    }),
    getRecentMovements({ dateFrom: histFrom, dateTo: histTo }),
    getIncomingTransfers(warehouseIds),
    getOutgoingTransfers(warehouseIds),
  ]);

  // Exclude a whole lot from "Available Lots" once any of its slabs are in an
  // active outgoing transfer, so the lot can't be picked again until that
  // transfer is received or cancelled.
  const inTransitSlabIds = new Set(
    outgoingTransfers.flatMap((t) => t.slabs.map((s) => s.slabId)),
  );
  const inTransitLotIds = new Set(
    slabs.filter((s) => inTransitSlabIds.has(s.id) && s.lotId).map((s) => s.lotId as string),
  );
  const availableSlabs = slabs.filter(
    (s) => !inTransitSlabIds.has(s.id) && !(s.lotId && inTransitLotIds.has(s.lotId)),
  );

  return (
    <StockMovement
      slabs={availableSlabs}
      recentMovements={recentMovements}
      incomingTransfers={incomingTransfers}
      outgoingTransfers={outgoingTransfers}
      historyDateFrom={histFrom}
      historyDateTo={histTo}
    />
  );
}
