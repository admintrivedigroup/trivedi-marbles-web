"use client";

import { useRef, useState } from "react";

type Props = {
  beforeUrl:    string;
  afterUrl:     string;
  downloadUrl?: string;
};

export function BeforeAfter({ beforeUrl, afterUrl, downloadUrl }: Props) {
  const [pos, setPos]       = useState(50);
  const containerRef        = useRef<HTMLDivElement>(null);

  function getPos(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return pos;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-2xl border border-gray-200 shadow-sm cursor-ew-resize"
        onMouseMove={(e) => setPos(getPos(e.clientX))}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) setPos(getPos(t.clientX));
        }}
      >
        {/* Before */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt="Before" className="block w-full" draggable={false} />

        {/* After — clipped to left portion */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt="After" className="h-full w-full object-cover" draggable={false} />
        </div>

        {/* Divider handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-sm font-bold text-white shadow-xl">
            ⇆
          </div>
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/55 px-2 py-1 text-xs font-semibold text-white">
          Original
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-indigo-600/80 px-2 py-1 text-xs font-semibold text-white">
          With marble
        </div>
      </div>

      {/* Download */}
      {downloadUrl && (
        <div className="flex justify-end">
          <a
            href={downloadUrl}
            download="marble-render.jpg"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            ↓ Download result
          </a>
        </div>
      )}
    </div>
  );
}
