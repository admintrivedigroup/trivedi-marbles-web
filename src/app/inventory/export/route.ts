import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { getInventorySlabs, type SortBy } from "@/app/inventory/_lib/inventory-list";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { createClient } from "@/lib/supabase/server";

const VALID_SORTS: SortBy[] = ["newest", "oldest", "name_asc", "name_desc", "sqft_desc", "sqft_asc"];

const STATUS_FILLS: Record<string, string> = {
  Available: "FFD4EDDA",
  Reserved: "FFFFF3CD",
  Sold:      "FFF8D7DA",
};

const HEADER_BG  = "FF2D4A8A";
const HEADER_FG  = "FFFFFFFF";
const STRIPE_BG  = "FFF4F6FB";
const SUMMARY_BG = "FFE8EDF8";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = request.nextUrl.searchParams;
  const warehouseId = sp.get("warehouse") ?? "";
  const statusId    = sp.get("status")    ?? "";
  const sort        = sp.get("sort")      ?? "";
  const sortBy: SortBy = VALID_SORTS.includes(sort as SortBy) ? (sort as SortBy) : "newest";
  const search      = sp.get("q")?.trim() ?? "";

  const profile = await getCurrentUserProfile();
  const { slabs } = await getInventorySlabs({
    warehouseId,
    statusId,
    sortBy,
    search,
    allowedWarehouseIds: profile?.warehouseIds ?? null,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Trivedi Grani Marmo";
  wb.created = new Date();

  const ws = wb.addWorksheet("Inventory", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Column definitions — NO header here; we write headers manually to row 2
  const colDefs = [
    { key: "slabCode",      label: "Slab Code",     width: 18, align: "left"  as const },
    { key: "marbleName",    label: "Marble Name",   width: 22, align: "left"  as const },
    { key: "lotNumber",     label: "Lot Number",    width: 14, align: "left"  as const },
    { key: "categoryName",  label: "Category",      width: 16, align: "left"  as const },
    { key: "length",        label: "Length (ft)",   width: 12, align: "right" as const, numFmt: "0.00" },
    { key: "width",         label: "Width (ft)",    width: 11, align: "right" as const, numFmt: "0.00" },
    { key: "sqft",          label: "Sqft",          width: 10, align: "right" as const, numFmt: "0.00" },
    { key: "thicknessName", label: "Thickness",     width: 11, align: "center" as const },
    { key: "rackNumber",    label: "Rack",          width: 10, align: "center" as const },
    { key: "warehouseName", label: "Location",      width: 16, align: "left"  as const },
    { key: "statusName",    label: "Status",        width: 13, align: "center" as const },
    { key: "sellingPrice",  label: "Selling Price", width: 14, align: "right" as const, numFmt: '₹#,##0.00' },
    { key: "notes",         label: "Notes",         width: 28, align: "left"  as const },
  ];

  // Set column widths and number formats (no header property to avoid auto row-1 write)
  ws.columns = colDefs.map(({ key, width, numFmt }) => ({
    key,
    width,
    style: numFmt ? { numFmt } : undefined,
  }));

  // ── Row 1: Title ───────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, colDefs.length);
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `Trivedi Grani Marmo — Inventory Export  (${date})`;
  titleCell.font      = { bold: true, size: 13, color: { argb: HEADER_FG } };
  titleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // ── Row 2: Column headers ──────────────────────────────────────────────────
  const headerRow = ws.getRow(2);
  headerRow.height = 22;
  colDefs.forEach(({ label }, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value     = label;
    cell.font      = { bold: true, size: 10, color: { argb: HEADER_FG } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border    = { bottom: { style: "medium", color: { argb: "FF1A3060" } } };
  });

  // ── Rows 3+: Data ──────────────────────────────────────────────────────────
  slabs.forEach((s, i) => {
    const row = ws.addRow({
      slabCode:      s.slabCode,
      marbleName:    s.marbleName,
      lotNumber:     s.lotNumber,
      categoryName:  s.categoryName,
      length:        s.length,
      width:         s.width,
      sqft:          s.sqft,
      thicknessName: s.thicknessName,
      rackNumber:    s.rackNumber,
      warehouseName: s.warehouseName,
      statusName:    s.statusName,
      sellingPrice:  s.sellingPrice,
      notes:         s.notes ?? "",
    });

    const bg = i % 2 === 1 ? STRIPE_BG : "FFFFFFFF";
    row.height = 18;

    colDefs.forEach(({ align }, idx) => {
      const cell = row.getCell(idx + 1);
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: align, vertical: "middle" };
      cell.border    = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
      cell.font      = { size: 10 };
    });

    // Status badge colour
    const statusCell = row.getCell(11);
    const statusFill = STATUS_FILLS[s.statusName ?? ""];
    if (statusFill) {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    }
    statusCell.font = { bold: true, size: 10 };
  });

  // ── Summary row ────────────────────────────────────────────────────────────
  // Data occupies rows 3 … (2 + slabs.length)
  const firstDataRow = 3;
  const lastDataRow  = 2 + slabs.length;

  const sumRow = ws.addRow([]);   // next row after data
  sumRow.height = 20;

  // "N slabs" in col 1
  const countCell = sumRow.getCell(1);
  countCell.value     = `${slabs.length} slab${slabs.length !== 1 ? "s" : ""}`;
  countCell.font      = { bold: true, size: 10 };
  countCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_BG } };
  countCell.alignment = { vertical: "middle" };
  countCell.border    = { top: { style: "medium", color: { argb: HEADER_BG } } };

  // "Total Sqft:" label in col 6
  const labelCell = sumRow.getCell(6);
  labelCell.value     = "Total Sqft:";
  labelCell.font      = { bold: true, size: 10 };
  labelCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_BG } };
  labelCell.alignment = { horizontal: "right", vertical: "middle" };
  labelCell.border    = { top: { style: "medium", color: { argb: HEADER_BG } } };

  // SUM formula in col 7 (Sqft)
  const sqftCell = sumRow.getCell(7);
  sqftCell.value     = { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: 0 };
  sqftCell.numFmt    = "0.00";
  sqftCell.font      = { bold: true, size: 10 };
  sqftCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_BG } };
  sqftCell.alignment = { horizontal: "right", vertical: "middle" };
  sqftCell.border    = { top: { style: "medium", color: { argb: HEADER_BG } } };

  // ── Freeze top 2 rows, autofilter on header row ────────────────────────────
  ws.views      = [{ state: "frozen", xSplit: 0, ySplit: 2, activeCell: "A3" }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: colDefs.length } };

  const buffer   = await wb.xlsx.writeBuffer();
  const fileDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-${fileDate}.xlsx"`,
    },
  });
}
