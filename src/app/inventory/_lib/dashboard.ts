import "server-only";

import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

export type DashboardStats = {
  totalSlabs: number;
  totalSqft: number;
  warehouseCounts: { name: string; count: number }[];
  reservedCount: number;
  expiredReservationCount: number;
  expiringSoonCount: number;
  stockValueBySelling: number;
  stockValueByDealer: number;
  typeData: { name: string; count: number }[];
  recentActivity: { id: string; text: string; time: string }[];
  alerts: { id: string; severity: "low" | "medium" | "high"; text: string }[];
};

export async function getDashboardStats(
  allowedWarehouseIds: string[] | null = null,
): Promise<DashboardStats> {
  const { slabs } = await getInventorySlabs({ warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds });

  const totalSlabs = slabs.length;
  const totalSqft = slabs.reduce((sum, slab) => sum + (slab.sqft ?? 0), 0);

  const warehouseMap = new Map<string, number>();
  for (const slab of slabs) {
    if (slab.warehouseName) {
      warehouseMap.set(
        slab.warehouseName,
        (warehouseMap.get(slab.warehouseName) ?? 0) + 1,
      );
    }
  }
  const warehouseCounts = Array.from(warehouseMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const reservedSlabs = slabs.filter((s) => s.statusName === SLAB_STATUS.RESERVED);
  const reservedCount = reservedSlabs.length;

  const expiredReservationCount = reservedSlabs.filter((s) => {
    if (!s.reservedUntil) return false;
    return new Date(s.reservedUntil) < now;
  }).length;

  const expiringSoonCount = reservedSlabs.filter((s) => {
    if (!s.reservedUntil) return false;
    const d = new Date(s.reservedUntil);
    return d >= now && d <= threeDaysFromNow;
  }).length;

  const activeSlabs = slabs.filter((s) => s.statusName !== SLAB_STATUS.SOLD);
  const stockValueBySelling = activeSlabs.reduce(
    (sum, s) => sum + (s.sellingPrice ?? 0) * (s.sqft ?? 0),
    0,
  );
  const stockValueByDealer = activeSlabs.reduce(
    (sum, s) => sum + (s.dealerPrice ?? 0) * (s.sqft ?? 0),
    0,
  );

  const typeMap = new Map<string, number>();
  for (const slab of slabs) {
    if (slab.statusName !== SLAB_STATUS.SOLD && slab.categoryName) {
      typeMap.set(slab.categoryName, (typeMap.get(slab.categoryName) ?? 0) + 1);
    }
  }
  const typeData = Array.from(typeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const recentActivity = [...slabs]
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5)
    .map((slab) => ({
      id: slab.id,
      text: `${slab.marbleName ?? "Slab"} (${slab.slabCode ?? "-"}) added to ${slab.warehouseName ?? "inventory"}`,
      time: slab.createdAt
        ? new Date(slab.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Unknown date",
    }));

  const alerts: DashboardStats["alerts"] = [];

  if (expiredReservationCount > 0) {
    alerts.push({
      id: "expired-reservations",
      severity: "high",
      text: `${expiredReservationCount} reservation${expiredReservationCount === 1 ? "" : "s"} expired — release or renew ${expiredReservationCount === 1 ? "it" : "them"} from the lot detail.`,
    });
  }

  if (expiringSoonCount > 0) {
    alerts.push({
      id: "expiring-soon",
      severity: "medium",
      text: `${expiringSoonCount} reservation${expiringSoonCount === 1 ? "" : "s"} expiring within 3 days.`,
    });
  }

  const activeReservedCount = reservedCount - expiredReservationCount - expiringSoonCount;
  if (activeReservedCount > 0) {
    alerts.push({
      id: "reserved",
      severity: "low",
      text: `${activeReservedCount} slab${activeReservedCount === 1 ? "" : "s"} reserved.`,
    });
  }

  // Lots where every slab is sold or reserved (none available)
  const lotSlabCount = new Map<string, number>();
  const lotAvailableCount = new Map<string, number>();
  for (const slab of slabs) {
    if (!slab.lotId) continue;
    lotSlabCount.set(slab.lotId, (lotSlabCount.get(slab.lotId) ?? 0) + 1);
    if (slab.statusName === SLAB_STATUS.AVAILABLE) {
      lotAvailableCount.set(slab.lotId, (lotAvailableCount.get(slab.lotId) ?? 0) + 1);
    }
  }
  const lotsWithNoAvailable = Array.from(lotSlabCount.keys()).filter(
    (lotId) => (lotAvailableCount.get(lotId) ?? 0) === 0,
  ).length;
  if (lotsWithNoAvailable > 0) {
    alerts.push({
      id: "lots-no-available",
      severity: "medium",
      text: `${lotsWithNoAvailable} lot${lotsWithNoAvailable === 1 ? "" : "s"} with no available slabs — all sold or reserved.`,
    });
  }

  if (totalSlabs === 0) {
    alerts.push({
      id: "empty",
      severity: "low",
      text: "No inventory yet. Add your first slab to get started.",
    });
  }

  return {
    totalSlabs,
    totalSqft,
    warehouseCounts,
    reservedCount,
    expiredReservationCount,
    expiringSoonCount,
    stockValueBySelling,
    stockValueByDealer,
    typeData,
    recentActivity,
    alerts,
  };
}
