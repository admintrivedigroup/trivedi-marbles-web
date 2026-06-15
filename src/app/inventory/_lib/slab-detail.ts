import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { InventoryListSlab } from "./inventory-list";
import { toNum, toStr, relName, relLot } from "./normalize";

export type SlabDetailResult = {
  error: string | null;
  slab: InventoryListSlab | null;
};

export type SlabMovement = {
  id: string;
  eventType: string;
  fromLocation: string | null;
  toLocation: string | null;
  notes: string | null;
  createdAt: string;
};

export async function getSlabById(id: string): Promise<SlabDetailResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("slabs")
      .select(`
        id,
        slab_code,
        length,
        width,
        sqft,
        rack_number,
        cost_price,
        selling_price,
        dealer_price,
        notes,
        created_at,
        lot_id,
        reserved_for,
        reserved_until,
        warehouses(name),
        slab_statuses(name),
        marble_lots(lot_number, marble_name, marble_categories(name), thickness_options(name)),
        slab_images(image_url, sort_order)
      `)
      .eq("id", id)
      .single();

    if (error) {
      return { error: `Unable to load slab. ${error.message}`, slab: null };
    }

    if (!data) {
      return { error: null, slab: null };
    }

    const row = data as Record<string, unknown>;
    const slabId = row.id != null ? String(row.id) : null;

    if (!slabId) {
      return { error: null, slab: null };
    }

    const lotId = row.lot_id != null ? String(row.lot_id) : null;

    const images = Array.isArray(row.slab_images) ? row.slab_images as Array<{ image_url?: unknown; sort_order?: unknown }> : [];
    const thumbnailUrl =
      images
        .slice()
        .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
        .map((img) => (typeof img.image_url === "string" ? img.image_url : null))
        .find((url): url is string => url !== null) ?? null;

    const lot = relLot(row.marble_lots);
    return {
      error: null,
      slab: {
        id: slabId,
        slabCode: toStr(row.slab_code),
        marbleName: toStr(lot?.marble_name),
        length: toNum(row.length),
        width: toNum(row.width),
        sqft: toNum(row.sqft),
        rackNumber: toStr(row.rack_number),
        costPrice: toNum(row.cost_price),
        sellingPrice: toNum(row.selling_price),
        dealerPrice: toNum(row.dealer_price),
        notes: toStr(row.notes),
        createdAt: toStr(row.created_at),
        lotId,
        lotNumber: toStr(lot?.lot_number),
        thumbnailUrl,
        reservedFor: toStr(row.reserved_for),
        reservedUntil: toStr(row.reserved_until),
        categoryName: relName(lot?.marble_categories),
        warehouseName: relName(row.warehouses),
        statusName: relName(row.slab_statuses),
        thicknessName: relName(lot?.thickness_options),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: `Unable to load slab. ${message}`, slab: null };
  }
}

export type SlabImage = {
  id: string;
  imageUrl: string;
  publicId: string;
  sortOrder: number;
};

export async function getSlabImages(slabId: string): Promise<SlabImage[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("slab_images")
      .select("id, image_url, public_id, sort_order")
      .eq("slab_id", slabId)
      .order("sort_order", { ascending: true });

    if (error) return [];

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      imageUrl: String(row.image_url ?? ""),
      publicId: String(row.public_id ?? ""),
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    }));
  } catch {
    return [];
  }
}

export type ReservationHistoryEntry = {
  id: string;
  before: string | null;
  after: string | null;
  reservedFor: string | null;
  reservedUntil: string | null;
  userEmail: string | null;
  createdAt: string;
};

export async function getSlabReservationHistory(slabId: string): Promise<ReservationHistoryEntry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, diff, user_email, created_at")
      .eq("target_id", slabId)
      .eq("action", "slab.status_changed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return [];

    return (data ?? []).map((row: Record<string, unknown>) => {
      const diff = (row.diff && typeof row.diff === "object" ? row.diff : {}) as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        before: diff.before ? String(diff.before) : null,
        after: diff.after ? String(diff.after) : null,
        reservedFor: diff.reservedFor ? String(diff.reservedFor) : null,
        reservedUntil: diff.reservedUntil ? String(diff.reservedUntil) : null,
        userEmail: row.user_email ? String(row.user_email) : null,
        createdAt: String(row.created_at ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export async function getSlabMovements(slabId: string): Promise<SlabMovement[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("slab_movements")
      .select("id, event_type, from_location, to_location, notes, created_at")
      .eq("slab_id", slabId)
      .order("created_at", { ascending: false });

    if (error) return [];

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      eventType: String(row.event_type ?? "Movement"),
      fromLocation: row.from_location ? String(row.from_location) : null,
      toLocation: row.to_location ? String(row.to_location) : null,
      notes: row.notes ? String(row.notes) : null,
      createdAt: String(row.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}
