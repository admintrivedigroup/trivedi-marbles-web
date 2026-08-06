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

function FloorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="10" width="18" height="9" rx="1" />
      <path d="M3 10l9-6 9 6" />
    </svg>
  );
}
function WallIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  );
}
function CeilingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8h16M4 8l3-4h10l3 4" />
    </svg>
  );
}
function StairsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20v-4h4v-4h4V8h4V4h4" />
    </svg>
  );
}
function CountertopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="9" width="18" height="4" rx="0.5" />
      <path d="M6 13v6M18 13v6" />
    </svg>
  );
}

const CAT_META: Record<string, { label: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }> = {
  floor:      { label: "Floor",      Icon: FloorIcon },
  wall:       { label: "Wall",       Icon: WallIcon },
  ceiling:    { label: "Ceiling",    Icon: CeilingIcon },
  stairs:     { label: "Stairs",     Icon: StairsIcon },
  countertop: { label: "Countertop", Icon: CountertopIcon },
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
      <p className="px-3 py-2 text-[11px] text-stone-400">
        No surfaces detected yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-1 p-2">
        {SURFACE_CATS.map((cat) => {
          const segs = groups.get(cat);
          if (!segs) return null;
          const meta     = CAT_META[cat]!;
          const Icon     = meta.Icon;
          const isActive = selected === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(cat, segs)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-[#17130f] text-[#faf8f5]"
                  : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Stairs explanation */}
      {groups.has("stairs") && selected === "stairs" && (
        <p className="mx-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Stair rendering requires separate tread/riser handling — showing mask overlay only.
        </p>
      )}
    </div>
  );
}
