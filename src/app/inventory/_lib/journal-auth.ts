import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

/**
 * Journal management is scoped to admin/superadmin, matching the nav's
 * existing `roles: ["admin", "superadmin"]` gate on the Journal link (same
 * scoping as the sibling Archive/Audit Log features). Unlike the nav (which
 * only hides the link), this is enforced server-side — pages redirect and
 * every mutating server action throws — so the restriction can't be
 * bypassed by navigating directly to a URL or calling an action manually.
 */
export async function requireJournalManager() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/inventory/login");
  }
  if (profile.role !== "admin" && profile.role !== "superadmin") {
    redirect("/inventory/dashboard");
  }

  return profile;
}

/** Non-redirecting variant for use inside server actions, where a thrown
 * error is surfaced as an action-result error instead of a navigation. */
export async function assertJournalManager() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    throw new Error("You do not have permission to manage the journal.");
  }

  return profile;
}
