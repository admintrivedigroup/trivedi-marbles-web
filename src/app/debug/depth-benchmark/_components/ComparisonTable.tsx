"use client";

import type { ModelId, DepthResult, DepthMetrics } from "../_lib/types";
import { MODEL_META, MODEL_IDS } from "../_lib/modelMeta";

type Props = {
  results: Record<string, DepthResult>;
  metrics: Record<string, DepthMetrics | null>;
};

// Normalise a raw metric value to 0–100 using a reference ceiling
function norm(v: number, ceiling: number) {
  return Math.min(100, Math.round((v / ceiling) * 100));
}

function overallScore(m: DepthMetrics | null): number | null {
  if (!m) return null;
  // Weighted: floor gradient 30%, wall separation 20%, edge quality 30%, contrast 20%
  const fg = norm(m.floorGradient,  0.18) * 0.30;
  const ws = norm(m.wallSeparation, 0.10) * 0.20;
  const eq = norm(m.edgeQuality,    0.07) * 0.30;
  const ct = norm(m.contrast,       0.65) * 0.20;
  return Math.round(fg + ws + eq + ct);
}

function Cell({ v, isTime }: { v: string | null; isTime?: boolean }) {
  if (v === null) {
    return <td className="px-4 py-2.5 text-center text-sm tabular-nums text-gray-300">—</td>;
  }
  return (
    <td className={`px-4 py-2.5 text-center text-sm tabular-nums ${isTime ? "text-gray-600" : "font-semibold text-gray-800"}`}>
      {v}
    </td>
  );
}

export function ComparisonTable({ results, metrics }: Props) {
  const rows: { label: string; getValue: (id: ModelId) => string | null; isTime?: boolean }[] = [
    {
      label:    "Inference time",
      isTime:   true,
      getValue: (id) => {
        const r = results[id];
        if (!r) return null;
        if (r.error) return "failed";
        return `${(r.inferenceMs / 1000).toFixed(1)}s`;
      },
    },
    {
      label:    "Floor gradient",
      getValue: (id) => {
        const m = metrics[id];
        return m ? m.floorGradient.toFixed(3) : null;
      },
    },
    {
      label:    "Wall separation",
      getValue: (id) => {
        const m = metrics[id];
        return m ? m.wallSeparation.toFixed(3) : null;
      },
    },
    {
      label:    "Edge quality",
      getValue: (id) => {
        const m = metrics[id];
        return m ? m.edgeQuality.toFixed(3) : null;
      },
    },
    {
      label:    "Contrast",
      getValue: (id) => {
        const m = metrics[id];
        return m ? m.contrast.toFixed(3) : null;
      },
    },
    {
      label:    "Depth resolution",
      getValue: (id) => metrics[id]?.depthResolution ?? null,
    },
    {
      label:    "Overall score",
      getValue: (id) => {
        const s = overallScore(metrics[id] ?? null);
        return s !== null ? `${s} / 100` : null;
      },
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
              Metric
            </th>
            {MODEL_IDS.map((id) => (
              <th key={id} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-400">
                {MODEL_META[id].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, getValue, isTime }, ri) => (
            <tr
              key={label}
              className={`border-b border-gray-100 ${
                label === "Overall score" ? "bg-indigo-50 font-semibold" : ri % 2 === 0 ? "" : "bg-gray-50/50"
              }`}
            >
              <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
              {MODEL_IDS.map((id) => (
                <Cell key={id} v={getValue(id)} isTime={isTime} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
        Overall score = floor gradient (30%) + wall separation (20%) + edge quality (30%) + contrast (20%).
        Heuristic only — verify visually.
      </p>
    </div>
  );
}
