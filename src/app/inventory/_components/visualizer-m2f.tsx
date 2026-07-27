"use client";

import { useEffect, useRef, useState } from "react";
import { runMask2Former }     from "@/app/debug/combined-visualizer-test/_actions/runMask2Former";
import { runDepthEstimation } from "@/app/debug/combined-visualizer-test/_actions/runDepthEstimation";
import { fetchTextureBase64 } from "@/app/debug/combined-visualizer-test/_actions/fetchTextureBase64";
import { getCategory, getLabelColor } from "@/app/debug/surface-benchmark/_lib/labelMap";
import { generateSegOverlay, renderMarbleOnSurface } from "@/app/debug/combined-visualizer-test/_lib/renderUtils";
import { renderMaskHighlight } from "@/app/debug/combined-visualizer-test/_lib/maskUtils";
import {
  DEFAULT_TEXTURE_SETTINGS,
  DEFAULT_SLAB_SETTINGS,
} from "@/app/debug/combined-visualizer-test/_lib/types";
import type {
  PipelineSegResult,
  PipelineDepthResult,
  PipelineSegment,
  TextureSettings,
  SlabTexture,
  SlabSettings,
  RenderMode,
} from "@/app/debug/combined-visualizer-test/_lib/types";
import { SurfaceSelector }   from "@/app/debug/combined-visualizer-test/_components/SurfaceSelector";
import { TextureControls }  from "@/app/debug/combined-visualizer-test/_components/TextureControls";
import { DebugPanels }      from "@/app/debug/combined-visualizer-test/_components/DebugPanels";
import { BeforeAfter }      from "@/app/debug/combined-visualizer-test/_components/BeforeAfter";
import { SlabTexturePicker } from "@/app/debug/combined-visualizer-test/_components/SlabTexturePicker";
import { SlabControls }     from "@/app/debug/combined-visualizer-test/_components/SlabControls";

import type { RoomCache } from "@/lib/visualizerM2F/RoomCache";
import { roomCacheManagerM2F } from "@/lib/visualizerM2F/RoomCacheManager";
import { renderFromCache } from "@/lib/visualizerM2F/renderFromCache";

// Occluder categories: objects that should NOT be covered by the marble texture
const OCCLUDER_CATS = new Set(["furniture", "fixture"]);
const OVERLAY_MAX    = 960; // cap overlay generation for speed

type SlabOption = {
  id: string;
  slabCode: string;
  marbleName: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
};

type Props = {
  currentSlab: SlabOption;
  comparisons: SlabOption[];
};

// ─── Client-side helpers ──────────────────────────────────────────────────────

async function compressPhoto(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1500;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], "room.jpg", { type: "image/jpeg" }) : file);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function measureImage(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1024, h: 768 });
    img.src     = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizerM2F({ currentSlab }: Props) {
  // ── Image ─────────────────────────────────────────────────────────────────
  const [photo,    setPhoto]    = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imgDims,  setImgDims]  = useState({ w: 0, h: 0 });
  const prevPhotoUrl = useRef<string | null>(null);

  // ── Pipeline results ──────────────────────────────────────────────────────
  const [segResult,   setSegResult]   = useState<PipelineSegResult | null>(null);
  const [depthResult, setDepthResult] = useState<PipelineDepthResult | null>(null);
  const [segRunning,  setSegRunning]  = useState(false);
  const [depthRunning, setDepthRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // ── Surface selection ─────────────────────────────────────────────────────
  const [selectedCat,  setSelectedCat]  = useState<string | null>(null);
  const [selectedSegs, setSelectedSegs] = useState<PipelineSegment[]>([]);

  // ── Texture ───────────────────────────────────────────────────────────────
  const [textureUrl,   setTextureUrl]   = useState<string | null>(null);
  const [selectedSlab, setSelectedSlab] = useState<SlabTexture | null>(null);
  const [settings,     setSettings]     = useState<TextureSettings>(DEFAULT_TEXTURE_SETTINGS);
  const [renderUrl,    setRenderUrl]    = useState<string | null>(null);
  const [renderRunning, setRenderRunning] = useState(false);

  // ── Debug panels (staff-only, matches "Debug panels / UV debug / Grid debug / Slab debug") ──
  const [overlayUrl,       setOverlayUrl]       = useState<string | null>(null);
  const [maskHighlightUrl, setMaskHighlightUrl] = useState<string | null>(null);
  const [floorDebugUrl,    setFloorDebugUrl]    = useState<string | null>(null);
  const [showDebug,        setShowDebug]        = useState(false);
  const [uvDebug,          setUVDebug]          = useState(false);
  const [checkerboard,     setCheckerboard]     = useState(false);
  const [debugSlab,        setDebugSlab]        = useState(false);

  // ── Slab layout ───────────────────────────────────────────────────────────
  const [renderMode,   setRenderMode]   = useState<RenderMode>("slab");
  const [slabSettings, setSlabSettings] = useState<SlabSettings>(DEFAULT_SLAB_SETTINGS);

  // Roomvo-style room cache — Mask2Former + depth outputs and derived floor
  // geometry, computed once per photo and reused across slab/setting changes.
  const roomCacheRef = useRef<RoomCache | null>(null);

  // Pre-select the slab this page was opened for (matches the old visualizer's
  // "currentSlab" behavior) while still allowing free choice via SlabTexturePicker.
  useEffect(() => {
    if (!currentSlab.imageUrl) return;
    let cancelled = false;
    void fetchTextureBase64(currentSlab.imageUrl).then((b64) => {
      if (cancelled || !b64) return;
      setSelectedSlab({
        id:           currentSlab.id,
        slabCode:     currentSlab.slabCode,
        marbleName:   currentSlab.marbleName,
        lotNumber:    null,
        thumbnailUrl: currentSlab.thumbnailUrl ?? currentSlab.imageUrl!,
      });
      setTextureUrl(b64);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (prevPhotoUrl.current) URL.revokeObjectURL(prevPhotoUrl.current); };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    const compressed = await compressPhoto(file);

    if (prevPhotoUrl.current) URL.revokeObjectURL(prevPhotoUrl.current);
    const url = URL.createObjectURL(compressed);
    prevPhotoUrl.current = url;

    const dims = await measureImage(url);

    // New photo → invalidate any previous room cache
    if (roomCacheRef.current) roomCacheManagerM2F.removeRoom(roomCacheRef.current.roomId);
    roomCacheRef.current = null;

    setPhoto(compressed);
    setPhotoUrl(url);
    setImgDims(dims);
    setSegResult(null);
    setDepthResult(null);
    setOverlayUrl(null);
    setMaskHighlightUrl(null);
    setRenderUrl(null);
    setFloorDebugUrl(null);
    setSelectedCat(null);
    setSelectedSegs([]);
    setPipelineError(null);

    await runPipeline(compressed, url, dims);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) void handleFile(f);
  }

  // AI runs automatically once a photo is selected — no manual "Run pipeline" step.
  async function runPipeline(
    currentPhoto: File,
    currentPhotoUrl: string,
    dims: { w: number; h: number },
  ) {
    setSegRunning(true);
    setDepthRunning(true);

    const W = String(dims.w);
    const H = String(dims.h);

    console.log("Production visualizer: AI started");

    await Promise.all([
      (async () => {
        try {
          const r = await runMask2Former(currentPhoto, W, H);
          setSegResult(r);
          if (r.error) setPipelineError(r.error);

          if (!r.error && r.segments.length > 0) {
            const scale = Math.min(1, OVERLAY_MAX / Math.max(dims.w || 1, dims.h || 1));
            const oW    = Math.round((dims.w || 800) * scale);
            const oH    = Math.round((dims.h || 600) * scale);
            const ov    = await generateSegOverlay(currentPhotoUrl, r.segments, getLabelColor, oW, oH);
            setOverlayUrl(ov);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setSegResult({ segments: [], inferenceMs: 0, error: msg });
          setPipelineError(msg);
        } finally {
          setSegRunning(false);
        }
      })(),
      (async () => {
        try {
          const r = await runDepthEstimation(currentPhoto, W, H);
          setDepthResult(r);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setDepthResult({ depthBase64: null, colorDepthBase64: null, inferenceMs: 0, error: msg });
        } finally {
          setDepthRunning(false);
        }
      })(),
    ]);
  }

  async function handleSurfaceSelect(cat: string, segs: PipelineSegment[]) {
    setSelectedCat(cat);
    setSelectedSegs(segs);
    setRenderUrl(null);

    if (photoUrl && imgDims.w > 0) {
      const scale = Math.min(1, OVERLAY_MAX / Math.max(imgDims.w, imgDims.h));
      const W     = Math.round(imgDims.w * scale);
      const H     = Math.round(imgDims.h * scale);
      const COLOR_MAP: Record<string, [number, number, number]> = {
        floor:      [128,  64, 128],
        wall:       [ 70, 130, 180],
        ceiling:    [200, 200,  80],
        stairs:     [200, 120,  80],
        countertop: [180, 140,  80],
      };
      const color = COLOR_MAP[cat] ?? [99, 102, 241];
      const hi    = await renderMaskHighlight(photoUrl, segs.map((s) => s.maskBase64), color, W, H);
      setMaskHighlightUrl(hi);
    }

    if (cat === "stairs") return;

    // Roomvo-style cache: build (or refresh) the RoomCache used by renderFromCache
    // so marble/setting changes on the floor never re-run Mask2Former/Depth or
    // the largest-CC/quad/homography geometry.
    if (cat === "floor" && photoUrl && segResult) {
      const occluderSegs = segResult.segments.filter((s) => OCCLUDER_CATS.has(getCategory(s.label)));
      const surfaceMaskBases  = segs.map((s) => s.maskBase64);
      const occluderMaskBases = occluderSegs.map((s) => s.maskBase64);

      if (!roomCacheRef.current) {
        const room: RoomCache = {
          roomId:    roomCacheManagerM2F.generateRoomId(),
          createdAt: Date.now(),
          imgWidth:  imgDims.w,
          imgHeight: imgDims.h,
          photoUrl,
          segResult,
          depthResult,
          selectedCategory:  cat,
          surfaceMaskBases,
          occluderMaskBases,
          geometry: null,
        };
        roomCacheManagerM2F.saveRoom(room);
        roomCacheRef.current = room;
        console.log("Production visualizer: room cached");
      } else {
        roomCacheRef.current.selectedCategory  = cat;
        roomCacheRef.current.surfaceMaskBases  = surfaceMaskBases;
        roomCacheRef.current.occluderMaskBases = occluderMaskBases;
      }
    }

    await applyTexture(cat, segs, settings);
  }

  async function applyTexture(
    cat:       string,
    segs:      PipelineSegment[],
    cfg:       TextureSettings,
    dbgUV?:    boolean,
    dbgGrid?:  boolean,
    dbgSlab?:  boolean,
  ) {
    if (!photoUrl || !textureUrl || !segResult) return;

    const occluderSegs = segResult.segments.filter((s) => OCCLUDER_CATS.has(getCategory(s.label)));

    const useDebugUV      = cat === "floor" && (dbgUV   ?? uvDebug);
    const useCheckerboard = cat === "floor" && (dbgGrid ?? checkerboard);
    const useDebugSlab    = cat === "floor" && (dbgSlab ?? debugSlab);

    setRenderRunning(true);
    setFloorDebugUrl(null);
    try {
      if (cat === "floor") {
        if (!roomCacheRef.current) return;
        const { compositeUrl, debugUrl } = await renderFromCache(
          roomCacheRef.current,
          textureUrl,
          cfg,
          renderMode,
          slabSettings,
          { debugUV: useDebugUV, debugCheckerboard: useCheckerboard, debugSlab: useDebugSlab },
        );
        setRenderUrl(compositeUrl);
        setFloorDebugUrl(debugUrl);
      } else {
        const compositeUrl = await renderMarbleOnSurface({
          originalDataUrl:   photoUrl,
          textureDataUrl:    textureUrl,
          surfaceMaskBases:  segs.map((s) => s.maskBase64),
          occluderMaskBases: occluderSegs.map((s) => s.maskBase64),
          settings:          cfg,
          width:             imgDims.w,
          height:            imgDims.h,
        });
        setRenderUrl(compositeUrl);
      }
    } catch (e) {
      console.error("[VisualizerM2F] Render error:", e);
    } finally {
      setRenderRunning(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const pipelineDone  = !!(segResult || depthResult) && !segRunning && !depthRunning;
  const anyRunning    = segRunning || depthRunning;
  const depthDisplayUrl = depthResult?.colorDepthBase64
    ? `data:image/png;base64,${depthResult.colorDepthBase64}`
    : depthResult?.depthBase64
    ? `data:image/png;base64,${depthResult.depthBase64}`
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          Room photo
        </p>
        <div
          onClick={() => document.getElementById("m2f-file-input")?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-8 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
        >
          {photoUrl && photo ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Preview" className="h-16 rounded-xl border border-gray-200 object-cover shadow-sm" draggable={false} />
              <div>
                <p className="text-sm font-semibold text-gray-700">{photo.name}</p>
                <p className="text-xs text-gray-400">{Math.round(photo.size / 1024)} KB</p>
                <p className="mt-0.5 text-[10px] text-indigo-400">Click to change</p>
              </div>
            </div>
          ) : (
            <>
              <span className="text-3xl">🖼</span>
              <span className="text-sm font-medium text-gray-700">Upload a room photo</span>
              <span className="text-xs text-gray-400">drag &amp; drop or click · JPEG · PNG · WebP</span>
            </>
          )}
          <input
            id="m2f-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {anyRunning && (
          <p className="mt-3 flex items-center gap-2 text-xs text-indigo-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            Analyzing room… (first run may take 1–2 min to warm up)
          </p>
        )}
        {pipelineError && !anyRunning && (
          <p className="mt-3 text-xs text-red-600">{pipelineError}</p>
        )}
      </div>

      {/* Surface selection */}
      {segResult && !segRunning && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Select surface to apply marble
          </p>
          {segResult.error ? (
            <p className="text-sm text-red-600">{segResult.error}</p>
          ) : (
            <SurfaceSelector
              segments={segResult.segments}
              selected={selectedCat}
              onSelect={(cat, segs) => void handleSurfaceSelect(cat, segs)}
            />
          )}
        </div>
      )}

      {/* Texture settings (shown once a surface is selected) */}
      {selectedCat && selectedCat !== "stairs" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Texture settings
          </p>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Select marble from inventory
            </p>
            <SlabTexturePicker
              selectedId={selectedSlab?.id ?? null}
              onSelect={(slab, b64) => {
                setSelectedSlab(slab);
                setTextureUrl(b64);
              }}
            />
          </div>

          {selectedCat === "floor" && textureUrl && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Render mode
              </p>
              <div className="flex gap-2">
                {(["slab", "sequential", "repeat"] as RenderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRenderMode(mode)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      renderMode === mode
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-500 hover:border-indigo-300"
                    }`}
                  >
                    {mode === "slab" ? "Random Slabs" : mode === "sequential" ? "Sequential Slabs" : "Texture Repeat"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedCat === "floor" && (renderMode === "slab" || renderMode === "sequential") && textureUrl && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Slab layout settings
              </p>
              <SlabControls settings={slabSettings} onChange={setSlabSettings} />
            </div>
          )}

          {textureUrl && selectedSlab && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Selected · {selectedSlab.marbleName ?? selectedSlab.slabCode ?? selectedSlab.id}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={textureUrl}
                  alt="Selected texture"
                  className="h-32 w-full rounded-xl border border-gray-100 object-cover"
                />
              </div>
              <TextureControls
                settings={settings}
                onChange={setSettings}
                onApply={() => void applyTexture(selectedCat, selectedSegs, settings)}
                rendering={renderRunning}
              />
            </div>
          )}

          {!textureUrl && (
            <p className="text-xs text-gray-400">← Pick a slab above to enable texture controls.</p>
          )}
        </div>
      )}

      {/* Result */}
      {renderUrl && photoUrl && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Result</p>
          <BeforeAfter beforeUrl={photoUrl} afterUrl={renderUrl} downloadUrl={renderUrl} />
        </div>
      )}

      {depthResult?.error && !depthRunning && (
        <p className="text-xs text-red-600">Depth Anything V2: {depthResult.error}</p>
      )}

      {/* Debug panels — staff toggle */}
      {(photo || pipelineDone) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Debug</p>
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="text-[10px] font-medium text-gray-400 hover:text-gray-600"
            >
              {showDebug ? "▲ hide" : "▼ show"}
            </button>
          </div>
          {showDebug && (
            <>
              <DebugPanels
                originalUrl={photoUrl}
                overlayUrl={overlayUrl}
                maskHighlightUrl={maskHighlightUrl}
                depthUrl={depthDisplayUrl}
                renderUrl={renderUrl}
                segRunning={segRunning}
                depthRunning={depthRunning}
                renderRunning={renderRunning}
              />

              {(floorDebugUrl || (renderRunning && selectedCat === "floor")) && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Floor geometry — largest CC · extracted quadrilateral
                    </p>
                    {selectedCat === "floor" && (
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-indigo-600">
                          <input
                            type="checkbox"
                            checked={uvDebug}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setUVDebug(next);
                              if (next) { setCheckerboard(false); setDebugSlab(false); }
                              if (selectedCat && selectedSegs.length > 0 && textureUrl) {
                                void applyTexture(selectedCat, selectedSegs, settings, next, false, false);
                              }
                            }}
                            className="h-3 w-3 rounded"
                          />
                          UV debug (U=red, V=green)
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-amber-600">
                          <input
                            type="checkbox"
                            checked={checkerboard}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setCheckerboard(next);
                              if (next) { setUVDebug(false); setDebugSlab(false); }
                              if (selectedCat && selectedSegs.length > 0 && textureUrl) {
                                void applyTexture(selectedCat, selectedSegs, settings, false, next, false);
                              }
                            }}
                            className="h-3 w-3 rounded"
                          />
                          Grid debug
                        </label>
                        {(renderMode === "slab" || renderMode === "sequential") && (
                          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-emerald-600">
                            <input
                              type="checkbox"
                              checked={debugSlab}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setDebugSlab(next);
                                if (next) { setUVDebug(false); setCheckerboard(false); }
                                if (selectedCat && selectedSegs.length > 0 && textureUrl) {
                                  void applyTexture(selectedCat, selectedSegs, settings, false, false, next);
                                }
                              }}
                              className="h-3 w-3 rounded"
                            />
                            {renderMode === "sequential" ? "UV continuity lines" : "Slab debug (col:row labels)"}
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  {renderRunning && selectedCat === "floor" && !floorDebugUrl ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                        <p className="text-[10px] text-indigo-500">Analysing floor…</p>
                      </div>
                    </div>
                  ) : floorDebugUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={floorDebugUrl}
                      alt="Floor geometry debug"
                      className="max-h-72 w-full rounded-xl border border-gray-100 object-contain"
                      draggable={false}
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
