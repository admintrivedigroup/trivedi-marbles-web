import { InventorySettings } from "@/app/inventory/_components/inventory-settings";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { getInventorySettings } from "@/app/inventory/_lib/low-stock";

export default async function SettingsPage() {
  const [profile, inventorySettings] = await Promise.all([
    getCurrentUserProfile(),
    getInventorySettings(),
  ]);

  return (
    <InventorySettings
      profile={profile}
      lowStockThreshold={inventorySettings.lowStockThreshold}
    />
  );
}
