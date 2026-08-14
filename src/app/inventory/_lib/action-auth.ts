import "server-only";

import { getCurrentUserProfile, type UserProfile } from "@/app/inventory/_lib/user-profile";
import { PERMISSION_LABELS, type Permission } from "@/app/inventory/_lib/permissions";

export type ActionAuthResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; error: string };

export async function requireUser(): Promise<ActionAuthResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  return { ok: true, profile };
}

export async function requireAdmin(): Promise<ActionAuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (auth.profile.role !== "admin" && auth.profile.role !== "superadmin") {
    return { ok: false, error: "Not authorized" };
  }
  return auth;
}

// Server-side counterpart to the permission toggles rendered in the UI —
// those only hide buttons, so every mutating action must call this itself
// rather than trusting that a hidden button means the request can't happen.
export async function requirePermission(permission: Permission): Promise<ActionAuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.profile.permissions[permission]) {
    return {
      ok: false,
      error: `You do not have permission to ${PERMISSION_LABELS[permission].toLowerCase()}.`,
    };
  }
  return auth;
}
