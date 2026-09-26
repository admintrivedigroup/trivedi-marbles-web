import type { UserProfile } from "@/app/inventory/_lib/user-profile";

/** Reports expose selling prices across the whole inventory, so they're limited to
 * admins rather than everyone who can view the dashboard. */
export function canViewReports(profile: UserProfile | null): profile is UserProfile {
  return !!profile && profile.role !== "staff" && profile.permissions.view_dashboard;
}
