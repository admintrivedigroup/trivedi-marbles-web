"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type ProfileUpdateResult = {
  error: string | null;
};

// Self-service counterpart to user-management.ts's admin actions: only ever
// touches the caller's own row (user_id from the session, not from form
// input) and only the display_name/avatar_url columns — role and
// permissions stay admin-only via requireManageUsers().
export async function updateOwnProfile(formData: FormData): Promise<ProfileUpdateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in to update your profile." };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  if (displayName.length > 120) {
    return { error: "Display name must be 120 characters or fewer." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  logAudit({
    userId: user.id,
    userEmail: user.email ?? null,
    action: "user.profile_updated",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email ?? user.id,
  }).catch(() => {});

  revalidatePath("/inventory/settings");
  return { error: null };
}
