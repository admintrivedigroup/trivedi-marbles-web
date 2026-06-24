import { InventoryDashboard } from "@/app/inventory/_components/inventory-dashboard";
import { getDashboardStats } from "@/app/inventory/_lib/dashboard";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export default async function InventoryDashboardPage() {
  const profile = await getCurrentUserProfile();
  const stats = await getDashboardStats(profile?.warehouseIds ?? null, profile?.role ?? "staff", profile?.userId);

  return (
    <InventoryDashboard
      stats={stats}
      profile={profile}
    />
  );
}
