"use client";

import { useEffect, useRef, useState } from "react";
import { runMask2Former }     from "@/lib/visualizerM2F/actions/runMask2Former";
import { runDepthEstimation } from "@/lib/visualizerM2F/actions/runDepthEstimation";
import { fetchTextureBase64 } from "@/lib/visualizerM2F/actions/fetchTextureBase64";
import { getCategory, getLabelColor } from "@/lib/visualizerM2F/labelMap";
import { generateSegOverlay, renderMarbleOnSurface } from "@/lib/visualizerM2F/renderUtils";
import { renderMaskHighlight } from "@/lib/visualizerM2F/maskUtils";
import { useFavorites } from "@/lib/visualizerM2F/useFavorites";
import {
  DEFAULT_TEXTURE_SETTINGS,
  DEFAULT_SLAB_SETTINGS,
  formatSlabDimensions,
} from "@/lib/visualizerM2F/types";
import type {
  PipelineSegResult,
  PipelineDepthResult,
  PipelineSegment,
  TextureSettings,
  SlabTexture,
  SlabSettings,
  RenderMode,
} from "@/lib/visualizerM2F/types";
import { TextureControls }  from "@/app/inventory/_components/visualizer-m2f/TextureControls";
import { SlabControls }     from "@/app/inventory/_components/visualizer-m2f/SlabControls";
import { DebugPanels }      from "@/app/inventory/_components/visualizer-m2f/DebugPanels";
import { TopBar }           from "@/app/inventory/_components/visualizer-m2f/TopBar";
import { Sidebar }          from "@/app/inventory/_components/visualizer-m2f/Sidebar";
import { SurfacePills }     from "@/app/inventory/_components/visualizer-m2f/SurfacePills";
import { BottomBar }        from "@/app/inventory/_components/visualizer-m2f/BottomBar";
import { ZoomLightbox }     from "@/app/inventory/_components/visualizer-m2f/ZoomLightbox";
import { CompareView }      from "@/app/inventory/_components/visualizer-m2f/CompareView";
import { EnquireModal }     from "@/app/inventory/_components/visualizer-m2f/EnquireModal";

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
  length?: number | null;
  width?: number | null;
};

type Props = {
  currentSlab: SlabOption;
  comparisons: SlabOption[];
  exitHref: string;
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

export function VisualizerM2F({ currentSlab, comparisons, exitHref }: Props) {
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

  // ── Debug panels (staff-only) ──────────────────────────────────────────────
  const [overlayUrl,       setOverlayUrl]       = useState<string | null>(null);
  const [maskHighlightUrl, setMaskHighlightUrl] = useState<string | null>(null);
  const [floorDebugUrl,    setFloorDebugUrl]    = useState<string | null>(null);
  const [showDebug,        setShowDebug]        = useState(false);

  // ── Slab layout ───────────────────────────────────────────────────────────
  const [renderMode,   setRenderMode]   = useState<RenderMode>("slab");
  const [slabSettings, setSlabSettings] = useState<SlabSettings>(DEFAULT_SLAB_SETTINGS);

  // ── Favorites (session-only) ───────────────────────────────────────────────
  const favorites = useFavorites();

  // ── Compare ───────────────────────────────────────────────────────────────
  const [compareOpen,       setCompareOpen]       = useState(false);
  const [compareRightSlab,  setCompareRightSlab]  = useState<{ id: string; slabCode: string; marbleName: string | null; thumbnailUrl: string | null } | null>(null);
  const [compareRightUrl,   setCompareRightUrl]   = useState<string | null>(null);
  const [compareRendering,  setCompareRendering]  = useState(false);

  // ── Zoom / Enquire / Share ────────────────────────────────────────────────
  const [zoomUrl,       setZoomUrl]       = useState<string | null>(null);
  const [enquireOpen,   setEnquireOpen]   = useState(false);
  const [lastSharedUrl, setLastSharedUrl] = useState<string | null>(null);

  // Room cache — Mask2Former + depth outputs and derived floor geometry,
  // computed once per photo and reused across slab/setting changes.
  const roomCacheRef = useRef<RoomCache | null>(null);

  // Pre-select the slab this page was opened for, while still allowing free
  // choice via the sidebar.
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
        length:       currentSlab.length ?? null,
        width:        currentSlab.width ?? null,
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
    setCompareRightUrl(null);
    setCompareRightSlab(null);

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

  function handleChangeRoom() {
    document.getElementById("m2f-file-input")?.click();
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
      } else {
        roomCacheRef.current.selectedCategory  = cat;
        roomCacheRef.current.surfaceMaskBases  = surfaceMaskBases;
        roomCacheRef.current.occluderMaskBases = occluderMaskBases;
      }
    }

    await applyTexture(cat, segs, settings);
  }

  async function applyTexture(
    cat:  string,
    segs: PipelineSegment[],
    cfg:  TextureSettings,
  ) {
    if (!photoUrl || !textureUrl || !segResult) return;

    const occluderSegs = segResult.segments.filter((s) => OCCLUDER_CATS.has(getCategory(s.label)));

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

  function handleApply() {
    if (selectedCat) void applyTexture(selectedCat, selectedSegs, settings);
  }

  function handleReset() {
    setSettings(DEFAULT_TEXTURE_SETTINGS);
    setSlabSettings(DEFAULT_SLAB_SETTINGS);
    setRenderMode("slab");
    if (selectedCat) void applyTexture(selectedCat, selectedSegs, DEFAULT_TEXTURE_SETTINGS);
  }

  function handleSelectSlabFromSidebar(slab: SlabTexture, b64: string) {
    setSelectedSlab(slab);
    setTextureUrl(b64);
  }

  async function handleSelectCompareSlab(slab: { id: string; slabCode: string; marbleName: string | null; thumbnailUrl: string | null }) {
    if (!roomCacheRef.current || !slab.thumbnailUrl) return;
    setCompareRightSlab(slab);
    setCompareRendering(true);
    try {
      const b64 = await fetchTextureBase64(slab.thumbnailUrl);
      if (!b64) return;
      const { compositeUrl } = await renderFromCache(
        roomCacheRef.current,
        b64,
        settings,
        renderMode,
        slabSettings,
      );
      setCompareRightUrl(compositeUrl);
    } finally {
      setCompareRendering(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const pipelineDone  = !!(segResult || depthResult) && !segRunning && !depthRunning;
  const shareableUrl  = renderUrl ?? photoUrl;
  const depthDisplayUrl = depthResult?.colorDepthBase64
    ? `data:image/png;base64,${depthResult.colorDepthBase64}`
    : depthResult?.depthBase64
    ? `data:image/png;base64,${depthResult.depthBase64}`
    : null;
  const currentSlabSize = formatSlabDimensions(selectedSlab?.length ?? null, selectedSlab?.width ?? null);

  const moreSettings = (
    <div className="max-h-[50vh] space-y-5 overflow-y-auto text-left">
      {selectedCat === "floor" && textureUrl && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Render mode</p>
          <div className="flex gap-2">
            {(["slab", "sequential", "repeat"] as RenderMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRenderMode(mode)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  renderMode === mode
                    ? "border-[#c8a96a] bg-[#c8a96a]/10 text-stone-900"
                    : "border-stone-200 bg-white text-stone-500 hover:border-[#c8a96a]/50"
                }`}
              >
                {mode === "slab" ? "Random Slabs" : mode === "sequential" ? "Sequential Slabs" : "Texture Repeat"}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCat === "floor" && (renderMode === "slab" || renderMode === "sequential") && textureUrl && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Slab layout</p>
          <SlabControls settings={slabSettings} onChange={setSlabSettings} />
        </div>
      )}

      {textureUrl && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Texture</p>
          <TextureControls settings={settings} onChange={setSettings} onApply={handleApply} rendering={renderRunning} />
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-[#faf8f5]">
      <TopBar
        exitHref={exitHref}
        productPageHref={`/inventory/slab/${currentSlab.id}`}
        isFavorite={favorites.isFavorite(currentSlab.id)}
        onToggleFavorite={() => favorites.toggle(currentSlab.id)}
        shareableUrl={shareableUrl}
        onZoom={() => shareableUrl && setZoomUrl(shareableUrl)}
        onCompare={() => setCompareOpen(true)}
        compareDisabled={!roomCacheRef.current}
        compareActive={compareOpen}
        onChangeRoom={handleChangeRoom}
        onEnquire={() => setEnquireOpen(true)}
        onToggleDebug={() => setShowDebug((v) => !v)}
        onReset={handleReset}
        onShared={setLastSharedUrl}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          segments={segResult?.segments ?? []}
          selectedCat={selectedCat}
          onSelectSurface={(cat, segs) => void handleSurfaceSelect(cat, segs)}
          selectedSlabId={selectedSlab?.id ?? null}
          onSelectSlab={handleSelectSlabFromSidebar}
          isFavorite={favorites.isFavorite}
          onToggleFavorite={favorites.toggle}
        />

        <div className="relative flex-1 overflow-hidden bg-[#0f0d0b]">
          <input
            id="m2f-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {!photoUrl ? (
            <div
              onClick={handleChangeRoom}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 text-center"
            >
              <span className="text-sm font-medium text-[#faf8f5]">Upload a room photo</span>
              <span className="text-xs text-stone-500">drag &amp; drop or click · JPEG · PNG · WebP</span>
            </div>
          ) : (
            <>
              {/* Blurred fill for letterboxed edges */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderUrl ?? photoUrl}
                alt=""
                aria-hidden="true"
                className="absolute -inset-7.5 h-[calc(100%+60px)] w-[calc(100%+60px)] scale-110 object-cover opacity-55 blur-3xl saturate-150"
              />

              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="relative max-h-full max-w-full overflow-hidden rounded-sm shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderUrl ?? photoUrl}
                    alt="Room preview"
                    className="max-h-[calc(100vh-220px)] max-w-full object-contain"
                    draggable={false}
                  />

                  {(segRunning || depthRunning) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="flex flex-col items-center gap-2 text-white">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c8a96a] border-t-transparent" />
                        <p className="text-xs">Analyzing room… (first run may take 1–2 min)</p>
                      </div>
                    </div>
                  )}

                  {segResult && !segRunning && (
                    <SurfacePills
                      segments={segResult.segments}
                      selected={selectedCat}
                      imgWidth={imgDims.w}
                      imgHeight={imgDims.h}
                      onSelect={(cat, segs) => void handleSurfaceSelect(cat, segs)}
                    />
                  )}
                </div>
              </div>

              <p className="absolute bottom-4 right-5 z-5 font-serif text-[13px] italic text-[#faf8f5]/55">
                Visualized by <span className="not-italic text-[#faf8f5]/80">Trivedi Grani Marmo</span>
              </p>

              {pipelineError && !segRunning && (
                <p className="absolute left-5 top-4 z-5 max-w-sm rounded-lg bg-red-950/80 px-3 py-2 text-xs text-red-200">
                  {pipelineError}
                </p>
              )}

              {textureUrl && selectedCat && selectedCat !== "stairs" && (
                <BottomBar
                  slab={selectedSlab ? {
                    thumbnailUrl: selectedSlab.thumbnailUrl,
                    name: selectedSlab.marbleName ?? selectedSlab.slabCode ?? "Selected slab",
                    size: currentSlabSize,
                  } : null}
                  settings={settings}
                  onSettingsChange={setSettings}
                  slabSettings={slabSettings}
                  onSlabSettingsChange={setSlabSettings}
                  onApply={handleApply}
                  rendering={renderRunning}
                  onReset={handleReset}
                  moreSettings={moreSettings}
                  floorControlsDisabled={selectedCat !== "floor"}
                />
              )}
            </>
          )}
        </div>
      </div>

      {zoomUrl && <ZoomLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />}

      {compareOpen && shareableUrl && (
        <CompareView
          onClose={() => setCompareOpen(false)}
          leftUrl={shareableUrl}
          leftLabel={selectedSlab?.marbleName ?? selectedSlab?.slabCode ?? "Current selection"}
          comparisons={comparisons.filter((c) => c.id !== currentSlab.id)}
          rightSlabId={compareRightSlab?.id ?? null}
          onSelectRight={(slab) => void handleSelectCompareSlab(slab)}
          rightUrl={compareRightUrl}
          rightLabel={compareRightSlab?.marbleName ?? compareRightSlab?.slabCode ?? null}
          rightRendering={compareRendering}
        />
      )}

      <EnquireModal
        open={enquireOpen}
        onClose={() => setEnquireOpen(false)}
        slabCode={selectedSlab?.slabCode ?? null}
        marbleName={selectedSlab?.marbleName ?? null}
        dimensions={currentSlabSize}
        renderShareUrl={lastSharedUrl}
      />

      {/* Debug panels — staff toggle, normal document flow below the app shell */}
      {showDebug && (photo || pipelineDone) && (
        <div className="border-t border-stone-200 bg-white p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-500">Debug</p>
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
            <div className="mt-4 border-t border-stone-100 pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Floor geometry — largest CC · extracted quadrilateral
              </p>
              {renderRunning && selectedCat === "floor" && !floorDebugUrl ? (
                <div className="flex h-32 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c8a96a] border-t-transparent" />
                </div>
              ) : floorDebugUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={floorDebugUrl}
                  alt="Floor geometry debug"
                  className="max-h-72 w-full rounded-xl border border-stone-200 object-contain"
                  draggable={false}
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
