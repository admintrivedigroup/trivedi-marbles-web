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
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-lg border border-stone-200 shadow-lg shadow-stone-900/10 cursor-ew-resize"
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
          className="pointer-events-none absolute inset-y-0 w-0.5"
          style={{
            left: `${pos}%`,
            background: "linear-gradient(180deg, transparent, #c8a96a 12%, #c8a96a 88%, transparent)",
          }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#c8a96a] bg-white text-[#9c7c42] shadow-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/15 bg-stone-900/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          Original
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-white/15 bg-stone-900/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          With marble
        </div>
      </div>

      {/* Download */}
      {downloadUrl && (
        <div className="flex justify-end">
          <a
            href={downloadUrl}
            download="marble-render.jpg"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
          >
            ↓ Download result
          </a>
        </div>
      )}
    </div>
  );
}
