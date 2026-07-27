"use client";

import { useState, useEffect, useRef } from "react";
import type { DepthMetrics, VisualizationMode } from "../_lib/types";

// ── Inferno colormap (10 key stops — matches matplotlib inferno) ─────────────
const INFERNO_STOPS: [number, number, number][] = [
  [0,    0,   4],   // 0.0
  [10,   8,  44],   // 0.1
  [39,  12,  98],   // 0.2
  [83,  16, 131],   // 0.3
  [130, 29, 134],   // 0.4
  [174, 56, 111],   // 0.5
  [210, 88,  75],   // 0.6
  [240,130,  34],   // 0.7
  [249,186,   8],   // 0.8
  [252,255, 164],   // 1.0
];

function infernoRgb(t: number): [number, number, number] {
  const n      = INFERNO_STOPS.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * n;
  const i      = Math.min(n - 1, Math.floor(scaled));
  const f      = scaled - i;
  const [r1, g1, b1] = INFERNO_STOPS[i];
  const [r2, g2, b2] = INFERNO_STOPS[i + 1];
  return [
    Math.round(r1 + (r2 - r1) * f),
    Math.round(g1 + (g2 - g1) * f),
    Math.round(b1 + (b2 - b1) * f),
  ];
}

// ── Metric computation (Canvas, downsampled to 320×240) ───────────────────────

const METRIC_W = 320;
const METRIC_H = 240;

function computeMetrics(
  depthDataUrl: string,
  origW:        number,
  origH:        number,
): Promise<DepthMetrics> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c   = document.createElement("canvas");
      c.width   = METRIC_W;
      c.height  = METRIC_H;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, METRIC_W, METRIC_H);
      const { data } = ctx.getImageData(0, 0, METRIC_W, METRIC_H);

      const N    = METRIC_W * METRIC_H;
      const vals = new Float32Array(N);
      let mn = 1, mx = 0;

      for (let i = 0; i < N; i++) {
        const v = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / (3 * 255);
        vals[i] = v;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }

      // 16-bucket histogram (normalised)
      const hist = new Array<number>(16).fill(0);
      for (let i = 0; i < N; i++) hist[Math.min(15, Math.floor(vals[i] * 16))]++;
      const histogram = hist.map((h) => h / N);

      // Floor gradient — bottom-third vs top-third
      const t3 = Math.floor(METRIC_H / 3);
      let tSum = 0, bSum = 0, tN = 0, bN = 0;
      for (let y = 0; y < METRIC_H; y++) {
        for (let x = 0; x < METRIC_W; x++) {
          const v = vals[y * METRIC_W + x];
          if (y < t3)              { tSum += v; tN++; }
          else if (y >= METRIC_H - t3) { bSum += v; bN++; }
        }
      }
      const floorGradient = Math.abs((bSum / bN) - (tSum / tN));

      // Wall separation — left quarter vs right quarter (mid-height band)
      const qW = Math.floor(METRIC_W / 4);
      const y0 = Math.floor(METRIC_H * 0.2);
      const y1 = Math.floor(METRIC_H * 0.8);
      let lSum = 0, rSum = 0, lN = 0, rN = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < METRIC_W; x++) {
          const v = vals[y * METRIC_W + x];
          if (x < qW)               { lSum += v; lN++; }
          else if (x >= METRIC_W - qW) { rSum += v; rN++; }
        }
      }
      const wallSeparation = lN && rN ? Math.abs((lSum / lN) - (rSum / rN)) : 0;

      // Edge quality — Sobel magnitude, sampled every 4 px
      let sobel = 0, sobelN = 0;
      for (let y = 1; y < METRIC_H - 1; y += 4) {
        for (let x = 1; x < METRIC_W - 1; x += 4) {
          const gx = vals[y * METRIC_W + x + 1] - vals[y * METRIC_W + x - 1];
          const gy = vals[(y + 1) * METRIC_W + x] - vals[(y - 1) * METRIC_W + x];
          sobel += Math.sqrt(gx * gx + gy * gy);
          sobelN++;
        }
      }
      const edgeQuality = sobelN > 0 ? sobel / sobelN : 0;

      resolve({
        minDepth:        round3(mn),
        maxDepth:        round3(mx),
        contrast:        round3(mx - mn),
        floorGradient:   round3(floorGradient),
        wallSeparation:  round3(wallSeparation),
        edgeQuality:     round3(edgeQuality),
        histogram,
        depthResolution: `${origW} × ${origH}`,
      });
    };
    img.onerror = () => resolve({
      minDepth: 0, maxDepth: 0, contrast: 0, floorGradient: 0,
      wallSeparation: 0, edgeQuality: 0, histogram: new Array(16).fill(0),
      depthResolution: "unknown",
    });
    img.src = depthDataUrl;
  });
}

function round3(n: number) { return Math.round(n * 1000) / 1000; }

// ── Inferno colormap application ─────────────────────────────────────────────

function applyInferno(depthDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c   = document.createElement("canvas");
      c.width   = img.naturalWidth;
      c.height  = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const { data } = imgData;
      for (let i = 0; i < data.length; i += 4) {
        const t            = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
        const [r, g, b]    = infernoRgb(t);
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(depthDataUrl);
    img.src = depthDataUrl;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  originalUrl:       string;
  depthDataUrl:      string;          // grey depth PNG, data:image/png;base64,...
  colorDepthDataUrl?: string | null;  // pre-rendered colour depth from model (skips client inferno)
  origW:             number;
  origH:             number;
  onMetrics?:        (m: DepthMetrics) => void;
};

export function DepthViewer({
  originalUrl, depthDataUrl, colorDepthDataUrl, origW, origH, onMetrics,
}: Props) {
  const [mode,      setMode]      = useState<VisualizationMode>("color");
  const [colorUrl,  setColorUrl]  = useState<string | null>(colorDepthDataUrl ?? null);
  const [metrics,   setMetrics]   = useState<DepthMetrics | null>(null);
  const [computing, setComputing] = useState(true);

  // Keep a stable ref to onMetrics so the effect never re-runs just because
  // the parent passed a new inline arrow function on every render.
  const onMetricsRef = useRef(onMetrics);
  useEffect(() => { onMetricsRef.current = onMetrics; });

  useEffect(() => {
    let alive = true;
    setComputing(true);
    void (async () => {
      const [col, met] = await Promise.all([
        colorDepthDataUrl ? Promise.resolve(colorDepthDataUrl) : applyInferno(depthDataUrl),
        computeMetrics(depthDataUrl, origW, origH),
      ]);
      if (!alive) return;
      setColorUrl(col);
      setMetrics(met);
      setComputing(false);
      onMetricsRef.current?.(met);
    })();
    return () => { alive = false; };
  // onMetrics intentionally omitted — accessed via ref to avoid infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depthDataUrl, origW, origH]);

  const displayUrl = mode === "color" && colorUrl ? colorUrl : depthDataUrl;
  const colorLabel = colorDepthDataUrl ? "Replicate Color" : "Inferno";

  const observations = metrics ? [
    { label: "Floor is continuous",      ok: metrics.floorGradient  > 0.08 },
    { label: "Wall separation visible",  ok: metrics.wallSeparation > 0.04 },
    { label: "Object boundaries sharp",  ok: metrics.edgeQuality    > 0.04 },
    { label: "Perspective preserved",    ok: metrics.floorGradient  > 0.06 },
    { label: "Good depth contrast",      ok: metrics.contrast       > 0.40 },
  ] : [];

  return (
    <div className="space-y-4">

      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">View</span>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          {(["color", "grayscale"] as VisualizationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 font-medium capitalize transition-colors ${
                mode === m ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m === "color" ? colorLabel : "Grayscale"}
            </button>
          ))}
        </div>
        {computing && <span className="animate-pulse text-[10px] text-gray-400">Computing metrics…</span>}
      </div>

      {/* Side-by-side: original + depth */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Original</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={originalUrl} alt="Original" className="w-full rounded-lg border border-gray-100 object-cover" draggable={false} />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Depth · {mode === "color" ? colorLabel : "Grayscale"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt="Depth map" className="w-full rounded-lg border border-gray-100 object-cover" draggable={false} />
        </div>
      </div>

      {/* Full-width depth preview */}
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Full preview</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayUrl} alt="Depth map full" className="w-full rounded-xl border border-gray-100" draggable={false} />
        <div className="mt-1.5 flex justify-end">
          <a
            href={depthDataUrl}
            download="depth-map.png"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            ↓ Download depth map (PNG)
          </a>
        </div>
      </div>

      {/* Metrics grid */}
      {metrics && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quality Metrics</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["Min depth",    metrics.minDepth.toFixed(3)],
              ["Max depth",    metrics.maxDepth.toFixed(3)],
              ["Contrast",     metrics.contrast.toFixed(3)],
              ["Floor grad",   metrics.floorGradient.toFixed(3)],
              ["Wall sep",     metrics.wallSeparation.toFixed(3)],
              ["Edge quality", metrics.edgeQuality.toFixed(3)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="mt-0.5 font-bold tabular-nums text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Depth histogram */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Depth Histogram</p>
            <div className="flex h-14 items-end gap-px rounded-lg border border-gray-100 bg-gray-50 p-2">
              {metrics.histogram.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-indigo-500 transition-all"
                  style={{ height: `${Math.min(100, Math.round(v * 100 * 6))}%`, minHeight: v > 0 ? "2px" : "0" }}
                  title={`Bucket ${i}: ${(v * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[9px] text-gray-400">
              <span>Far / dark</span>
              <span>Near / bright</span>
            </div>
          </div>

          <p className="text-[9px] text-gray-400">
            Depth resolution: <span className="font-mono">{metrics.depthResolution}</span>
          </p>
        </div>
      )}

      {/* Observations */}
      {observations.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Observations</p>
          <div className="space-y-1">
            {observations.map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`text-sm font-bold leading-none ${ok ? "text-emerald-500" : "text-gray-300"}`}>
                  {ok ? "✓" : "✗"}
                </span>
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] text-gray-400">Heuristic — verify visually.</p>
        </div>
      )}
    </div>
  );
}
