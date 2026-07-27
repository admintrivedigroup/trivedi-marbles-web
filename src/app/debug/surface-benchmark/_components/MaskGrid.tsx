"use client";

import { useEffect, useRef } from "react";
import type { Segment } from "../_lib/types";
import { getLabelColor } from "../_lib/labelMap";

// Surface patterns used to sort key surfaces to the front.
const KEY_PATTERNS = [
  "floor", "carpet", "rug", "wall", "ceiling",
  "stair", "step", "door", "window", "windowpane",
  "chair", "table", "sofa", "couch", "bed", "bench",
  "cabinet", "counter", "sink", "toilet", "bathtub",
];

function isKey(label: string): boolean {
  return KEY_PATTERNS.some((p) => label.includes(p));
}

// ─── Single mask cell ─────────────────────────────────────────────────────────

type CellProps = {
  segment: Segment;
  roomUrl: string;
  w: number;
  h: number;
};

function MaskCell({ segment, roomUrl, w, h }: CellProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;

    const room = new Image();
    room.crossOrigin = "anonymous";
    room.onload = () => {
      ctx.drawImage(room, 0, 0, w, h);
      const roomPx = ctx.getImageData(0, 0, w, h);
      const [r, g, b] = getLabelColor(segment.label);

      const mask = new Image();
      mask.onload = () => {
        const mc = document.createElement("canvas");
        mc.width = w;
        mc.height = h;
        mc.getContext("2d")!.drawImage(mask, 0, 0, w, h);
        const md = mc.getContext("2d")!.getImageData(0, 0, w, h).data;

        const out = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const inMask = (md[i * 4] + md[i * 4 + 1] + md[i * 4 + 2]) / 3 > 128;
          if (inMask) {
            out.data[i * 4]     = Math.round(roomPx.data[i * 4]     * 0.3 + r * 0.7);
            out.data[i * 4 + 1] = Math.round(roomPx.data[i * 4 + 1] * 0.3 + g * 0.7);
            out.data[i * 4 + 2] = Math.round(roomPx.data[i * 4 + 2] * 0.3 + b * 0.7);
          } else {
            out.data[i * 4]     = Math.round(roomPx.data[i * 4]     * 0.15);
            out.data[i * 4 + 1] = Math.round(roomPx.data[i * 4 + 1] * 0.15);
            out.data[i * 4 + 2] = Math.round(roomPx.data[i * 4 + 2] * 0.15);
          }
          out.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(out, 0, 0);
      };
      mask.src = `data:image/png;base64,${segment.maskBase64}`;
    };
    room.src = roomUrl;
  }, [segment, roomUrl, w, h]);

  function downloadRawMask() {
    const a = document.createElement("a");
    a.href   = `data:image/png;base64,${segment.maskBase64}`;
    a.download = `mask-${segment.label.replace(/\s+/g, "-")}.png`;
    a.click();
  }

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-200"
      style={{ aspectRatio: `${w}/${h}` }}
    >
      <canvas ref={ref} className="h-full w-full object-cover" />

      {/* Label overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
        <p className="truncate text-[10px] font-semibold capitalize leading-tight text-white">
          {segment.label}
        </p>
        {segment.score !== null && (
          <p className="text-[9px] text-white/60">{Math.round((segment.score ?? 0) * 100)}% conf</p>
        )}
      </div>

      {/* Download button — visible on hover */}
      <button
        type="button"
        onClick={downloadRawMask}
        className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] text-white transition-colors hover:bg-black/90 group-hover:flex"
        title="Download raw mask PNG"
      >
        ↓
      </button>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

type Props = {
  segments: Segment[];
  roomUrl: string;
  imgW: number;
  imgH: number;
};

export function MaskGrid({ segments, roomUrl, imgW, imgH }: Props) {
  const key    = segments.filter((s) => isKey(s.label));
  const others = segments.filter((s) => !isKey(s.label));
  const ordered = [...key, ...others];

  if (ordered.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Masks · {ordered.length} segments · hover to download
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {ordered.map((seg) => (
          <MaskCell
            key={seg.label}
            segment={seg}
            roomUrl={roomUrl}
            w={imgW}
            h={imgH}
          />
        ))}
      </div>
    </div>
  );
}
