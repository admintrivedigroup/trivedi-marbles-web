"use client";

import { useState } from "react";
import type { DepthResult, DepthMetrics, ModelId } from "../_lib/types";
import { MODEL_META } from "../_lib/modelMeta";
import { DepthViewer } from "./DepthViewer";

type Props = {
  modelId:    ModelId;
  result:     DepthResult | null;
  running:    boolean;
  photoUrl:   string;
  origW:      number;
  origH:      number;
  onMetrics?: (modelId: ModelId, m: DepthMetrics) => void;
};

export function ModelCard({ modelId, result, running, photoUrl, origW, origH, onMetrics }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const meta = MODEL_META[modelId];

  const depthDataUrl = result?.depthBase64
    ? `data:image/png;base64,${result.depthBase64}`
    : null;

  const colorDepthDataUrl = result?.colorDepthBase64
    ? `data:image/png;base64,${result.colorDepthBase64}`
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{meta.name}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">{meta.paper}</p>
          </div>
          <div className="shrink-0">
            {result && !result.error && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {(result.inferenceMs / 1000).toFixed(1)}s
              </span>
            )}
            {running && (
              <span className="animate-pulse rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                Running…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {result?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700">Error</p>
          <p className="mt-0.5 text-xs text-red-600 break-words">{result.error}</p>
        </div>
      )}

      {/* Depth viewer */}
      {depthDataUrl && !result?.error && (
        <DepthViewer
          originalUrl={photoUrl}
          depthDataUrl={depthDataUrl}
          colorDepthDataUrl={colorDepthDataUrl}
          origW={origW}
          origH={origH}
          onMetrics={(m) => onMetrics?.(modelId, m)}
        />
      )}

      {/* Skeleton while running */}
      {running && !result && (
        <div className="space-y-2">
          <div className="h-8  animate-pulse rounded-lg bg-gray-100" />
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        </div>
      )}

      {/* Not run yet */}
      {!running && !result && (
        <div className="flex h-32 items-center justify-center text-xs text-gray-400">
          Not run yet
        </div>
      )}

      {/* Raw output */}
      {result && (
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
          >
            <span>{showRaw ? "▲" : "▼"}</span>
            <span>Raw Replicate output</span>
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-3 text-[10px] leading-relaxed text-green-400">
              {JSON.stringify(result.rawOutput, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
