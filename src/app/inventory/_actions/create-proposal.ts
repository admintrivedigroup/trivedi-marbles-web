"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { logAudit } from "@/app/inventory/_lib/audit";

export type ProposalSlabInput = {
  slabCode: string;
  length: number | null;
  width: number | null;
  sqft: number;
  photoUrl: string | null;
};

export type ProposalItemInput = {
  marbleName: string;
  lotNumber: string;
  sqft: number;
  quantityNote: "" | "Plus" | "Same";
  finish: string;
  origin: string;
  slabs: ProposalSlabInput[];
};

export type CreateProposalParams = {
  clientName: string;
  items: ProposalItemInput[];
};

export type CreateProposalResult =
  | { ok: true; referenceNo: string; date: string }
  | { ok: false; error: string };

// Reference number prefix and the PDF's title/description are fixed rather
// than user-editable — this is a lightweight in-context action off the lot
// picker, not a builder form.
const PROPOSAL_PREFIX = "AMB";

export async function createProposal(
  params: CreateProposalParams,
): Promise<CreateProposalResult> {
  const auth = await requirePermission("quotations");
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!params.clientName.trim()) {
    return { ok: false, error: "Client name is required." };
  }
  if (params.items.length === 0) {
    return { ok: false, error: "Select at least one lot for the proposal." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .insert({
      prefix: PROPOSAL_PREFIX,
      client_name: params.clientName.trim(),
      items: params.items,
      created_by: auth.profile.userId,
      created_by_email: auth.profile.email,
    })
    .select("reference_no, proposal_date")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save proposal." };
  }

  logAudit({
    userId: auth.profile.userId,
    userEmail: auth.profile.email,
    action: "proposal.created",
    targetType: "proposal",
    targetId: data.reference_no,
    targetLabel: data.reference_no,
    diff: {
      clientName: params.clientName.trim(),
      lotCount: params.items.length,
      totalSqft: params.items.reduce((sum, i) => sum + i.sqft, 0),
    },
  }).catch(() => {});

  return { ok: true, referenceNo: data.reference_no, date: data.proposal_date };
}
