"use client";

import { useRef, useState } from "react";
import { runBenchmark }           from "../_actions/runBenchmark";
import { MODEL_META, MODEL_KEYS } from "../_lib/modelMeta";
import type { BenchmarkResult, ModelKey } from "../_lib/types";
import { ModelCard }       from "./ModelCard";
import { ComparisonTable } from "./ComparisonTable";
import { TestImagePicker } from "./TestImagePicker";

export function BenchmarkClient() {
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Image state ──────────────────────────────────────────────────────────────
  const [photo,    setPhoto]    = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgDims,  setImgDims]  = useState({ w: 0, h: 0 });

  // ── Model selection ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<ModelKey>>(
    new Set(["mask2former", "segformer-b5"] as ModelKey[]),
  );

  // ── Results ──────────────────────────────────────────────────────────────────
  const [results, setResults] = useState<Record<string, BenchmarkResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function loadFile(file: File) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setPhoto(file);
    setImageUrl(url);
    setResults({});
    setRunning(new Set());
    setImgDims({ w: 0, h: 0 });

    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  function toggleModel(key: ModelKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runSelected() {
    if (!photo || selected.size === 0) return;

    const keysToRun = [...selected] as ModelKey[];

    // Mark running, clear previous results for these models
    setRunning(new Set(keysToRun));
    setResults((prev) => {
      const next = { ...prev };
      keysToRun.forEach((k) => delete next[k]);
      return next;
    });

    await Promise.all(
      keysToRun.map(async (key) => {
        const fd = new FormData();
        fd.append("model",  key);
        fd.append("photo",  photo);
        fd.append("width",  String(imgDims.w));
        fd.append("height", String(imgDims.h));

        try {
          const res = await runBenchmark(fd);
          setResults((prev) => ({ ...prev, [key]: res }));
        } catch (e) {
          const m = MODEL_META[key];
          setResults((prev) => ({
            ...prev,
            [key]: {
              modelKey:    key,
              modelName:   m.name,
              segments:    [],
              inferenceMs: 0,
              rawOutput:   null,
              error:       e instanceof Error ? e.message : String(e),
            },
          }));
        } finally {
          setRunning((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }),
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const anyRunning = running.size > 0;
  const anyDone    = Object.keys(results).length > 0;
  const goodResults = Object.values(results).filter((r) => !r.error && r.segments.length > 0);

  // Cards to show: selected models ∪ models with results ∪ models currently running
  const keysToShow = MODEL_KEYS.filter(
    (k) => selected.has(k) || results[k] !== undefined || running.has(k),
  );

  const gridCols =
    keysToShow.length === 1 ? "grid-cols-1 max-w-lg"
    : keysToShow.length === 2 ? "grid-cols-1 md:grid-cols-2"
    : "grid-cols-1 md:grid-cols-3";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* ── Header ── */}
        <div className="rounded-2xl border border-violet-200 bg-linear-to-r from-violet-50 to-indigo-50 px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-bold text-white">
              RESEARCH LAB
            </span>
            <span className="text-xs text-gray-400">debug only · isolated from production</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Computer Vision Benchmark Lab</h1>
          <p className="mt-1 text-sm text-gray-600">
            Objectively compare semantic segmentation models on identical images before choosing
            one for production. Provider:{" "}
            <strong className="text-gray-800">Replicate</strong>.
          </p>
        </div>

        {/* ── Setup: image + model selector ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Image selector */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              1. Select Image
            </p>

            {/* Upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.type.startsWith("image/")) loadFile(f);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-5 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
            >
              {imageUrl && photo ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-16 rounded-xl border border-gray-200 object-cover shadow-sm"
                    draggable={false}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{photo.name}</p>
                    <p className="text-xs text-gray-400">
                      {Math.round(photo.size / 1024)} KB
                      {imgDims.w > 0 && ` · ${imgDims.w}×${imgDims.h}`}
                    </p>
                    <p className="mt-1 text-[10px] text-indigo-500">Click to change</p>
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Test dataset */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Or pick from test dataset
              </p>
              <TestImagePicker onSelect={loadFile} />
            </div>
          </div>

          {/* Model selector + Run button */}
          <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              2. Select Models
            </p>

            <div className="flex-1 space-y-2">
              {MODEL_KEYS.map((key) => {
                const m = MODEL_META[key];
                const checked = selected.has(key);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all ${
                      checked
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModel(key)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900">{m.name}</span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] text-gray-500">
                          {m.dataset}
                        </span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] text-gray-500">
                          {m.task}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{m.description}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-gray-400">
                        env: {m.versionEnvKey}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={!photo || selected.size === 0 || anyRunning}
                onClick={() => void runSelected()}
                className="w-full rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {anyRunning
                  ? `Running ${running.size} model${running.size > 1 ? "s" : ""}…`
                  : `Run ${selected.size} model${selected.size !== 1 ? "s" : ""}`}
              </button>

              {!photo && (
                <p className="text-center text-xs text-gray-400">Select an image first</p>
              )}
              {anyRunning && (
                <p className="text-center text-xs text-amber-600">
                  Cold starts can take 30–120s per model. Check terminal for live logs.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Results grid ── */}
        {(anyRunning || anyDone) && imgDims.w > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold text-gray-900">Results</h2>
            <div className={`grid gap-4 ${gridCols}`}>
              {keysToShow.map((key) => (
                <ModelCard
                  key={key}
                  meta={MODEL_META[key]}
                  result={results[key] ?? null}
                  running={running.has(key)}
                  roomUrl={imageUrl!}
                  imgW={imgDims.w}
                  imgH={imgDims.h}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Comparison table ── */}
        {goodResults.length >= 2 && (
          <div>
            <h2 className="mb-3 text-base font-bold text-gray-900">Model Comparison</h2>
            <ComparisonTable results={results} />
          </div>
        )}

        {/* ── Empty state ── */}
        {!anyRunning && !anyDone && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
              Getting started
            </p>
            <ol className="space-y-1.5 text-sm text-gray-600">
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">1</span>
                Add model version hashes to{" "}
                <code className="rounded bg-gray-100 px-1 font-mono text-xs">.env.local</code>
                {" "}(see model cards for env var names)
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">2</span>
                Upload a room photo or pick one from the test dataset
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">3</span>
                Select one or more models and click Run
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">4</span>
                Compare results — then pick the best model for production
              </li>
            </ol>
          </div>
        )}

      </div>
    </div>
  );
}
