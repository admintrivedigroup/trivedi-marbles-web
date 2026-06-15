"use client";

import { ArrowLeft, Printer } from "lucide-react";
import QRCode from "react-qr-code";

import type { LotInfo } from "@/app/inventory/_lib/lot-detail";
import { formatThickness } from "@/app/inventory/_lib/format";

type LotLabelProps = {
  lot: LotInfo;
  lotUrl: string;
  slabCount: number;
};

export function LotLabel({ lot, lotUrl, slabCount }: LotLabelProps) {
  const thickness = formatThickness(lot.thicknessName);
  const subtitle = [lot.categoryName, thickness].filter(Boolean).join(" · ");
  const location = lot.warehouseName ?? null;

  return (
    <div className="inventory-theme min-h-screen bg-gray-50 p-6 print:min-h-auto print:bg-white print:p-0">
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

      {/* Single lot label */}
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg print:mx-0 print:max-w-none print:rounded-none print:border-none print:shadow-none">
        {/* Header stripe */}
        <div className="bg-gray-900 px-5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">
            Trivedi Grani Marmo
          </p>
        </div>

        {/* Body */}
        <div className="flex gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xl font-bold leading-tight text-gray-900">
              {lot.lotNumber ?? "—"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-gray-800">
              {lot.marbleName ?? "—"}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}

            <div className="mt-3.5 space-y-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  Slabs
                </span>
                <span className="text-xs text-gray-700">{slabCount}</span>
              </div>
              {location && (
                <div className="flex items-baseline gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Location
                  </span>
                  <span className="text-xs text-gray-700">{location}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR code */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="rounded-xl border border-gray-100 bg-white p-2.5">
              <QRCode value={lotUrl} size={96} level="M" />
            </div>
            <p className="text-center text-[9px] text-gray-400">
              Scan to view all slabs
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5">
          <span className="text-[10px] text-gray-400">Lot QR</span>
          <span className="font-mono text-[9px] text-gray-300">{lot.id.slice(0, 8)}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400 print:hidden">
        Recommended label size: A6 (148 × 105 mm) or 4&quot; × 3&quot;
      </p>

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
