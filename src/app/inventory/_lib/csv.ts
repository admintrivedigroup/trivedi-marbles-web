// Minimal CSV writer for report downloads. Safe for client and server use.

export type CsvCell = string | number | null | undefined;

// Spreadsheets treat a cell starting with one of these as a formula, so a marble or
// warehouse name like "=HYPERLINK(...)" would execute when the file is opened.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  const text = FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Browser-only: saves `csv` as a download. */
export function downloadCsv(filename: string, csv: string) {
  // The BOM makes Excel read the file as UTF-8 (needed for the en dashes and rupee text).
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
