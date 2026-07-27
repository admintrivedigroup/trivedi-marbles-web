"use client";

import { useCallback, useRef, useState } from "react";
import { runDepthBenchmark }          from "../_actions/runDepthBenchmark";
import { MODEL_META, MODEL_IDS }      from "../_lib/modelMeta";
import type { DepthResult, DepthMetrics, ModelId } from "../_lib/types";
import { ModelCard }       from "./ModelCard";
import { ComparisonTable } from "./ComparisonTable";
import { TestImagePicker } from "./TestImagePicker";

export function BenchmarkClient() {
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Image state ──────────────────────────────────────────────────────────────
  const [photo,    setPhoto]    = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imgDims,  setImgDims]  = useState({ w: 0, h: 0 });

  // ── Model selection (default: all three) ─────────────────────────────────────
  const [selected, setSelected] = useState<Set<ModelId>>(new Set(MODEL_IDS));

  // ── Results + metrics ────────────────────────────────────────────────────────
  const [results,  setResults]  = useState<Record<string, DepthResult>>({});
  const [running,  setRunning]  = useState<Set<string>>(new Set());
  const [metrics,  setMetrics]  = useState<Record<string, DepthMetrics | null>>({});

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function loadFile(file: File) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(file);
    setPhoto(file);
    setPhotoUrl(url);
    setResults({});
    setRunning(new Set());
    setMetrics({});
    setImgDims({ w: 0, h: 0 });

    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  function toggleModel(id: ModelId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runSelected() {
    if (!photo || selected.size === 0) return;

    const toRun = [...selected] as ModelId[];

    console.log("[DepthBench] Starting:", {
      file: photo.name, size: `${Math.round(photo.size / 1024)}KB`, models: toRun,
    });

    setRunning(new Set(toRun));
    setResults((prev) => {
      const next = { ...prev };
      toRun.forEach((k) => delete next[k]);
      return next;
    });
    setMetrics((prev) => {
      const next = { ...prev };
      toRun.forEach((k) => { next[k] = null; });
      return next;
    });

    await Promise.all(
      toRun.map(async (id) => {
        console.log(`[DepthBench] → ${id}`);
        const fd = new FormData();
        fd.append("modelId", id);
        fd.append("photo",   photo);
        fd.append("width",   String(imgDims.w));
        fd.append("height",  String(imgDims.h));
        try {
          const res = await runDepthBenchmark(fd);
          console.log(`[DepthBench] ← ${id}:`, res.error ?? `${(res.inferenceMs / 1000).toFixed(1)}s`);
          setResults((prev) => ({ ...prev, [id]: res }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[DepthBench] ✗ ${id}:`, e);
          setResults((prev) => ({
            ...prev,
            [id]: { modelId: id, modelName: MODEL_META[id].name, depthBase64: null, colorDepthBase64: null, inferenceMs: 0, rawOutput: null, error: `Unexpected error: ${msg}` },
          }));
        } finally {
          setRunning((prev) => { const n = new Set(prev); n.delete(id); return n; });
        }
      }),
    );
  }

  const handleMetrics = useCallback((modelId: ModelId, m: DepthMetrics) => {
    setMetrics((prev) => ({ ...prev, [modelId]: m }));
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const anyRunning = running.size > 0;
  const anyDone    = Object.keys(results).length > 0;
  // Always show all 3 model columns side-by-side once a run starts,
  // so results can be compared at a glance even if only 1 model ran.
  const showGrid   = anyRunning || anyDone;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Header */}
        <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-indigo-50 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-600 px-2.5 py-0.5 text-xs font-bold text-white">
              RESEARCH LAB
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Provider: Replicate
            </span>
            <span className="text-xs text-gray-400">debug only · isolated from production</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Computer Vision Research Lab
          </h1>
          <p className="mt-0.5 text-lg font-semibold text-gray-700">Depth Estimation Benchmark</p>
          <p className="mt-1 text-sm text-gray-500">
            Objectively compare monocular depth models on identical room photos before integrating
            one into the marble visualizer. Results do not affect any production code.
          </p>
        </div>

        {/* Setup panel */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Left: image picker */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              1. Select Room Photo
            </p>

            {/* Upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) loadFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-5 transition-colors hover:border-cyan-400 hover:bg-cyan-50"
            >
              {photoUrl && photo ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Preview" className="h-16 rounded-xl border border-gray-200 object-cover shadow-sm" draggable={false} />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{photo.name}</p>
                    <p className="text-xs text-gray-400">
                      {Math.round(photo.size / 1024)} KB
                      {imgDims.w > 0 && ` · ${imgDims.w}×${imgDims.h}`}
                    </p>
                    <p className="mt-1 text-[10px] text-cyan-500">Click to change</p>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-3xl">🖼</span>
                  <span className="text-sm font-medium text-gray-700">Upload a room photo</span>
                  <span className="text-xs text-gray-400">drag & drop or click · JPEG · PNG · WebP</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
              />
            </div>

            {/* Test image picker */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Or choose from test dataset
              </p>
              <TestImagePicker onSelect={loadFile} />
            </div>
          </div>

          {/* Right: model selector + run */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              2. Select Models
            </p>

            <div className="mb-5 space-y-2">
              {MODEL_IDS.map((id) => {
                const meta  = MODEL_META[id];
                const isSel = selected.has(id);
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${
                      isSel ? "border-cyan-400 bg-cyan-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleModel(id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{meta.name}</p>
                      <p className="text-xs text-gray-500">{meta.description}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Env: <code className="font-mono">{meta.versionEnvKey}</code>
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Run button */}
            <button
              type="button"
              disabled={!photo || selected.size === 0 || anyRunning}
              onClick={() => {
                console.log("[DepthBench] Run button clicked");
                void runSelected();
              }}
              className="w-full rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {anyRunning
                ? `Running ${running.size} model${running.size > 1 ? "s" : ""}…`
                : `Run ${selected.size} selected model${selected.size !== 1 ? "s" : ""}`}
            </button>

            {anyRunning && (
              <p className="mt-2 text-center text-xs text-gray-400">
                Models run in parallel · cold starts: 30–120 s · check terminal for logs
              </p>
            )}

            {/* Env var hints */}
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                Required .env.local keys
              </p>
              <div className="space-y-0.5">
                {MODEL_IDS.map((id) => (
                  <p key={id} className="font-mono text-[10px] text-amber-800">
                    {MODEL_META[id].versionEnvKey}=&lt;replicate-version-hash&gt;
                  </p>
                ))}
                <p className="mt-1 font-mono text-[10px] text-amber-800">
                  REPLICATE_API_TOKEN=r8_…
                </p>
              </div>
              <p className="mt-1.5 text-[10px] text-amber-600">
                Find version hashes on replicate.com for each model.
              </p>
            </div>
          </div>
        </div>

        {/* Results grid — always 3 columns so all models can be compared */}
        {showGrid && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {MODEL_IDS.map((id) => (
                <ModelCard
                  key={id}
                  modelId={id}
                  result={results[id] ?? null}
                  running={running.has(id)}
                  photoUrl={photoUrl ?? ""}
                  origW={imgDims.w}
                  origH={imgDims.h}
                  onMetrics={handleMetrics}
                />
              ))}
            </div>

            {/* Comparison table — only when at least one has metrics */}
            {Object.values(metrics).some(Boolean) && (
              <div>
                <h2 className="mb-3 text-base font-bold text-gray-900">Comparison Table</h2>
                <ComparisonTable results={results} metrics={metrics} />
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!showGrid && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Upload a room photo and select at least one model to start the benchmark.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Each model produces a per-pixel depth estimate. Results are compared on floor gradient,
              wall separation, edge sharpness, and overall depth contrast.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
