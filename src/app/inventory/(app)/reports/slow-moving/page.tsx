import { SlowMovingStock } from "@/app/inventory/_components/slow-moving-stock";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { canViewReports } from "@/app/inventory/_lib/report-access";
import {
  AGE_MILESTONES,
  buildSlowMovingLots,
  buildWarehouseAgeing,
  isAgeMilestone,
} from "@/app/inventory/_lib/stock-ageing";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

type SlowMovingPageProps = {
  searchParams: Promise<{ min?: string }>;
};

export default async function SlowMovingPage({ searchParams }: SlowMovingPageProps) {
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

  const { min } = await searchParams;
  const requested = Number(min);
  const minDays = isAgeMilestone(requested) ? requested : AGE_MILESTONES[0];

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

  const now = new Date();
  return (
    <SlowMovingStock
      minDays={minDays}
      lots={buildSlowMovingLots(slabs, { minDays, now })}
      warehouseAgeing={buildWarehouseAgeing(slabs, now)}
      truncated={truncated}
      generatedAt={now.toISOString()}
    />
  );
}
