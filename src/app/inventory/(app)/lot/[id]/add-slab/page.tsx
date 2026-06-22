import { notFound } from "next/navigation";

import { AddSlabToLotForm } from "@/app/inventory/_components/add-slab-to-lot-form";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AddSlabToLotPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [lotResult, countResult] = await Promise.all([
    supabase
      .from("marble_lots")
      .select(
        "id, lot_number, marble_name, category_id, thickness_id, warehouse_id, selling_price, dealer_price",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("slabs")
      .select("id", { count: "exact", head: true })
      .eq("lot_id", id),
  ]);

  if (lotResult.error || !lotResult.data) {
    notFound();
  }

  const lot = lotResult.data as Record<string, unknown>;
  const existingCount = countResult.count ?? 0;
  const lotNumber = typeof lot.lot_number === "string" ? lot.lot_number.trim() : null;
  const suggestedSlabCode = lotNumber
    ? `${lotNumber}-S${existingCount + 1}`
    : `S${existingCount + 1}`;

  function toStr(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }
  function toNum(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  return (
    <AddSlabToLotForm
      lot={{
        id,
        lotNumber,
        marbleName: toStr(lot.marble_name),
        categoryId: toStr(lot.category_id) ?? String(lot.category_id ?? ""),
        thicknessId: toStr(lot.thickness_id) ?? String(lot.thickness_id ?? ""),
        warehouseId: toStr(lot.warehouse_id) ?? String(lot.warehouse_id ?? ""),
        sellingPrice: toNum(lot.selling_price),
        dealerPrice: toNum(lot.dealer_price),
        suggestedSlabCode,
      }}
    />
  );
}
