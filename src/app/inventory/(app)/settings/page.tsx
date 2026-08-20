import { InventorySettings } from "@/app/inventory/_components/inventory-settings";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export default async function SettingsPage() {
  const profile = await getCurrentUserProfile();
  return <InventorySettings profile={profile} />;
}
