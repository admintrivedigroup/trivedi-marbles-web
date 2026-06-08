"use client";

import { ArrowLeft, Printer } from "lucide-react";
import QRCode from "react-qr-code";

import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";

type SlabLabelProps = {
  slab: InventoryListSlab;
  slabUrl: string;
};

function fmtThickness(value: string | null) {
  if (!value) return null;
  return /^\d+(\.\d+)?$/.test(value) ? `${value}mm` : value;
}

function statusColors(status: string | null) {
  if (status === "Available") return "bg-green-100 text-green-700";
  if (status === "Reserved") return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-600";
}

export function SlabLabel({ slab, slabUrl }: SlabLabelProps) {
  const sizeText =
    slab.length && slab.width
      ? `${slab.length}' × ${slab.width}'${slab.sqft ? ` (${slab.sqft} sqft)` : ""}`
      : null;

  const thickness = fmtThickness(slab.thicknessName);
  const subtitle = [slab.categoryName, thickness].filter(Boolean).join(" · ");
  const location = [
    slab.warehouseName,
    slab.rackNumber ? `Rack ${slab.rackNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="inventory-theme min-h-screen bg-gray-50 p-6 print:bg-white print:p-0 print:min-h-auto">
      {/* Controls — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
      </div>

      {/* Label card */}
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg print:mx-0 print:rounded-none print:border-none print:shadow-none print:max-w-none">
        {/* Header stripe */}
        <div className="bg-gray-900 px-5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">
            Trivedi Grani Marmo
          </p>
        </div>

        {/* Body */}
        <div className="flex gap-4 px-5 py-5">
          {/* Left: slab details */}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xl font-bold leading-tight text-gray-900">
              {slab.slabCode ?? "—"}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-800 leading-snug">
              {slab.marbleName ?? "—"}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}

            <div className="mt-3.5 space-y-1.5">
              {sizeText && (
                <div className="flex items-baseline gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Size
                  </span>
                  <span className="text-xs text-gray-700">{sizeText}</span>
                </div>
              )}
              {location && (
                <div className="flex items-baseline gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Location
                  </span>
                  <span className="text-xs text-gray-700">{location}</span>
                </div>
              )}
              {slab.lotNumber && (
                <div className="flex items-baseline gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Lot
                  </span>
                  <span className="text-xs font-mono text-gray-700">
                    {slab.lotNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: QR code */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="rounded-xl border border-gray-100 p-2.5 bg-white">
              <QRCode value={slabUrl} size={96} level="M" />
            </div>
            <p className="text-[9px] text-gray-400 text-center">
              Scan for details
            </p>
          </div>
        </div>

        {/* Footer: status */}
        <div className="border-t border-gray-100 px-5 py-2.5 flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColors(slab.statusName)}`}
          >
            {slab.statusName ?? "Unknown"}
          </span>
          <span className="text-[9px] text-gray-300 font-mono">
            {slab.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Help text — hidden when printing */}
      <p className="mt-4 text-center text-xs text-gray-400 print:hidden">
        Recommended label size: A6 (148 × 105 mm) or 4&quot; × 3&quot;
      </p>

      {/* Print page config */}
      <style>{`
        @media print {
          @page {
            size: 148mm 105mm;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
