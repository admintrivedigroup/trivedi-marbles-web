"use client";

import { useMemo } from "react";
import { getCategory } from "@/lib/visualizerM2F/labelMap";
import type { PipelineSegment } from "@/lib/visualizerM2F/types";

type Props = {
  segments: PipelineSegment[];
  selected: string | null;
  onSelect: (category: string, segs: PipelineSegment[]) => void;
};

const SURFACE_CATS = ["floor", "wall", "ceiling", "stairs", "countertop"] as const;

const CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  floor:      { label: "Floor",      icon: "🔲", color: "bg-violet-100 border-violet-400 text-violet-700" },
  wall:       { label: "Wall",       icon: "🟦", color: "bg-sky-100 border-sky-400 text-sky-700" },
  ceiling:    { label: "Ceiling",    icon: "⬜", color: "bg-yellow-100 border-yellow-400 text-yellow-700" },
  stairs:     { label: "Stairs",     icon: "🪜", color: "bg-orange-100 border-orange-400 text-orange-700" },
  countertop: { label: "Countertop", icon: "📋", color: "bg-amber-100 border-amber-400 text-amber-700" },
};

export function SurfaceSelector({ segments, selected, onSelect }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, PipelineSegment[]>();
    for (const seg of segments) {
      const cat = getCategory(seg.label);
      if ((SURFACE_CATS as readonly string[]).includes(cat)) {
        const arr = map.get(cat) ?? [];
        arr.push(seg);
        map.set(cat, arr);
      }
    }
    return map;
  }, [segments]);

  if (groups.size === 0) {
    return (
      <p className="text-sm text-gray-400">
        No surface segments detected — check that MASK2FORMER_VERSION is set and the image has recognisable surfaces.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SURFACE_CATS.map((cat) => {
        const segs = groups.get(cat);
        if (!segs) return null;
        const meta     = CAT_META[cat]!;
        const isActive = selected === cat;

        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat, segs)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all ${
              isActive ? meta.color : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            {segs.length > 1 && (
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">
                {segs.length}
              </span>
            )}
          </button>
        );
      })}

      {/* Stairs explanation */}
      {groups.has("stairs") && selected === "stairs" && (
        <p className="w-full text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Stair rendering requires separate tread/riser handling — showing mask overlay only.
        </p>
      )}
    </div>
  );
}
