"use client";

import { useEffect, useState } from "react";
import { getCategory } from "@/lib/visualizerM2F/labelMap";
import { computeMaskCentroid } from "@/lib/visualizerM2F/maskUtils";
import type { PipelineSegment } from "@/lib/visualizerM2F/types";

const SURFACE_CATS = ["floor", "wall", "ceiling", "stairs", "countertop"] as const;
const CAT_LABEL: Record<string, string> = {
  floor: "Floor", wall: "Wall", ceiling: "Ceiling", stairs: "Stairs", countertop: "Countertop",
};

type Props = {
  segments: PipelineSegment[];
  selected: string | null;
  imgWidth: number;
  imgHeight: number;
  onSelect: (cat: string, segs: PipelineSegment[]) => void;
};

// Overlay is cheap at low res — matches the scale used elsewhere for on-canvas overlays.
const CENTROID_MAX = 480;

export function SurfacePills({ segments, selected, imgWidth, imgHeight, onSelect }: Props) {
  const [pins, setPins] = useState<Record<string, { xFrac: number; yFrac: number; segs: PipelineSegment[] }>>({});

  useEffect(() => {
    if (segments.length === 0 || imgWidth <= 0 || imgHeight <= 0) return;
    let cancelled = false;

    const groups = new Map<string, PipelineSegment[]>();
    for (const seg of segments) {
      const cat = getCategory(seg.label);
      if (!(SURFACE_CATS as readonly string[]).includes(cat)) continue;
      const arr = groups.get(cat) ?? [];
      arr.push(seg);
      groups.set(cat, arr);
    }

    const scale = Math.min(1, CENTROID_MAX / Math.max(imgWidth, imgHeight));
    const w = Math.round(imgWidth * scale);
    const h = Math.round(imgHeight * scale);

    void (async () => {
      const next: Record<string, { xFrac: number; yFrac: number; segs: PipelineSegment[] }> = {};
      for (const [cat, segs] of groups) {
        const centroid = await computeMaskCentroid(segs.map((s) => s.maskBase64), w, h);
        if (centroid) next[cat] = { ...centroid, segs };
      }
      if (!cancelled) setPins(next);
    })();

    return () => { cancelled = true; };
  }, [segments, imgWidth, imgHeight]);

  const entries = Object.entries(pins);
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(([cat, { xFrac, yFrac, segs }]) => {
        const isActive = selected === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat, segs)}
            style={{ left: `${xFrac * 100}%`, top: `${yFrac * 100}%`, transform: "translate(-50%, -50%)" }}
            className={`absolute z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold shadow-lg backdrop-blur-sm transition-colors ${
              isActive ? "bg-[#c8a96a] text-[#17130f]" : "bg-[#17130f]/80 text-[#faf8f5] hover:bg-[#17130f]/95"
            }`}
          >
            {isActive ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5"><path d="M4 12l6 6L20 6" /></svg>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" />
            )}
            {CAT_LABEL[cat]}
          </button>
        );
      })}
    </>
  );
}
