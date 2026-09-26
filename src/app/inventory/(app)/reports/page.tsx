import { InventoryReports } from "@/app/inventory/_components/inventory-reports";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { buildReportData } from "@/app/inventory/_lib/report-data";
import { canViewReports } from "@/app/inventory/_lib/report-access";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export default async function ReportsPage() {
  const profile = await getCurrentUserProfile();

  if (!canViewReports(profile)) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          You do not have permission to view reports.
        </div>
      </div>
    );
  }

  const { slabs, error, truncated } = await getInventorySlabs({
    warehouseId: "",
    statusId: "",
    sortBy: "newest",
    allowedWarehouseIds: profile.warehouseIds,
  });

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const generatedAt = new Date().toISOString();
  return <InventoryReports data={buildReportData(slabs)} truncated={truncated} generatedAt={generatedAt} />;
}
