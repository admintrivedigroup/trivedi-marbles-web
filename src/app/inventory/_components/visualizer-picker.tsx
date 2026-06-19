"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type SlabEntry = {
  id: string;
  slabCode: string;
  marbleName: string | null;
  thumbnailUrl: string | null;
};

type Props = {
  slabs: SlabEntry[];
};

export function VisualizerPicker({ slabs }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? slabs.filter(
        (s) =>
          s.slabCode.toLowerCase().includes(query.toLowerCase()) ||
          (s.marbleName?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : slabs;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by slab code or marble name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No slabs match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((slab) => (
            <Link
              key={slab.id}
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
                {slab.marbleName && (
                  <p className="truncate text-xs text-gray-400">{slab.marbleName}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
