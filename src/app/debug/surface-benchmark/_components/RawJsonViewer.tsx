"use client";

import { useState } from "react";
import type { BenchmarkResult } from "../_lib/types";

type Props = { result: BenchmarkResult };

export function RawJsonViewer({ result }: Props) {
  const [open, setOpen] = useState(false);

  const safe = {
    ...result,
    segments: result.segments.map((s) => ({
      ...s,
      maskBase64: `[${s.maskBase64.length} base64 chars — omitted]`,
    })),
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        {open ? "▴" : "▾"} Raw API Response
      </button>

      {open && (
        <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-3 text-[10px] leading-relaxed text-green-400">
          {JSON.stringify(safe, null, 2)}
        </pre>
      )}
    </div>
  );
}
