import "server-only";

import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

export type DashboardStats = {
  totalSlabs: number;
  totalSqft: number;
  warehouseCounts: { name: string; count: number }[];
  reservedCount: number;
  stockValueBySelling: number;
  stockValueByCost: number;
  stockValueByDealer: number;
  typeData: { name: string; count: number }[];
  recentActivity: { id: string; text: string; time: string }[];
  alerts: { id: string; severity: "low" | "medium"; text: string }[];
};

export async function getDashboardStats(
  allowedWarehouseIds: string[] | null = null,
): Promise<DashboardStats> {
  const { slabs } = await getInventorySlabs({ warehouseId: "", statusId: "", allowedWarehouseIds });

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

  const reservedCount = slabs.filter((s) => s.statusName === SLAB_STATUS.RESERVED).length;

  const activeSlabs = slabs.filter((s) => s.statusName !== SLAB_STATUS.SOLD);
  const stockValueBySelling = activeSlabs.reduce(
    (sum, s) => sum + (s.sellingPrice ?? 0) * (s.sqft ?? 0),
    0,
  );
  const stockValueByCost = activeSlabs.reduce(
    (sum, s) => sum + (s.costPrice ?? 0) * (s.sqft ?? 0),
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
  if (reservedCount > 0) {
    alerts.push({
      id: "reserved",
      severity: "medium",
      text: `${reservedCount} slab${reservedCount === 1 ? "" : "s"} currently reserved — confirm or release them.`,
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
    stockValueBySelling,
    stockValueByCost,
    stockValueByDealer,
    typeData,
    recentActivity,
    alerts,
  };
}
