import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { InventoryListSlab } from "./inventory-list";
import { toNum, toStr, relName, relLotNumber } from "./normalize";

export type LotInfo = {
  id: string;
  lotNumber: string | null;
  marbleName: string | null;
  categoryName: string | null;
  thicknessName: string | null;
  warehouseName: string | null;
  supplierName: string | null;
  purchaseDate: string | null;
  invoiceNumber: string | null;
  costPrice: number | null;
  sellingPrice: number | null;
  dealerPrice: number | null;
  notes: string | null;
  createdAt: string | null;
  showOnWebsite: boolean;
};

export type LotDetailResult = {
  error: string | null;
  lot: LotInfo | null;
  slabs: InventoryListSlab[];
};

export async function getLotDetail(lotId: string): Promise<LotDetailResult> {
  try {
    const supabase = await createClient();

    const [lotResult, slabsResult] = await Promise.all([
      supabase
        .from("marble_lots")
        .select(
          `
          id, lot_number, marble_name, supplier_name, purchase_date,
          invoice_number, cost_price, selling_price, dealer_price, notes, created_at, show_on_website,
          marble_categories(name),
          thickness_options(name),
          warehouses(name)
        `,
        )
        .eq("id", lotId)
        .single(),
      supabase
        .from("slabs")
        .select(
          `
          id, slab_code, marble_name, length, width, sqft, rack_number,
          cost_price, selling_price, dealer_price, notes, created_at, lot_id,
          reserved_for, reserved_until,
          marble_categories(name), warehouses(name), slab_statuses(name),
          thickness_options(name), marble_lots(lot_number),
          slab_images(image_url, sort_order)
        `,
        )
        .eq("lot_id", lotId)
        .order("slab_code", { ascending: true }),
    ]);

    if (lotResult.error || !lotResult.data) {
      return {
        error: `Lot not found. ${lotResult.error?.message ?? ""}`.trim(),
        lot: null,
        slabs: [],
      };
    }

    const lotRow = lotResult.data as Record<string, unknown>;
    const lotId2 = lotRow.id != null ? String(lotRow.id) : null;

    if (!lotId2) {
      return { error: "Invalid lot ID.", lot: null, slabs: [] };
    }

    const lot: LotInfo = {
      id: lotId2,
      lotNumber: toStr(lotRow.lot_number),
      marbleName: toStr(lotRow.marble_name),
      categoryName: relName(lotRow.marble_categories),
      thicknessName: relName(lotRow.thickness_options),
      warehouseName: relName(lotRow.warehouses),
      supplierName: toStr(lotRow.supplier_name),
      purchaseDate: toStr(lotRow.purchase_date),
      invoiceNumber: toStr(lotRow.invoice_number),
      costPrice: toNum(lotRow.cost_price),
      sellingPrice: toNum(lotRow.selling_price),
      dealerPrice: toNum(lotRow.dealer_price),
      notes: toStr(lotRow.notes),
      createdAt: toStr(lotRow.created_at),
      showOnWebsite: lotRow.show_on_website === true,
    };

    if (slabsResult.error) {
      return {
        error: `Unable to load slabs. ${slabsResult.error.message}`,
        lot,
        slabs: [],
      };
    }

    const slabs: InventoryListSlab[] = ((slabsResult.data as Record<string, unknown>[] | null) ?? [])
      .map((row) => {
        const id = row.id != null ? String(row.id) : null;
        if (!id) return null;
        const images = Array.isArray(row.slab_images)
          ? (row.slab_images as Array<{ image_url?: unknown; sort_order?: unknown }>)
          : [];
        const thumbnailUrl =
          images
            .slice()
            .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
            .map((img) => (typeof img.image_url === "string" ? img.image_url : null))
            .find((url): url is string => url !== null) ?? null;

        return {
          id,
          slabCode: toStr(row.slab_code),
          marbleName: toStr(row.marble_name),
          length: toNum(row.length),
          width: toNum(row.width),
          sqft: toNum(row.sqft),
          rackNumber: toStr(row.rack_number),
          costPrice: toNum(row.cost_price),
          sellingPrice: toNum(row.selling_price),
          dealerPrice: toNum(row.dealer_price),
          notes: toStr(row.notes),
          createdAt: toStr(row.created_at),
          lotId: row.lot_id != null ? String(row.lot_id) : null,
          lotNumber: relLotNumber(row.marble_lots),
          categoryName: relName(row.marble_categories),
          warehouseName: relName(row.warehouses),
          statusName: relName(row.slab_statuses),
          thumbnailUrl,
          thicknessName: relName(row.thickness_options),
          reservedFor: toStr(row.reserved_for),
          reservedUntil: toStr(row.reserved_until),
        } satisfies InventoryListSlab;
      })
      .filter((s): s is InventoryListSlab => s !== null);

    return { error: null, lot, slabs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: `Unable to load lot. ${message}`, lot: null, slabs: [] };
  }
}
