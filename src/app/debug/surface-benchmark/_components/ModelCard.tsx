"use client";

import { useState, useEffect, useRef } from "react";
import type { BenchmarkResult, Segment } from "../_lib/types";
import type { ModelMeta } from "../_lib/modelMeta";
import { getCategory, getLabelColor } from "../_lib/labelMap";
import { MaskGrid }      from "./MaskGrid";
import { RawJsonViewer } from "./RawJsonViewer";

// ─── Canvas helpers ───────────────────────────────────────────────────────────

async function measureCoverage(maskBase64: string, w: number, h: number): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const { data } = c.getContext("2d")!.getImageData(0, 0, w, h);
      let white = 0;
      for (let i = 0; i < w * h; i++) {
        if ((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 > 128) white++;
      }
      resolve(Math.round((white / (w * h)) * 1000) / 10);
    };
    img.onerror = () => resolve(0);
    img.src = `data:image/png;base64,${maskBase64}`;
  });
}

async function buildOverlay(
  roomUrl: string,
  segments: Segment[],
  w: number,
  h: number,
): Promise<string> {
  return new Promise((resolve) => {
    const room = new Image();
    room.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(room, 0, 0, w, h);
      const roomPx = ctx.getImageData(0, 0, w, h);

      const out = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        out.data[i * 4]     = Math.round(roomPx.data[i * 4]     * 0.3);
        out.data[i * 4 + 1] = Math.round(roomPx.data[i * 4 + 1] * 0.3);
        out.data[i * 4 + 2] = Math.round(roomPx.data[i * 4 + 2] * 0.3);
        out.data[i * 4 + 3] = 255;
      }

      for (const seg of segments) {
        const [r, g, b] = getLabelColor(seg.label);
        await new Promise<void>((done) => {
          const mi = new Image();
          mi.onload = () => {
            const mc = document.createElement("canvas");
            mc.width = w; mc.height = h;
            mc.getContext("2d")!.drawImage(mi, 0, 0, w, h);
            const md = mc.getContext("2d")!.getImageData(0, 0, w, h).data;
            for (let i = 0; i < w * h; i++) {
              if ((md[i * 4] + md[i * 4 + 1] + md[i * 4 + 2]) / 3 > 128) {
                out.data[i * 4]     = Math.round(roomPx.data[i * 4]     * 0.25 + r * 0.75);
                out.data[i * 4 + 1] = Math.round(roomPx.data[i * 4 + 1] * 0.25 + g * 0.75);
                out.data[i * 4 + 2] = Math.round(roomPx.data[i * 4 + 2] * 0.25 + b * 0.75);
              }
            }
            done();
          };
          mi.onerror = () => done();
          mi.src = `data:image/png;base64,${seg.maskBase64}`;
        });
      }

      ctx.putImageData(out, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    room.onerror = () => resolve("");
    room.src = roomUrl;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SegMeta = {
  label:       string;
  coveragePct: number;
  color:       [number, number, number];
  isKey:       boolean;
};

// ─── ModelCard ────────────────────────────────────────────────────────────────

type Props = {
  meta:    ModelMeta;
  result:  BenchmarkResult | null;
  running: boolean;
  roomUrl: string;
  imgW:    number;
  imgH:    number;
};

// Extracts "Prediction ID: <id>" from an error string, if present.
function extractPredId(msg: string): string | null {
  const m = /Prediction ID: ([\w_-]+)/.exec(msg);
  return m?.[1] ?? null;
}

export function ModelCard({ meta, result, running, roomUrl, imgW, imgH }: Props) {
  const [overlayUrl,   setOverlayUrl]   = useState<string | null>(null);
  const [segMetas,     setSegMetas]     = useState<SegMeta[]>([]);
  const [processedId,  setProcessedId]  = useState<string | null>(null);
  const [showMasks,    setShowMasks]    = useState(false);

  // ── Elapsed timer (client-side) ──────────────────────────────────────────────
  const [elapsed, setElapsed]   = useState(0);
  const startRef                = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const iv = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(iv);
    } else {
      startRef.current = null;
    }
  }, [running]);

  // Unique ID for the current result so we only process each result once.
  const resultId = result && !result.error
    ? `${result.modelKey}-${result.inferenceMs}-${result.segments.length}`
    : null;

  useEffect(() => {
    if (!resultId || resultId === processedId) return;
    if (!result || result.segments.length === 0) return;

    setProcessedId(resultId);

    void (async () => {
      const covs = await Promise.all(
        result.segments.map((s) => measureCoverage(s.maskBase64, imgW, imgH)),
      );
      setSegMetas(result.segments.map((s, i) => ({
        label:       s.label,
        coveragePct: covs[i],
        color:       getLabelColor(s.label),
        isKey:       getCategory(s.label) !== "other",
      })));

      const url = await buildOverlay(roomUrl, result.segments, imgW, imgH);
      setOverlayUrl(url);
    })();
  }, [resultId, processedId, result, roomUrl, imgW, imgH]);

  // Reset when result is cleared (new run started).
  useEffect(() => {
    if (!result) {
      setOverlayUrl(null);
      setSegMetas([]);
      setProcessedId(null);
      setShowMasks(false);
    }
  }, [result]);

  const keySurfaces   = segMetas.filter((m) => m.isKey).sort((a, b) => b.coveragePct - a.coveragePct);
  const otherSurfaces = segMetas.filter((m) => !m.isKey).sort((a, b) => b.coveragePct - a.coveragePct);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900">{meta.name}</h3>
          <p className="text-xs text-gray-500">{meta.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {result && !result.error && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {(result.inferenceMs / 1000).toFixed(1)}s
            </span>
          )}
          {running && (
            <span className="animate-pulse rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {elapsed}s
            </span>
          )}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] text-gray-400">
            {meta.versionEnvKey}
          </span>
        </div>
      </div>

      {/* ── Error ── */}
      {result?.error && (() => {
        const msg    = result.error;
        const predId = extractPredId(msg);
        const isTimeout  = msg.includes("Timed out");
        const isNotSet   = msg.includes("is not set");
        const isApiError = predId && !isTimeout;
        return (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              {isTimeout ? "Timeout" : "Error"}
            </p>
            <p className="text-xs text-red-700">{msg}</p>
            {isTimeout && predId && (
              <div className="rounded-lg border border-red-200 bg-red-100 px-2.5 py-2">
                <p className="text-[10px] font-semibold text-red-600">Prediction timed out</p>
                <p className="mt-0.5 font-mono text-[10px] text-red-500">
                  Prediction ID: {predId}
                </p>
                <p className="mt-1 text-[10px] text-red-400">
                  Increase timeout or check model cold-start time on replicate.com
                </p>
              </div>
            )}
            {isApiError && (
              <p className="font-mono text-[10px] text-red-500">Prediction ID: {predId}</p>
            )}
            {isNotSet && (
              <p className="text-[10px] text-red-500">
                Add{" "}
                <code className="rounded bg-red-100 px-1 font-mono">{meta.versionEnvKey}=&lt;hash&gt;</code>
                {" "}to .env.local and restart the dev server.
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Image pair: original + overlay ── */}
      {result && !result.error && imgW > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Original
            </p>
            <div
              className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
              style={{ aspectRatio: `${imgW}/${imgH}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={roomUrl} alt="Original" className="h-full w-full object-cover" draggable={false} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Segmentation
            </p>
            <div
              className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
              style={{ aspectRatio: `${imgW}/${imgH}` }}
            >
              {overlayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={overlayUrl} alt="Overlay" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="flex h-full w-full animate-pulse items-center justify-center bg-gray-200">
                  <span className="text-[10px] text-gray-400">
                    {result.segments.length > 0 ? "Building overlay…" : "No segments"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Running skeleton + progress ── */}
      {running && !result && (
        <div className="space-y-2">
          {/* Progress info */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-indigo-700">
              Running {meta.name}…
            </p>
            <div className="flex items-center gap-3 text-[11px] text-indigo-600">
              <span>Elapsed: <strong className="tabular-nums">{elapsed}s</strong></span>
              <span>·</span>
              <span>
                Current status:{" "}
                <strong>{elapsed < 7 ? "starting" : "processing"}</strong>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-indigo-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-1000"
                style={{ width: `${Math.min(95, (elapsed / (meta.timeoutMs / 1000)) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-indigo-400">
              Timeout: {meta.timeoutMs / 1000}s · Cold starts may take longer
            </p>
          </div>

          {/* Image skeletons */}
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-gray-200"
                style={{ aspectRatio: `${imgW || 4}/${imgH || 3}` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Detected surfaces ── */}
      {keySurfaces.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Detected Surfaces · {segMetas.length} total
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {keySurfaces.map((m) => (
              <div
                key={m.label}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2"
              >
                <div
                  className="h-3 w-3 shrink-0 rounded-sm border border-white shadow-sm"
                  style={{ backgroundColor: `rgb(${m.color.join(",")})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium capitalize text-gray-800">{m.label}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-1 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, m.coveragePct * 3)}%`,
                          backgroundColor: `rgb(${m.color.join(",")})`,
                        }}
                      />
                    </div>
                    <span className="tabular-nums text-[9px] text-gray-500">{m.coveragePct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {otherSurfaces.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] font-semibold text-gray-400 hover:text-gray-600">
                + {otherSurfaces.length} other classes
              </summary>
              <div className="mt-1.5 space-y-0.5 pl-1">
                {otherSurfaces.map((m) => (
                  <div key={m.label} className="flex items-center justify-between rounded px-1 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: `rgb(${m.color.join(",")})` }}
                      />
                      <span className="text-[10px] capitalize text-gray-600">{m.label}</span>
                    </div>
                    <span className="tabular-nums text-[9px] text-gray-400">{m.coveragePct}%</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Individual masks toggle ── */}
      {result && !result.error && result.segments.length > 0 && (
        <button
          type="button"
          onClick={() => setShowMasks((v) => !v)}
          className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
        >
          {showMasks ? "▴" : "▾"} Individual Masks
        </button>
      )}

      {showMasks && result && !result.error && (
        <MaskGrid segments={result.segments} roomUrl={roomUrl} imgW={imgW} imgH={imgH} />
      )}

      {/* ── Raw JSON ── */}
      {result && <RawJsonViewer result={result} />}

      {/* ── Empty state ── */}
      {!running && !result && (
        <div className="py-8 text-center text-xs text-gray-400">Not run yet</div>
      )}
    </div>
  );
}
