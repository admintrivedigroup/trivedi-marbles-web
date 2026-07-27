"use client";

import type { BenchmarkResult } from "../_lib/types";

const ROWS: { label: string; matches: string[] }[] = [
  { label: "Floor",      matches: ["floor", "carpet", "rug", "mat"] },
  { label: "Wall",       matches: ["wall"] },
  { label: "Ceiling",    matches: ["ceiling"] },
  { label: "Stairs",     matches: ["stair", "step", "escalator"] },
  { label: "Window",     matches: ["window", "windowpane"] },
  { label: "Door",       matches: ["door"] },
  { label: "Furniture",  matches: ["chair", "table", "sofa", "couch", "bed", "bench", "cabinet", "bookcase", "dresser", "wardrobe", "ottoman"] },
  { label: "Countertop", matches: ["counter", "countertop", "kitchen island"] },
  { label: "Fixture",    matches: ["sink", "toilet", "bathtub", "shower", "refrigerator", "oven", "stove"] },
];

function detected(r: BenchmarkResult, matches: string[]): boolean {
  return r.segments.some((s) => matches.some((m) => s.label.includes(m)));
}

type Props = { results: Record<string, BenchmarkResult> };

export function ComparisonTable({ results }: Props) {
  const entries = Object.values(results).filter((r) => !r.error && r.segments.length > 0);
  if (entries.length < 2) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-40 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-500">
              Surface
            </th>
            {entries.map((r) => (
              <th key={r.modelKey} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-500">
                {r.modelName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, matches }) => (
            <tr key={label} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{label}</td>
              {entries.map((r) => {
                const found = detected(r, matches);
                return (
                  <td key={r.modelKey} className="px-4 py-2.5 text-center">
                    <span className={`text-base font-bold ${found ? "text-emerald-500" : "text-red-400"}`}>
                      {found ? "✓" : "✗"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}

          <tr className="border-b border-gray-100 bg-gray-50">
            <td className="px-4 py-2.5 text-sm font-medium text-gray-700">Classes detected</td>
            {entries.map((r) => (
              <td key={r.modelKey} className="px-4 py-2.5 text-center tabular-nums text-sm text-gray-600">
                {r.segments.length}
              </td>
            ))}
          </tr>

          <tr>
            <td className="px-4 py-2.5 text-sm font-medium text-gray-700">Inference time</td>
            {entries.map((r) => (
              <td key={r.modelKey} className="px-4 py-2.5 text-center tabular-nums text-sm text-gray-600">
                {(r.inferenceMs / 1000).toFixed(1)}s
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
