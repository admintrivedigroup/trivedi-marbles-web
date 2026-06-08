import { redirect } from "next/navigation";

import { UserManagement } from "@/app/inventory/_components/user-management";
import { getCurrentUserProfile, getAllManagedUsers } from "@/app/inventory/_lib/user-profile";
import { getLookupOptions } from "@/app/inventory/_lib/lookup-options";

export default async function UsersPage() {
  const profile = await getCurrentUserProfile();

  if (!profile?.permissions.manage_users) {
    redirect("/inventory/dashboard");
  }

  const [users, options] = await Promise.all([
    getAllManagedUsers(),
    getLookupOptions(),
  ]);

  return (
    <UserManagement
      users={users}
      warehouses={options.warehouses}
      currentUserId={profile.userId}
      currentRole={profile.role}
    />
  );
}
