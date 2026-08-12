import "server-only";

import { getCurrentUserProfile, type UserProfile } from "@/app/inventory/_lib/user-profile";

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
