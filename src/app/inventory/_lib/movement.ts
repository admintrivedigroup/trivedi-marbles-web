import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type RecentMovement = {
  id: string;
  slabCode: string | null;
  marbleName: string | null;
  eventType: string;
  fromLocation: string | null;
  toLocation: string | null;
  notes: string | null;
  createdAt: string;
};

type MovementRow = {
  id: string;
  event_type: string;
  from_location: string | null;
  to_location: string | null;
  notes: string | null;
  created_at: string;
  slabs: { slab_code: string | null; marble_lots: { marble_name: string | null } | null } | null;
};

type GetMovementsOptions = {
  dateFrom?: string;
  dateTo?: string;
};

// Unfiltered dashboard view: just the latest activity snapshot.
const RECENT_MOVEMENTS_DEFAULT_LIMIT = 50;
// Date-filtered view: user is actively investigating a range, return more.
const RECENT_MOVEMENTS_FILTERED_LIMIT = 500;

export async function getRecentMovements(options: GetMovementsOptions = {}): Promise<RecentMovement[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("slab_movements")
    .select("id, event_type, from_location, to_location, notes, created_at, slabs(slab_code, marble_lots(marble_name))")
    .order("created_at", { ascending: false });

  if (options.dateFrom) {
    query = query.gte("created_at", `${options.dateFrom}T00:00:00`);
  }
  if (options.dateTo) {
    query = query.lte("created_at", `${options.dateTo}T23:59:59.999`);
  }

  const isFiltered = Boolean(options.dateFrom || options.dateTo);
  const { data, error } = await query.limit(
    isFiltered ? RECENT_MOVEMENTS_FILTERED_LIMIT : RECENT_MOVEMENTS_DEFAULT_LIMIT,
  );

  if (error) console.error("getRecentMovements error:", error.message);

  return ((data ?? []) as unknown as MovementRow[]).map((row) => ({
    id: row.id,
    slabCode: row.slabs?.slab_code ?? null,
    marbleName: row.slabs?.marble_lots?.marble_name ?? null,
    eventType: row.event_type,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
