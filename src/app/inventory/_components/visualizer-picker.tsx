"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";
import type { PickerLot, PickerSlab } from "@/app/inventory/(fullscreen)/visualize/page";

type Props = {
  lots: PickerLot[];
};

function SlabCard({ slab }: { slab: PickerSlab }) {
  return (
    <Link
      href={`/inventory/visualize/${slab.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-100">
        {slab.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slab.thumbnailUrl}
            alt={slab.slabCode}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-300">
            No image
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-semibold text-gray-900">{slab.slabCode}</p>
      </div>
    </Link>
  );
}

function LotCard({ lot, onClick }: { lot: PickerLot; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md text-left"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-100">
        {lot.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.thumbnailUrl}
            alt={lot.lotNumber}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-300">
            No image
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-semibold text-gray-900">{lot.lotNumber}</p>
        {lot.marbleName && (
          <p className="truncate text-xs text-gray-400">{lot.marbleName}</p>
        )}
        <p className="mt-0.5 text-[10px] text-gray-300">
          {lot.slabs.length} slab{lot.slabs.length !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

export function VisualizerPicker({ lots }: Props) {
  const [query, setQuery] = useState("");
  const [selectedLot, setSelectedLot] = useState<PickerLot | null>(null);

  if (selectedLot) {
    return (
      <div>
        {/* Back + lot header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => setSelectedLot(null)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All lots
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedLot.lotNumber}</p>
            {selectedLot.marbleName && (
              <p className="text-xs text-gray-400">{selectedLot.marbleName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {selectedLot.slabs.map((slab) => (
            <SlabCard key={slab.id} slab={slab} />
          ))}
        </div>
      </div>
    );
  }

  const filtered = query.trim()
    ? lots.filter(
        (l) =>
          l.lotNumber.toLowerCase().includes(query.toLowerCase()) ||
          (l.marbleName?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : lots;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by lot number or marble name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No lots match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((lot) => (
            <LotCard key={lot.lotNumber} lot={lot} onClick={() => setSelectedLot(lot)} />
          ))}
        </div>
      )}
    </div>
  );
}
