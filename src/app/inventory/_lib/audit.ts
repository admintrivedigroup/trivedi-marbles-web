import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AuditTargetType = "slab" | "lot" | "user" | "transfer" | "quotation";

type AuditParams = {
  userId: string | null;
  userEmail: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
  diff?: Record<string, unknown>;
};

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      target_label: params.targetLabel,
      diff: params.diff ?? null,
    });
  } catch (err) {
    // Audit failures must never block the main operation.
    // Log in dev so failures don't disappear silently during development.
    if (process.env.NODE_ENV === "development") {
      console.error("[audit] logAudit failed:", err);
    }
  }
}
