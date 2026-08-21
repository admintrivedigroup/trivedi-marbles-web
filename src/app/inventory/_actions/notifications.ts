"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResult = {
  items: NotificationItem[];
  unreadCount: number;
};

export async function getMyNotifications(limit = 20): Promise<NotificationsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], unreadCount: 0 };

  const [{ data: items }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return {
    items: (items ?? []).map((row) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: unreadCount ?? 0,
  };
}

export type NotificationActionResult = {
  error: string | null;
};

// Mirrors updateOwnProfile: writes go through the admin client but are
// scoped to the caller's own user_id from the session, never from input.
export async function markNotificationRead(id: string): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/inventory", "layout");
  return { error: null };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/inventory", "layout");
  return { error: null };
}

export async function updateNotificationPreference(
  lowStockAlertsEnabled: boolean,
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ low_stock_alerts_enabled: lowStockAlertsEnabled })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/inventory/settings");
  return { error: null };
}

export async function updateLowStockThreshold(value: number): Promise<NotificationActionResult> {
  const profile = await getCurrentUserProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return { error: "You do not have permission to change this." };
  }

  if (!Number.isInteger(value) || value < 0) {
    return { error: "Threshold must be a whole number, 0 or greater." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("inventory_settings")
    .update({ low_stock_threshold: value, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/inventory/settings");
  return { error: null };
}
