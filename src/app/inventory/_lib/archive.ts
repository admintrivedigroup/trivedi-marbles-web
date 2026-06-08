import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ArchivedSlab = {
  id: string;
  slabCode: string | null;
  marbleName: string | null;
  lotNumber: string | null;
  lotId: string | null;
  sqft: number | null;
  deletedAt: string;
};

export type ArchivedLot = {
  id: string;
  lotNumber: string | null;
  marbleName: string | null;
  slabCount: number;
  deletedAt: string;
};

export type ArchiveResult = {
  error: string | null;
  slabs: ArchivedSlab[];
  lots: ArchivedLot[];
};

export async function getArchivedItems(): Promise<ArchiveResult> {
  try {
    const supabase = await createClient();

    const [{ data: slabData, error: slabError }, { data: lotData, error: lotError }] =
      await Promise.all([
        supabase
          .from("slabs")
          .select("id, slab_code, marble_name, sqft, lot_id, deleted_at, marble_lots(lot_number)")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(500),
        supabase
          .from("marble_lots")
          .select("id, lot_number, marble_name, deleted_at")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(200),
      ]);

    if (slabError) return { error: slabError.message, slabs: [], lots: [] };
    if (lotError) return { error: lotError.message, slabs: [], lots: [] };

    const slabs: ArchivedSlab[] = (slabData ?? []).map((row) => {
      const rel = row.marble_lots as unknown;
      let lotNumber: string | null = null;
      if (Array.isArray(rel)) {
        lotNumber = (rel[0] as { lot_number?: string })?.lot_number ?? null;
      } else if (rel && typeof rel === "object") {
        lotNumber = (rel as { lot_number?: string }).lot_number ?? null;
      }
      return {
        id: String(row.id),
        slabCode: typeof row.slab_code === "string" ? row.slab_code : null,
        marbleName: typeof row.marble_name === "string" ? row.marble_name : null,
        lotNumber,
        lotId: row.lot_id != null ? String(row.lot_id) : null,
        sqft: typeof row.sqft === "number" ? row.sqft : null,
        deletedAt: String(row.deleted_at),
      };
    });

    // For each lot, count how many of its slabs are also archived
    const lotIds = (lotData ?? []).map((l) => String(l.id));
    let slabCountMap: Record<string, number> = {};
    if (lotIds.length > 0) {
      const { data: countData } = await supabase
        .from("slabs")
        .select("lot_id")
        .in("lot_id", lotIds)
        .not("deleted_at", "is", null);
      for (const row of countData ?? []) {
        const key = String(row.lot_id);
        slabCountMap[key] = (slabCountMap[key] ?? 0) + 1;
      }
    }

    const lots: ArchivedLot[] = (lotData ?? []).map((row) => ({
      id: String(row.id),
      lotNumber: typeof row.lot_number === "string" ? row.lot_number : null,
      marbleName: typeof row.marble_name === "string" ? row.marble_name : null,
      slabCount: slabCountMap[String(row.id)] ?? 0,
      deletedAt: String(row.deleted_at),
    }));

    return { error: null, slabs, lots };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: message, slabs: [], lots: [] };
  }
}
