"use server";

import { requirePermission } from "@/app/inventory/_lib/action-auth";
import { getInventorySlabs } from "@/app/inventory/_lib/inventory-list";

export type ProposalSlabDetail = {
  slabId: string;
  slabCode: string | null;
  length: number | null;
  width: number | null;
  sqft: number;
  photoUrl: string | null;
};

export type ProposalLotDetail = {
  lotId: string;
  lotNumber: string | null;
  marbleName: string | null;
  availableSqft: number;
  slabs: ProposalSlabDetail[];
};

export type GetProposalLotDetailsResult =
  | { ok: true; lots: ProposalLotDetail[] }
  | { ok: false; error: string };

/** Fresh, slab-level detail (photo + measurements) for the lots a proposal will cover. */
export async function getProposalLotDetails(
  lotIds: string[],
): Promise<GetProposalLotDetailsResult> {
  const auth = await requirePermission("quotations");
  if (!auth.ok) return { ok: false, error: auth.error };

  if (lotIds.length === 0) return { ok: true, lots: [] };

  const { slabs, error } = await getInventorySlabs({
    warehouseId: "",
    statusId: "",
    sortBy: "newest",
    allowedWarehouseIds: auth.profile.warehouseIds,
  });

  if (error) return { ok: false, error };

  const lotIdSet = new Set(lotIds);
  const byLot = new Map<string, ProposalLotDetail>();

  for (const slab of slabs) {
    if (!slab.lotId || !lotIdSet.has(slab.lotId) || slab.statusName !== "Available") continue;

    let lot = byLot.get(slab.lotId);
    if (!lot) {
      lot = {
        lotId: slab.lotId,
        lotNumber: slab.lotNumber,
        marbleName: slab.marbleName,
        availableSqft: 0,
        slabs: [],
      };
      byLot.set(slab.lotId, lot);
    }

    lot.availableSqft += slab.sqft ?? 0;
    lot.slabs.push({
      slabId: slab.id,
      slabCode: slab.slabCode,
      length: slab.length,
      width: slab.width,
      sqft: slab.sqft ?? 0,
      photoUrl: slab.thumbnailUrl,
    });
  }

  // Preserve the caller's selection order; drop lots that turned out to have no available slabs.
  const lots = lotIds
    .map((id) => byLot.get(id))
    .filter((lot): lot is ProposalLotDetail => lot !== undefined);

  return { ok: true, lots };
}
