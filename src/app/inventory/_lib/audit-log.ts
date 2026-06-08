import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogResult = {
  entries: AuditLogEntry[];
  total: number;
  error: string | null;
};

const PAGE_SIZE = 50;

type GetAuditLogsOptions = {
  dateFrom?: string;
  dateTo?: string;
};

export async function getAuditLogs(page = 0, options: GetAuditLogsOptions = {}): Promise<AuditLogResult> {
  try {
    const supabase = await createClient();
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("audit_logs")
      .select("id, user_id, user_email, action, target_type, target_id, target_label, diff, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (options.dateFrom) {
      query = query.gte("created_at", `${options.dateFrom}T00:00:00`);
    }
    if (options.dateTo) {
      query = query.lte("created_at", `${options.dateTo}T23:59:59.999`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return { entries: [], total: 0, error: `Unable to load audit log. ${error.message}` };
    }

    const entries: AuditLogEntry[] = (data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      userId: row.user_id ? String(row.user_id) : null,
      userEmail: row.user_email ? String(row.user_email) : null,
      action: String(row.action ?? ""),
      targetType: row.target_type ? String(row.target_type) : null,
      targetId: row.target_id ? String(row.target_id) : null,
      targetLabel: row.target_label ? String(row.target_label) : null,
      diff: row.diff && typeof row.diff === "object" ? (row.diff as Record<string, unknown>) : null,
      createdAt: String(row.created_at ?? ""),
    }));

    return { entries, total: count ?? 0, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { entries: [], total: 0, error: `Unable to load audit log. ${message}` };
  }
}
