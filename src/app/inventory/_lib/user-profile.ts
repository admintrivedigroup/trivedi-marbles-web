import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolvePermissions,
  isValidRole,
  type Role,
  type ResolvedPermissions,
} from "@/app/inventory/_lib/permissions";

export type UserProfile = {
  userId: string;
  role: Role;
  displayName: string | null;
  permissions: ResolvedPermissions;
  warehouseIds: string[] | null;
};

export type ManagedUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
  permissions: ResolvedPermissions;
  warehouseIds: string[] | null;
  createdAt: string;
};

export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, permissionsRes, warehouseRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("role, display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_permissions")
      .select("permission, enabled")
      .eq("user_id", user.id),
    supabase
      .from("user_warehouse_access")
      .select("warehouse_id")
      .eq("user_id", user.id),
  ]);

  // Profile row may not exist for manually created Supabase users — default to staff
  const role = isValidRole(profileRes.data?.role) ? profileRes.data!.role : "staff";
  const overrides = permissionsRes.data ?? [];
  const warehouseRows = warehouseRes.data ?? [];

  return {
    userId: user.id,
    role,
    displayName: profileRes.data?.display_name ?? null,
    permissions: resolvePermissions(role, overrides),
    warehouseIds: warehouseRows.length > 0
      ? warehouseRows.map((r) => String(r.warehouse_id))
      : null,
  };
});

export async function getAllManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();

  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
  if (authError || !authUsers) return [];

  const userIds = authUsers.users.map((u) => u.id);

  const [profilesRes, permissionsRes, warehouseRes] = await Promise.all([
    admin
      .from("user_profiles")
      .select("user_id, role, display_name, created_at")
      .in("user_id", userIds),
    admin
      .from("user_permissions")
      .select("user_id, permission, enabled")
      .in("user_id", userIds),
    admin
      .from("user_warehouse_access")
      .select("user_id, warehouse_id")
      .in("user_id", userIds),
  ]);

  const profiles = profilesRes.data ?? [];
  const allPermissions = permissionsRes.data ?? [];
  const allWarehouseAccess = warehouseRes.data ?? [];

  return authUsers.users
    .map((u) => {
      const profile = profiles.find((p) => p.user_id === u.id) ?? null;
      const role = isValidRole(profile?.role) ? profile!.role : "staff";
      const overrides = allPermissions.filter((p) => p.user_id === u.id);
      const warehouseRows = allWarehouseAccess.filter((w) => w.user_id === u.id);

      return {
        userId: u.id,
        email: u.email ?? "",
        displayName: profile?.display_name ?? null,
        role,
        permissions: resolvePermissions(role, overrides),
        warehouseIds: warehouseRows.length > 0
          ? warehouseRows.map((r) => String(r.warehouse_id))
          : null,
        createdAt: profile?.created_at ?? u.created_at ?? "",
      };
    });
}
