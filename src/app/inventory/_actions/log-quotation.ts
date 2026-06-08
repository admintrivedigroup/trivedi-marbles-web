"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type LogQuotationParams = {
  action: "quotation.pdf_downloaded" | "quotation.whatsapp_shared";
  quotationNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  slabCount: number;
  totalSqft: number;
  grandTotal: number;
  slabIds: string[];
};

export async function logQuotation(params: LogQuotationParams): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  logAudit({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action: params.action,
    targetType: "quotation",
    targetId: params.quotationNumber,
    targetLabel: params.quotationNumber,
    diff: {
      customerName: params.customerName || null,
      customerPhone: params.customerPhone || null,
      slabCount: params.slabCount,
      totalSqft: params.totalSqft,
      grandTotal: params.grandTotal,
      slabIds: params.slabIds,
    },
  }).catch(() => {});
}
