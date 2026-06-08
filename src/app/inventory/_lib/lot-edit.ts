import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LotForEdit = {
  id: string;
  lotNumber: string;
  marbleName: string;
  categoryId: string;
  statusId: string;
  thicknessId: string;
  warehouseId: string;
  supplierName: string;
  purchaseDate: string;
  invoiceNumber: string;
  costPrice: string;
  sellingPrice: string;
  dealerPrice: string;
  notes: string;
  showOnWebsite: boolean;
};

export type LotForEditResult = {
  error: string | null;
  lot: LotForEdit | null;
};

export async function getLotForEdit(lotId: string): Promise<LotForEditResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("marble_lots")
      .select(
        "id, lot_number, marble_name, category_id, status_id, thickness_id, warehouse_id, supplier_name, purchase_date, invoice_number, cost_price, selling_price, dealer_price, notes, show_on_website",
      )
      .eq("id", lotId)
      .single();

    if (error || !data) {
      return {
        error: `Lot not found. ${error?.message ?? ""}`.trim(),
        lot: null,
      };
    }

    const row = data as Record<string, unknown>;

    function str(v: unknown): string {
      if (v === null || v === undefined) return "";
      return String(v).trim();
    }

    function numStr(v: unknown): string {
      if (v === null || v === undefined) return "";
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : "";
    }

    return {
      error: null,
      lot: {
        id: str(row.id),
        lotNumber: str(row.lot_number),
        marbleName: str(row.marble_name),
        categoryId: str(row.category_id),
        statusId: str(row.status_id),
        thicknessId: str(row.thickness_id),
        warehouseId: str(row.warehouse_id),
        supplierName: str(row.supplier_name),
        purchaseDate: str(row.purchase_date),
        invoiceNumber: str(row.invoice_number),
        costPrice: numStr(row.cost_price),
        sellingPrice: numStr(row.selling_price),
        dealerPrice: numStr(row.dealer_price),
        notes: str(row.notes),
        showOnWebsite: row.show_on_website === true,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please try again.";
    return { error: `Unable to load lot. ${message}`, lot: null };
  }
}
