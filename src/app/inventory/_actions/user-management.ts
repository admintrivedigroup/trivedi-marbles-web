"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { isValidRole, ALL_PERMISSIONS, type Permission, type Role } from "@/app/inventory/_lib/permissions";
import { logAudit } from "@/app/inventory/_lib/audit";

async function getActingUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { id: user?.id ?? null, email: user?.email ?? null };
  } catch {
    return { id: null, email: null };
  }
}

export type UserManagementResult = {
  error: string | null;
};

async function requireManageUsers(): Promise<{ error: string } | null> {
  const profile = await getCurrentUserProfile();
  if (!profile?.permissions.manage_users) {
    return { error: "You do not have permission to manage users." };
  }
  return null;
}

export async function inviteUser(formData: FormData): Promise<UserManagementResult> {
  const authError = await requireManageUsers();
  if (authError) return authError;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const warehouseIds = formData.getAll("warehouseIds").map(String).filter(Boolean);

  if (!email) return { error: "Email is required." };
  if (!isValidRole(role)) return { error: "Invalid role selected." };

  const admin = createAdminClient();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName || null },
    redirectTo: `${siteUrl}/inventory/auth/callback?type=invite`,
  });

  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Failed to invite user." };
  }

  const userId = invited.user.id;

  const { error: profileError } = await admin
    .from("user_profiles")
    .insert({ user_id: userId, role, display_name: displayName || null });

  if (profileError) {
    return { error: `User invited but profile creation failed. ${profileError.message}` };
  }

  if (warehouseIds.length > 0) {
    const rows = warehouseIds.map((wId) => ({ user_id: userId, warehouse_id: wId }));
    await admin.from("user_warehouse_access").insert(rows);
  }

  const actor = await getActingUser();
  logAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "user.invited",
    targetType: "user",
    targetId: userId,
    targetLabel: email,
    diff: { role },
  }).catch(() => {});

  revalidatePath("/inventory/users");
  return { error: null };
}

export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<UserManagementResult> {
  const authError = await requireManageUsers();
  if (authError) return authError;

  if (!isValidRole(role)) return { error: "Invalid role." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("user_profiles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) return { error: `Failed to update role. ${error.message}` };

  await admin
    .from("user_permissions")
    .delete()
    .eq("user_id", userId);

  const actor = await getActingUser();
  logAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    targetLabel: userId,
    diff: { role },
  }).catch(() => {});

  revalidatePath("/inventory/users");
  return { error: null };
}

export async function updateUserPermission(
  userId: string,
  permission: Permission,
  enabled: boolean,
): Promise<UserManagementResult> {
  const authError = await requireManageUsers();
  if (authError) return authError;

  if (!ALL_PERMISSIONS.includes(permission)) return { error: "Invalid permission." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("user_permissions")
    .upsert({ user_id: userId, permission, enabled }, { onConflict: "user_id,permission" });

  if (error) return { error: `Failed to update permission. ${error.message}` };

  const actor = await getActingUser();
  logAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "user.permission_changed",
    targetType: "user",
    targetId: userId,
    targetLabel: userId,
    diff: { permission, enabled },
  }).catch(() => {});

  revalidatePath("/inventory/users");
  return { error: null };
}

export async function updateUserWarehouseAccess(
  userId: string,
  warehouseIds: string[],
): Promise<UserManagementResult> {
  const authError = await requireManageUsers();
  if (authError) return authError;

  const admin = createAdminClient();

  await admin.from("user_warehouse_access").delete().eq("user_id", userId);

  if (warehouseIds.length > 0) {
    const rows = warehouseIds.map((wId) => ({ user_id: userId, warehouse_id: wId }));
    const { error } = await admin.from("user_warehouse_access").insert(rows);
    if (error) return { error: `Failed to update warehouse access. ${error.message}` };
  }

  revalidatePath("/inventory/users");
  return { error: null };
}

export async function removeUser(userId: string): Promise<UserManagementResult> {
  const authError = await requireManageUsers();
  if (authError) return authError;

  const currentProfile = await getCurrentUserProfile();
  if (currentProfile?.userId === userId) {
    return { error: "You cannot remove your own account." };
  }

  const admin = createAdminClient();

  await admin.from("transfer_requests").update({ created_by: null }).eq("created_by", userId);
  await admin.from("user_warehouse_access").delete().eq("user_id", userId);
  await admin.from("user_permissions").delete().eq("user_id", userId);
  await admin.from("user_profiles").delete().eq("user_id", userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: `Failed to remove user. ${error.message}` };

  const actor = await getActingUser();
  logAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "user.removed",
    targetType: "user",
    targetId: userId,
    targetLabel: userId,
    diff: {},
  }).catch(() => {});

  revalidatePath("/inventory/users");
  return { error: null };
}
