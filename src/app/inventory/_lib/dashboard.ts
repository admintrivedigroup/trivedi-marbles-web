import "server-only";

import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";
import { getIncomingTransfers } from "@/app/inventory/_lib/transfers";
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/app/inventory/_lib/permissions";

export type DashboardStats = {
  totalLots: number;
  totalSlabs: number;
  totalSqft: number;
  warehouseCounts: { name: string; count: number }[];
  reservedCount: number;
  expiredReservationCount: number;
  expiringSoonCount: number;
  stockValueBySelling: number;
  stockValueByDealer: number;
  typeData: { name: string; count: number }[];
  recentActivity: { id: string; text: string; time: string }[];
  alerts: { id: string; severity: "low" | "medium" | "high"; text: string }[];
  incomingTransfersCount: number;
  expiringTodaySlabs: { id: string; slabCode: string | null; marbleName: string | null; reservedFor: string | null; reservedUntil: string }[];
  taskSummary: { total: number; inProgress: number; pendingApproval: number; overdue: number };

  // Admin + Superadmin
  totalLeads?: number;
  convertedLeads?: number;
  newLeadsThisWeek?: number;
  pendingTransfersCount?: number;
  staffActivityToday?: { email: string; actionCount: number }[];

  // Superadmin only
  soldLotsCount?: number;
  soldSqft?: number;
  dataQualityIssues?: number;
  inventoryAgeBuckets?: { label: string; count: number }[];
  recentAuditActivity?: { id: string; userEmail: string | null; action: string; targetLabel: string | null; time: string }[];
};

export async function getDashboardStats(
  allowedWarehouseIds: string[] | null = null,
  role: Role = "staff",
  currentUserId?: string,
): Promise<DashboardStats> {
  const { slabs } = await getInventorySlabs({ warehouseId: "", statusId: "", sortBy: "newest", allowedWarehouseIds });

  const totalSlabs = slabs.length;
  const totalLots = new Set(slabs.map((s) => s.lotId).filter(Boolean)).size;
  const totalSqft = slabs.reduce((sum, slab) => sum + (slab.sqft ?? 0), 0);

  const warehouseLotMap = new Map<string, Set<string>>();
  for (const slab of slabs) {
    if (slab.warehouseName && slab.lotId) {
      if (!warehouseLotMap.has(slab.warehouseName)) {
        warehouseLotMap.set(slab.warehouseName, new Set());
      }
      warehouseLotMap.get(slab.warehouseName)!.add(slab.lotId);
    }
  }
  const warehouseCounts = Array.from(warehouseLotMap.entries())
    .map(([name, lotSet]) => ({ name, count: lotSet.size }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const reservedSlabs = slabs.filter((s) => s.statusName === SLAB_STATUS.RESERVED);
  const reservedCount = reservedSlabs.length;

  const expiredReservationCount = reservedSlabs.filter((s) => {
    if (!s.reservedUntil) return false;
    return new Date(s.reservedUntil) < now;
  }).length;

  const expiringSoonCount = reservedSlabs.filter((s) => {
    if (!s.reservedUntil) return false;
    const d = new Date(s.reservedUntil);
    return d >= now && d <= threeDaysFromNow;
  }).length;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const expiringTodaySlabs = reservedSlabs
    .filter((s) => {
      if (!s.reservedUntil) return false;
      const d = new Date(s.reservedUntil);
      return d >= startOfToday && d <= endOfToday;
    })
    .map((s) => ({
      id: s.id,
      slabCode: s.slabCode,
      marbleName: s.marbleName,
      reservedFor: s.reservedFor ?? null,
      reservedUntil: s.reservedUntil!,
    }));

  const supabase = await createClient();

  const taskQueryBuilder = role === "staff" && currentUserId
    ? supabase.from("tasks").select("status, due_date").eq("assigned_to", currentUserId).neq("status", "completed").neq("status", "draft")
    : supabase.from("tasks").select("status, due_date").neq("status", "completed").neq("status", "draft");

  const [incomingTransfers, taskRes] = await Promise.all([
    getIncomingTransfers(allowedWarehouseIds),
    taskQueryBuilder,
  ]);
  const incomingTransfersCount = incomingTransfers.length;
  const taskRows = (taskRes.data ?? []) as { status: string; due_date: string | null }[];

  const activeSlabs = slabs.filter((s) => s.statusName !== SLAB_STATUS.SOLD);
  const stockValueBySelling = activeSlabs.reduce(
    (sum, s) => sum + (s.sellingPrice ?? 0) * (s.sqft ?? 0),
    0,
  );
  const stockValueByDealer = activeSlabs.reduce(
    (sum, s) => sum + (s.dealerPrice ?? 0) * (s.sqft ?? 0),
    0,
  );

  const typeMap = new Map<string, number>();
  for (const slab of slabs) {
    if (slab.statusName !== SLAB_STATUS.SOLD && slab.categoryName) {
      typeMap.set(slab.categoryName, (typeMap.get(slab.categoryName) ?? 0) + 1);
    }
  }
  const typeData = Array.from(typeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const recentActivity = [...slabs]
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5)
    .map((slab) => ({
      id: slab.id,
      text: `${slab.marbleName ?? "Slab"} (${slab.slabCode ?? "-"}) added to ${slab.warehouseName ?? "inventory"}`,
      time: slab.createdAt
        ? new Date(slab.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Unknown date",
    }));

  const alerts: DashboardStats["alerts"] = [];

  if (expiredReservationCount > 0) {
    alerts.push({
      id: "expired-reservations",
      severity: "high",
      text: `${expiredReservationCount} reservation${expiredReservationCount === 1 ? "" : "s"} expired — release or renew ${expiredReservationCount === 1 ? "it" : "them"} from the lot detail.`,
    });
  }

  if (expiringSoonCount > 0) {
    alerts.push({
      id: "expiring-soon",
      severity: "medium",
      text: `${expiringSoonCount} reservation${expiringSoonCount === 1 ? "" : "s"} expiring within 3 days.`,
    });
  }

  const activeReservedCount = reservedCount - expiredReservationCount - expiringSoonCount;
  if (activeReservedCount > 0) {
    alerts.push({
      id: "reserved",
      severity: "low",
      text: `${activeReservedCount} slab${activeReservedCount === 1 ? "" : "s"} reserved.`,
    });
  }

  // Lots where every slab is sold or reserved (none available)
  const lotSlabCount = new Map<string, number>();
  const lotAvailableCount = new Map<string, number>();
  for (const slab of slabs) {
    if (!slab.lotId) continue;
    lotSlabCount.set(slab.lotId, (lotSlabCount.get(slab.lotId) ?? 0) + 1);
    if (slab.statusName === SLAB_STATUS.AVAILABLE) {
      lotAvailableCount.set(slab.lotId, (lotAvailableCount.get(slab.lotId) ?? 0) + 1);
    }
  }
  const lotsWithNoAvailable = Array.from(lotSlabCount.keys()).filter(
    (lotId) => (lotAvailableCount.get(lotId) ?? 0) === 0,
  ).length;
  if (lotsWithNoAvailable > 0) {
    alerts.push({
      id: "lots-no-available",
      severity: "medium",
      text: `${lotsWithNoAvailable} lot${lotsWithNoAvailable === 1 ? "" : "s"} with no available slabs — all sold or reserved.`,
    });
  }

  if (totalSlabs === 0) {
    alerts.push({
      id: "empty",
      severity: "low",
      text: "No inventory yet. Add your first slab to get started.",
    });
  }

  const base: DashboardStats = {
    totalLots,
    totalSlabs,
    totalSqft,
    warehouseCounts,
    reservedCount,
    expiredReservationCount,
    expiringSoonCount,
    stockValueBySelling,
    stockValueByDealer,
    typeData,
    recentActivity,
    alerts,
    incomingTransfersCount,
    expiringTodaySlabs,
    taskSummary: {
      total: taskRows.length,
      inProgress: taskRows.filter((t) => t.status === "in_progress").length,
      pendingApproval: taskRows.filter((t) => t.status === "pending_approval").length,
      overdue: taskRows.filter((t) => !!t.due_date && new Date(t.due_date) < now).length,
    },
  };

  if (role === "admin" || role === "superadmin") {
    const adminClient = createAdminClient();

    const [leadsRes, pendingTransfersRes, todayAuditRes] = await Promise.all([
      supabase.from("client_leads").select("id, converted, created_at"),
      supabase.from("transfer_requests").select("id").eq("status", "in_transit"),
      adminClient
        .from("audit_logs")
        .select("user_email")
        .gte("created_at", startOfToday.toISOString()),
    ]);

    const leads = (leadsRes.data ?? []) as { id: string; converted: boolean; created_at: string }[];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    base.totalLeads = leads.length;
    base.convertedLeads = leads.filter((l) => l.converted).length;
    base.newLeadsThisWeek = leads.filter((l) => new Date(l.created_at) >= weekAgo).length;
    base.pendingTransfersCount = pendingTransfersRes.data?.length ?? 0;

    const activityMap = new Map<string, number>();
    for (const row of (todayAuditRes.data ?? []) as { user_email: string | null }[]) {
      const key = row.user_email ?? "Unknown";
      activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
    }
    base.staffActivityToday = Array.from(activityMap.entries())
      .map(([email, actionCount]) => ({ email, actionCount }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 5);
  }

  if (role === "superadmin") {
    const adminClient = createAdminClient();

    // Sold stats from existing slab data
    const soldSlabs = slabs.filter((s) => s.statusName === SLAB_STATUS.SOLD);
    base.soldLotsCount = new Set(soldSlabs.map((s) => s.lotId).filter(Boolean)).size;
    base.soldSqft = Math.round(soldSlabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0));

    // Data quality: active slabs missing either price
    base.dataQualityIssues = activeSlabs.filter(
      (s) => s.sellingPrice === null || s.dealerPrice === null,
    ).length;

    // Inventory age buckets on active slabs
    const ageBuckets = [0, 0, 0, 0]; // 0-30, 31-60, 61-90, 90+
    for (const slab of activeSlabs) {
      if (!slab.createdAt) continue;
      const ageDays = Math.floor(
        (now.getTime() - new Date(slab.createdAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (ageDays <= 30) ageBuckets[0]++;
      else if (ageDays <= 60) ageBuckets[1]++;
      else if (ageDays <= 90) ageBuckets[2]++;
      else ageBuckets[3]++;
    }
    base.inventoryAgeBuckets = [
      { label: "0–30d", count: ageBuckets[0] },
      { label: "31–60d", count: ageBuckets[1] },
      { label: "61–90d", count: ageBuckets[2] },
      { label: "90d+", count: ageBuckets[3] },
    ];

    // Recent audit activity with user attribution
    const { data: auditData } = await adminClient
      .from("audit_logs")
      .select("id, user_email, action, target_label, created_at")
      .order("created_at", { ascending: false })
      .limit(6);

    base.recentAuditActivity = (
      (auditData ?? []) as {
        id: string;
        user_email: string | null;
        action: string;
        target_label: string | null;
        created_at: string;
      }[]
    ).map((e) => ({
      id: e.id,
      userEmail: e.user_email,
      action: e.action,
      targetLabel: e.target_label,
      time: new Date(e.created_at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  }

  return base;
}
