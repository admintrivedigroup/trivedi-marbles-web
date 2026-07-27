"use client";

import { useEffect, useRef, useState } from "react";
import { runMask2Former }     from "../_actions/runMask2Former";
import { runDepthEstimation } from "../_actions/runDepthEstimation";
import { getCategory, getLabelColor } from "../../surface-benchmark/_lib/labelMap";
import { generateSegOverlay, renderMarbleOnSurface } from "../_lib/renderUtils";
import { renderMaskHighlight } from "../_lib/maskUtils";
import { DEFAULT_TEXTURE_SETTINGS, DEFAULT_SLAB_SETTINGS } from "../_lib/types";
import type { PipelineSegResult, PipelineDepthResult, PipelineSegment, TextureSettings, SlabTexture, SlabSettings, RenderMode } from "../_lib/types";
import { ImagePicker }       from "./ImagePicker";
import { SurfaceSelector }   from "./SurfaceSelector";
import { TextureControls }   from "./TextureControls";
import { DebugPanels }       from "./DebugPanels";
import { BeforeAfter }       from "./BeforeAfter";
import { SlabTexturePicker } from "./SlabTexturePicker";
import { SlabControls }     from "./SlabControls";

// Shared Room Cache utilities (already built for the production visualizer) —
// reused here as-is so this debug page also renders from cached room data
// instead of re-running the perspective renderer's geometry stage every time.
import type { RoomCache } from "@/lib/visualizerM2F/RoomCache";
import { roomCacheManagerM2F } from "@/lib/visualizerM2F/RoomCacheManager";
import { renderFromCache } from "@/lib/visualizerM2F/renderFromCache";

// Occluder categories: objects that should NOT be covered by the marble texture
const OCCLUDER_CATS = new Set(["furniture", "fixture"]);

const OVERLAY_MAX = 960; // cap overlay generation for speed

export function CombinedVisualizerClient() {
  // ── Image ─────────────────────────────────────────────────────────────────
  const [photo,    setPhoto]    = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imgDims,  setImgDims]  = useState({ w: 0, h: 0 });

  // ── Pipeline results ──────────────────────────────────────────────────────
  const [segResult,   setSegResult]   = useState<PipelineSegResult | null>(null);
  const [depthResult, setDepthResult] = useState<PipelineDepthResult | null>(null);
  const [segRunning,  setSegRunning]  = useState(false);
  const [depthRunning, setDepthRunning] = useState(false);

  // ── Surface selection ─────────────────────────────────────────────────────
  const [selectedCat,  setSelectedCat]  = useState<string | null>(null);
  const [selectedSegs, setSelectedSegs] = useState<PipelineSegment[]>([]);

  // ── Texture ───────────────────────────────────────────────────────────────
  const [textureUrl,   setTextureUrl]   = useState<string | null>(null);
  const [selectedSlab, setSelectedSlab] = useState<SlabTexture | null>(null);
  const [settings,     setSettings]     = useState<TextureSettings>(DEFAULT_TEXTURE_SETTINGS);
  const [renderUrl,  setRenderUrl]  = useState<string | null>(null);
  const [renderRunning, setRenderRunning] = useState(false);

  // ── Debug panels ──────────────────────────────────────────────────────────
  const [overlayUrl,       setOverlayUrl]       = useState<string | null>(null);
  const [maskHighlightUrl, setMaskHighlightUrl] = useState<string | null>(null);
  const [floorDebugUrl,    setFloorDebugUrl]    = useState<string | null>(null);
  const [showDebug,        setShowDebug]        = useState(true);
  const [uvDebug,          setUVDebug]          = useState(false);
  const [checkerboard,     setCheckerboard]     = useState(false);
  const [debugSlab,        setDebugSlab]        = useState(false);

  // ── Slab layout state ────────────────────────────────────────────────────
  const [renderMode,   setRenderMode]   = useState<RenderMode>("slab");
  const [slabSettings, setSlabSettings] = useState<SlabSettings>(DEFAULT_SLAB_SETTINGS);

  // ── Room cache ────────────────────────────────────────────────────────────
  // Populated once the floor surface is selected (segmentation + depth are
  // already done by then). Marble/setting changes reuse this instead of
  // re-running Mask2Former, Depth Anything V2, or the floor-geometry stage.
  const roomCacheRef = useRef<RoomCache | null>(null);
  const [roomCached, setRoomCached] = useState(false);

  // Cleanup blob URLs
  const prevPhotoUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => { if (prevPhotoUrl.current) URL.revokeObjectURL(prevPhotoUrl.current); };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function loadFile(file: File) {
    if (prevPhotoUrl.current) URL.revokeObjectURL(prevPhotoUrl.current);
    const url = URL.createObjectURL(file);
    prevPhotoUrl.current = url;

    // New photo → new room. Invalidate any previously cached room so the next
    // floor selection builds a fresh RoomCache instead of reusing stale geometry.
    if (roomCacheRef.current) roomCacheManagerM2F.removeRoom(roomCacheRef.current.roomId);
    roomCacheRef.current = null;
    setRoomCached(false);

    setPhoto(file);
    setPhotoUrl(url);
    setSegResult(null);
    setDepthResult(null);
    setOverlayUrl(null);
    setMaskHighlightUrl(null);
    setRenderUrl(null);
    setFloorDebugUrl(null);
    setSelectedCat(null);
    setSelectedSegs([]);
    setImgDims({ w: 0, h: 0 });

    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  async function runPipeline() {
    if (!photo || !photoUrl) return;
    setSegRunning(true);
    setDepthRunning(true);
    setSegResult(null);
    setDepthResult(null);
    setOverlayUrl(null);
    setMaskHighlightUrl(null);
    setRenderUrl(null);
    setFloorDebugUrl(null);
    setSelectedCat(null);

    const W = String(imgDims.w);
    const H = String(imgDims.h);

    console.log("AI pipeline started");

    await Promise.all([
      // ── Segmentation ─────────────────────────────────────────────────────
      (async () => {
        try {
          console.log("[CombinedViz] → Mask2Former");
          const r = await runMask2Former(photo, W, H);
          console.log(`[CombinedViz] ← Mask2Former: ${r.segments.length} segments, ${r.error ?? "ok"}`);
          setSegResult(r);

          if (!r.error && r.segments.length > 0) {
            const scale = Math.min(1, OVERLAY_MAX / Math.max(imgDims.w || 1, imgDims.h || 1));
            const oW    = Math.round((imgDims.w || 800) * scale);
            const oH    = Math.round((imgDims.h || 600) * scale);
            const ov    = await generateSegOverlay(photoUrl, r.segments, getLabelColor, oW, oH);
            setOverlayUrl(ov);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[CombinedViz] Mask2Former threw:", msg);
          setSegResult({ segments: [], inferenceMs: 0, error: msg });
        } finally {
          setSegRunning(false);
        }
      })(),

      // ── Depth ─────────────────────────────────────────────────────────────
      (async () => {
        try {
          console.log("[CombinedViz] → Depth Anything V2");
          const r = await runDepthEstimation(photo, W, H);
          console.log(`[CombinedViz] ← Depth: ${r.inferenceMs}ms, ${r.error ?? "ok"}`);
          setDepthResult(r);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[CombinedViz] Depth threw:", msg);
          setDepthResult({ depthBase64: null, colorDepthBase64: null, inferenceMs: 0, error: msg });
        } finally {
          setDepthRunning(false);
        }
      })(),
    ]);

    console.log("AI pipeline completed");
  }

  async function handleSurfaceSelect(cat: string, segs: PipelineSegment[]) {
    setSelectedCat(cat);
    setSelectedSegs(segs);
    setRenderUrl(null);

    // Show mask highlight in debug panel
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

    // Skip actual rendering for stairs (not implemented yet)
    if (cat === "stairs") return;

    // Build (or refresh) the RoomCache used by renderFromCache — segmentation
    // and depth are already done at this point, so this is pure data assembly,
    // not another AI call.
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
        setRoomCached(true);
        console.log(`Room cached: ${room.roomId}`);
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

    // Params take precedence over state — avoids stale closure when toggles fire
    const useDebugUV      = cat === "floor" && (dbgUV   ?? uvDebug);
    const useCheckerboard = cat === "floor" && (dbgGrid ?? checkerboard);
    const useDebugSlab    = cat === "floor" && (dbgSlab ?? debugSlab);

    const job = {
      originalDataUrl:    photoUrl,
      textureDataUrl:     textureUrl,
      surfaceMaskBases:   segs.map((s) => s.maskBase64),
      occluderMaskBases:  occluderSegs.map((s) => s.maskBase64),
      settings:           cfg,
      width:              imgDims.w,
      height:             imgDims.h,
      renderMode:         cat === "floor" ? renderMode : "repeat" as RenderMode,
      slabSettings,
      debugUV:            useDebugUV,
      debugCheckerboard:  useCheckerboard,
      debugSlab:          useDebugSlab,
    };

    setRenderRunning(true);
    setFloorDebugUrl(null);
    try {
      if (cat === "floor") {
        if (!roomCacheRef.current) return;

        const hadGeometry = !!roomCacheRef.current.geometry;
        console.log(`Rendering from cache: ${roomCacheRef.current.roomId}`);
        if (hadGeometry) console.log("AI skipped: using cached room");

        // Cache-aware renderer: reuses the cached largest-CC/quad/homography
        // (computed once) instead of re-running that geometry stage — the
        // math itself (perspectiveRenderer.ts) is untouched.
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
        // Non-floor surfaces (wall, ceiling, countertop): flat tiling
        const compositeUrl = await renderMarbleOnSurface(job);
        setRenderUrl(compositeUrl);
      }
    } catch (e) {
      console.error("[CombinedViz] Render error:", e);
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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Header */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold text-white">RESEARCH LAB</span>
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">Step 6 — Combined Pipeline</span>
            <span className="text-xs text-gray-400">debug only · isolated from production</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Combined Visualizer Test</h1>
          <p className="mt-1 text-sm text-gray-500">
            Runs Mask2Former (surface detection) + Depth Anything V2 in parallel → select a surface → apply marble texture.
            Proves the end-to-end pipeline before production integration.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-500">
            <span className="rounded bg-white/60 px-2 py-0.5">MASK2FORMER_VERSION</span>
            <span className="rounded bg-white/60 px-2 py-0.5">DEPTH_ANYTHING_V2_VERSION</span>
            <span className="rounded bg-white/60 px-2 py-0.5">REPLICATE_API_TOKEN</span>
          </div>
        </div>

        {/* Step 1 + 2: Image & Run */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Image picker */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">1. Select room photo</p>
            <ImagePicker photo={photo} photoUrl={photoUrl} onFile={loadFile} />
          </div>

          {/* Run + status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">2. Run AI pipeline</p>

            {/* Model status */}
            <div className="space-y-2">
              <ModelStatus label="Mask2Former" running={segRunning} result={segResult} />
              <ModelStatus label="Depth Anything V2" running={depthRunning} result={depthResult} />
            </div>

            <button
              type="button"
              disabled={!photo || anyRunning}
              onClick={() => void runPipeline()}
              className="w-full rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {anyRunning ? "Running pipeline…" : "Run Mask2Former + Depth"}
            </button>

            {anyRunning && (
              <p className="text-center text-xs text-gray-400">
                Models run in parallel · cold starts: 30–120 s
              </p>
            )}

            {roomCached && (
              <p className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                ✓ Room processed and cached
              </p>
            )}
          </div>
        </div>

        {/* Step 3: Surface selection (shown after segmentation completes) */}
        {segResult && !segRunning && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              3. Select surface to tile
            </p>

            {segResult.error ? (
              <ErrorBox message={segResult.error} label="Segmentation" />
            ) : (
              <SurfaceSelector
                segments={segResult.segments}
                selected={selectedCat}
                onSelect={(cat, segs) => void handleSurfaceSelect(cat, segs)}
              />
            )}
          </div>
        )}

        {/* Step 4: Texture controls (shown once surface selected) */}
        {selectedCat && selectedCat !== "stairs" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              4. Texture settings
            </p>

            {/* Slab picker */}
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

            {/* Render mode toggle (floor only) */}
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

            {/* Slab settings (floor + either slab mode) */}
            {selectedCat === "floor" && (renderMode === "slab" || renderMode === "sequential") && textureUrl && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Slab layout settings
                </p>
                <SlabControls settings={slabSettings} onChange={setSlabSettings} />
              </div>
            )}

            {/* Selected slab name + preview + controls */}
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
                  {selectedSlab.lotNumber && (
                    <p className="mt-1 text-[10px] text-gray-400">Lot {selectedSlab.lotNumber}</p>
                  )}
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

        {/* Step 5: Before / After (shown once rendering completes) */}
        {renderUrl && photoUrl && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">5. Result</p>
            <BeforeAfter beforeUrl={photoUrl} afterUrl={renderUrl} downloadUrl={renderUrl} />
          </div>
        )}

        {/* Depth error */}
        {depthResult?.error && !depthRunning && (
          <ErrorBox message={depthResult.error} label="Depth Anything V2" />
        )}

        {/* Debug panels */}
        {(photo || pipelineDone) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Debug panels</p>
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

                {/* Floor geometry debug: largest CC (green) + perspective quad */}
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
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModelStatus({
  label,
  running,
  result,
}: {
  label:   string;
  running: boolean;
  result:  { inferenceMs: number; error: string | null } | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {running ? (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
      ) : result ? (
        result.error ? (
          <div className="h-3 w-3 rounded-full bg-red-400" />
        ) : (
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        )
      ) : (
        <div className="h-3 w-3 rounded-full bg-gray-200" />
      )}
      <span className="text-sm text-gray-700">{label}</span>
      {result && !result.error && !running && (
        <span className="ml-auto text-xs text-emerald-600">
          {(result.inferenceMs / 1000).toFixed(1)}s
        </span>
      )}
      {running && (
        <span className="ml-auto animate-pulse text-xs text-purple-500">Running…</span>
      )}
    </div>
  );
}

function ErrorBox({ message, label }: { message: string; label: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-semibold text-red-700">{label} error</p>
      <p className="mt-0.5 break-words text-xs text-red-600">{message}</p>
    </div>
  );
}
