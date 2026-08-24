import { InventoryDashboard } from "@/app/inventory/_components/inventory-dashboard";
import { getDashboardStats } from "@/app/inventory/_lib/dashboard";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { resolveDashboardDateRange } from "@/app/inventory/_lib/dashboard-date-range";

type PageProps = {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
};

export default async function InventoryDashboardPage({ searchParams }: PageProps) {
  const { preset, from, to } = await searchParams;
  const profile = await getCurrentUserProfile();
  const dateRange = resolveDashboardDateRange(preset, from, to);
  const stats = await getDashboardStats(
    profile?.warehouseIds ?? null,
    profile?.role ?? "staff",
    profile?.userId,
    dateRange,
  );

  return (
    <InventoryDashboard
      stats={stats}
      profile={profile}
      dateFilter={{ preset: preset ?? null, from: from ?? null, to: to ?? null }}
    />
  );
}
