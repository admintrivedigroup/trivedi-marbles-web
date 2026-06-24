"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Download,
  FlipHorizontal,
  Layers2,
  Loader2,
  RefreshCw,
  Scan,
} from "lucide-react";

import {
  classifySurface,
  detectSurface,
  renderVisualization,
  type SurfaceType,
} from "@/app/inventory/_actions/visualize";
import { renderFloorLocally } from "@/lib/visualizer/renderFloorTexture";
import type { Quad } from "@/lib/visualizer/perspective";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "upload"
  | "tap"
  | "segmenting"
  | "rendering"
  | "floor_correction"
  | "result"
  | "error";

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

// Composite AI result with original photo using a blur-threshold mask.
//
// Why blur instead of erode/feather:
//   SAM masks have small interior holes (isolated preserve-pixels inside the floor region).
//   Erosion amplified those holes into blocky patches.
//   Blurring the mask pulls interior holes toward the surrounding floor value (alpha≈0),
//   filling them, while pushing isolated stray floor pixels near walls toward alpha≈255,
//   preventing bleed onto furniture/walls — all in one pass.
async function compositeResult(
  originalFile: File,
  aiResultDataUrl: string,
  alphaMaskDataUrl: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const SIZE = 1024;
    const origUrl = URL.createObjectURL(originalFile);

    const origImg = new Image();
    const aiImg = new Image();
    const maskImg = new Image();

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 3) return;

      URL.revokeObjectURL(origUrl);

      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(origImg, 0, 0, SIZE, SIZE);
      const origData = ctx.getImageData(0, 0, SIZE, SIZE);

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(aiImg, 0, 0, SIZE, SIZE);
      const aiData = ctx.getImageData(0, 0, SIZE, SIZE);

      // Draw mask with a blur so:
      //   • small preserve-islands inside the floor collapse → use AI (fills holes)
      //   • AI floor pixels near walls/furniture boundaries stay collapsed → preserve original
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.filter = "blur(8px)";
      ctx.drawImage(maskImg, 0, 0, SIZE, SIZE);
      ctx.filter = "none";
      const blurred = ctx.getImageData(0, 0, SIZE, SIZE);

      const out = ctx.createImageData(SIZE, SIZE);
      for (let i = 0; i < out.data.length; i += 4) {
        // blurred alpha ≈ 0   → solidly inside floor → use AI result
        // blurred alpha ≈ 255 → non-floor or near edge → preserve original photo
        // threshold at 100: conservative — never bleeds AI onto walls
        const useAi = blurred.data[i + 3] < 100;
        out.data[i]     = useAi ? aiData.data[i]     : origData.data[i];
        out.data[i + 1] = useAi ? aiData.data[i + 1] : origData.data[i + 1];
        out.data[i + 2] = useAi ? aiData.data[i + 2] : origData.data[i + 2];
        out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    const onError = (e: unknown) => { URL.revokeObjectURL(origUrl); reject(e); };
    origImg.onload = aiImg.onload = maskImg.onload = onLoad;
    origImg.onerror = aiImg.onerror = maskImg.onerror = onError;

    origImg.src = origUrl;
    aiImg.src = aiResultDataUrl;
    maskImg.src = alphaMaskDataUrl;
  });
}

// Convert SAM raw mask (white = surface) to OpenAI alpha mask (alpha=0 = editable).
async function buildAlphaMask(rawMaskDataUrl: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const out = ctx.createImageData(width, height);
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = 0;
        out.data[i + 3] = brightness > 128 ? 0 : 255;
      }
      ctx.putImageData(out, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = rawMaskDataUrl;
  });
}

// Creates a bookmatched slab by placing the original and its mirror side by side.
async function createBookmatchedDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blobUrl = URL.createObjectURL(await res.blob());
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = W * 2;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.save();
        ctx.translate(W * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

const SURFACE_LABELS: Record<SurfaceType, string> = {
  floor: "Floor",
  wall: "Wall",
  countertop: "Countertop",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizerAI({ currentSlab, comparisons }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const [roomPreviewUrl, setRoomPreviewUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  const [tapDisplay, setTapDisplay] = useState<{ pct: { x: number; y: number } } | null>(null);

  const [alphaMaskBase64, setAlphaMaskBase64] = useState<string | null>(null);

  const [activeSlab, setActiveSlab] = useState<SlabOption>(currentSlab);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [loadingMsg, setLoadingMsg] = useState("");

  const [bookmatch, setBookmatch] = useState(false);
  const [surfaceType, setSurfaceType] = useState<SurfaceType | null>(null);

  // ── Floor correction state ───────────────────────────────────────────────────
  // rawMaskDataUrl: original Replicate output used as a red debug overlay in floor_correction phase
  const [rawMaskDataUrl, setRawMaskDataUrl] = useState<string | null>(null);
  // Corners the staff has tapped to manually define the floor quad
  type FloorCorner = { pct: { x: number; y: number }; natural: { x: number; y: number } };
  const [manualFloorCorners, setManualFloorCorners] = useState<FloorCorner[]>([]);
  // The quad that was actually used for the last successful floor render (auto or manual).
  // Cached so slab comparisons and bookmatch toggles reuse it without re-running SAM.
  const [lastFloorQuad, setLastFloorQuad] = useState<Quad | null>(null);

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    const compressed = await compressPhoto(file);
    const previewUrl = URL.createObjectURL(compressed);
    setCompressedPhoto(compressed);
    setRoomPreviewUrl(previewUrl);
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setSurfaceType(null);
    setPhase("tap");
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

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (phase !== "tap") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    setTapDisplay({ pct: { x: pctX, y: pctY } });
    const pixelX = Math.round(pctX * imgNatural.w);
    const pixelY = Math.round(pctY * imgNatural.h);
    void runPipeline(pixelX, pixelY);
  }

  async function runPipeline(pixelX: number, pixelY: number) {
    if (!compressedPhoto) return;

    try {
      setPhase("segmenting");
      setLoadingMsg("Detecting surface… (first run may take 1–2 min to warm up)");

      const detectFd = new FormData();
      detectFd.append("photo", compressedPhoto);
      detectFd.append("pointX", String(pixelX));
      detectFd.append("pointY", String(pixelY));

      const classifyFd = new FormData();
      classifyFd.append("photo", compressedPhoto);
      classifyFd.append("pointX", String(pixelX));
      classifyFd.append("pointY", String(pixelY));
      classifyFd.append("naturalWidth", String(imgNatural.w));
      classifyFd.append("naturalHeight", String(imgNatural.h));

      // Run segmentation and surface classification in parallel to avoid added latency
      let detectedSurfaceType: SurfaceType | null = null;
      const [detectResult] = await Promise.all([
        detectSurface(detectFd),
        classifySurface(classifyFd).then((r) => {
          if (r.surfaceType) {
            detectedSurfaceType = r.surfaceType;
            setSurfaceType(r.surfaceType);
          }
        }),
      ]);

      if (detectResult.error || !detectResult.rawMaskBase64) {
        setErrorMsg(detectResult.error ?? "Surface detection returned no mask.");
        setPhase("error");
        return;
      }

      // Store raw Replicate mask for the floor-correction debug overlay
      setRawMaskDataUrl(detectResult.rawMaskBase64);

      const alphaMask = await buildAlphaMask(detectResult.rawMaskBase64, imgNatural.w, imgNatural.h);
      setAlphaMaskBase64(alphaMask);

      await runRender(alphaMask, activeSlab, detectedSurfaceType, bookmatch);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  async function runRender(
    alphaMask: string,
    slab: SlabOption,
    currentSurfaceType: SurfaceType | null,
    currentBookmatch: boolean,
    /** Explicit floor quad (from manual 4-point or cached from last render). */
    overrideQuad?: Quad,
  ) {
    if (!compressedPhoto || !slab.imageUrl) return;

    setPhase("rendering");

    // ── Floor: deterministic Canvas projection — no GPT Image 1 ──────────────
    if (currentSurfaceType === "floor") {
      setLoadingMsg("Projecting slab onto floor…");
      try {
        const output = await renderFloorLocally({
          roomPhotoFile: compressedPhoto,
          alphaMaskDataUrl: alphaMask,
          slabImageUrl: slab.imageUrl,
          bookmatch: currentBookmatch,
          imgWidth: imgNatural.w,
          imgHeight: imgNatural.h,
          // Use explicit override first, then fall back to the last cached quad
          // (enables slab-swap without re-running SAM or manual-corner entry)
          manualQuad: overrideQuad ?? lastFloorQuad ?? undefined,
        });
        setResultUrl(output.dataUrl);
        setLastFloorQuad(output.floorQuad); // cache for future slab swaps
        setActiveSlab(slab);
        setPhase("result");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Floor rendering failed.";
        if (msg.startsWith("NEEDS_MANUAL_FLOOR:")) {
          // Auto-detection produced an unreliable mask — ask staff to tap 4 corners
          setManualFloorCorners([]);
          setPhase("floor_correction");
          return;
        }
        setErrorMsg(msg);
        setPhase("error");
      }
      return;
    }

    // ── Wall / countertop / unknown: GPT Image 1 inpainting ──────────────────
    setLoadingMsg("Generating visualization…");

    // Build bookmatched slab reference client-side before sending to server
    let slabImageBase64: string | null = null;
    if (currentBookmatch) {
      slabImageBase64 = await createBookmatchedDataUrl(slab.imageUrl);
    }

    const renderFd = new FormData();
    renderFd.append("photo", compressedPhoto);
    renderFd.append("alphaMaskBase64", alphaMask);
    if (slabImageBase64) {
      renderFd.append("slabImageBase64", slabImageBase64);
    } else {
      renderFd.append("slabImageUrl", slab.imageUrl);
    }
    renderFd.append("marbleName", slab.marbleName ?? slab.slabCode);
    if (currentSurfaceType) renderFd.append("surfaceType", currentSurfaceType);
    renderFd.append("bookmatch", String(currentBookmatch));

    const { resultBase64, error: renderError } = await renderVisualization(renderFd);

    if (renderError || !resultBase64) {
      setErrorMsg(renderError ?? "Rendering failed.");
      setPhase("error");
      return;
    }

    const composited = await compositeResult(compressedPhoto, resultBase64, alphaMask);
    setResultUrl(composited);
    setActiveSlab(slab);
    setPhase("result");
  }

  async function handleCompareSlab(slab: SlabOption) {
    if (!alphaMaskBase64) return;
    await runRender(alphaMaskBase64, slab, surfaceType, bookmatch);
  }

  async function handleBookmatchToggle() {
    const newBookmatch = !bookmatch;
    setBookmatch(newBookmatch);
    // Re-render immediately if a result already exists
    if (phase === "result" && alphaMaskBase64) {
      await runRender(alphaMaskBase64, activeSlab, surfaceType, newBookmatch);
    }
  }

  function handleDownload() {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${activeSlab.slabCode}-visualization.jpg`;
    link.click();
  }

  // ── Floor correction: collect 4 corners from staff clicks ──────────────────

  const CORNER_LABELS = ["Back-left", "Back-right", "Front-right", "Front-left"] as const;

  function handleFloorCornerClick(e: React.MouseEvent<HTMLImageElement>) {
    // Ignore clicks once 4 corners are selected (render already in progress)
    if (manualFloorCorners.length >= 4) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    const corner = {
      pct: { x: pctX, y: pctY },
      natural: {
        x: Math.round(pctX * imgNatural.w),
        y: Math.round(pctY * imgNatural.h),
      },
    };

    const next = [...manualFloorCorners, corner];
    setManualFloorCorners(next);

    if (next.length === 4 && alphaMaskBase64) {
      const quad: Quad = [
        next[0].natural,
        next[1].natural,
        next[2].natural,
        next[3].natural,
      ] as Quad;
      void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, quad);
    }
  }

  function resetToTap() {
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setErrorMsg(null);
    setSurfaceType(null);
    setManualFloorCorners([]);
    setLastFloorQuad(null);
    setPhase("tap");
  }

  function resetAll() {
    setCompressedPhoto(null);
    setRoomPreviewUrl(null);
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setErrorMsg(null);
    setActiveSlab(currentSlab);
    setSurfaceType(null);
    setBookmatch(false);
    setRawMaskDataUrl(null);
    setManualFloorCorners([]);
    setLastFloorQuad(null);
    setPhase("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── render ───────────────────────────────────────────────────────────────────

  const isLoading = phase === "segmenting" || phase === "rendering";

  const surfaceBadge = surfaceType ? (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
      {SURFACE_LABELS[surfaceType]} detected
    </span>
  ) : null;

  const bookmatchToggle = (
    <button
      type="button"
      onClick={() => void handleBookmatchToggle()}
      disabled={isLoading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        bookmatch
          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <FlipHorizontal className="h-3.5 w-3.5" />
      Bookmatch
    </button>
  );

  return (
    <div>
      {/* Upload phase */}
      {phase === "upload" && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          {currentSlab.thumbnailUrl && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                Slab texture
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentSlab.thumbnailUrl}
                alt={currentSlab.slabCode}
                className="h-28 w-44 rounded-lg object-cover"
              />
            </div>
          )}

          <div
            className="flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-8 py-14 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Camera className="h-10 w-10 text-gray-400" />
            <div className="text-center">
              <p className="font-semibold text-gray-700">Upload a room photo</p>
              <p className="mt-1 text-sm text-gray-400">
                Take or upload a photo of the client&apos;s space
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* Tap phase */}
      {phase === "tap" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <Scan className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="text-sm text-indigo-800">
              <span className="font-semibold">Tap once</span> on the floor, wall, or countertop surface you want to replace with marble.
            </span>
          </div>

          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={photoImgRef}
              src={roomPreviewUrl}
              alt="Room"
              className="w-full cursor-crosshair rounded-xl border border-gray-200 shadow-sm"
              onLoad={(e) =>
                setImgNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onClick={handleImageClick}
              draggable={false}
            />
            {tapDisplay && (
              <div
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-lg"
                style={{
                  left: `${tapDisplay.pct.x * 100}%`,
                  top: `${tapDisplay.pct.y * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            {bookmatchToggle}
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Change photo
            </button>
          </div>
        </div>
      )}

      {/* Loading phases */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl ?? roomPreviewUrl ?? ""}
            alt="Room"
            className="w-full rounded-xl border border-gray-200 opacity-60 shadow-sm"
            draggable={false}
          />
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">{loadingMsg}</span>
            </div>
            {surfaceBadge}
          </div>
        </div>
      )}

      {/* Floor correction phase — staff taps 4 corners to define the floor plane */}
      {phase === "floor_correction" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          {/* Instruction banner */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Floor detection needs correction.</span>{" "}
              {manualFloorCorners.length < 4 ? (
                <>
                  Tap corner{" "}
                  <span className="font-medium">
                    {manualFloorCorners.length + 1} of 4 —{" "}
                    {CORNER_LABELS[manualFloorCorners.length]}
                  </span>
                </>
              ) : (
                "All 4 corners selected — rendering…"
              )}
            </div>
          </div>

          {/* Corner progress pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {CORNER_LABELS.map((label, i) => (
              <div
                key={i}
                className={`rounded-lg px-2 py-1.5 text-center text-xs font-medium border transition-all ${
                  i < manualFloorCorners.length
                    ? "border-blue-300 bg-blue-500 text-white"
                    : i === manualFloorCorners.length
                    ? "border-amber-300 bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>

          {/* Room photo with SAM debug overlay + corner markers */}
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roomPreviewUrl}
              alt="Room"
              className="w-full cursor-crosshair rounded-xl border border-amber-300 shadow-sm"
              onClick={handleFloorCornerClick}
              draggable={false}
            />

            {/* Red tint overlay: white areas in rawMask = what SAM detected */}
            {rawMaskDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rawMaskDataUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full rounded-xl"
                style={{
                  mixBlendMode: "screen",
                  filter: "sepia(1) saturate(5) hue-rotate(330deg) brightness(0.8)",
                  opacity: 0.45,
                }}
                draggable={false}
              />
            )}

            {/* Numbered corner markers */}
            {manualFloorCorners.map((c, i) => (
              <div
                key={i}
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-bold text-white shadow-lg"
                style={{ left: `${c.pct.x * 100}%`, top: `${c.pct.y * 100}%` }}
              >
                {i + 1}
              </div>
            ))}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1">
              <div className="h-3 w-3 rounded-sm bg-red-400 opacity-80" />
              <span className="text-xs text-white">SAM detected area (red = what was included)</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManualFloorCorners([])}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset corners
            </button>
            <button
              type="button"
              onClick={resetToTap}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Retap surface
            </button>
          </div>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-sm font-semibold text-red-700">Something went wrong</p>
            <p className="mt-1 text-sm text-red-600">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetToTap}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              New photo
            </button>
          </div>
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && resultUrl && (
        <div className="flex flex-col gap-5">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {activeSlab.marbleName ?? activeSlab.slabCode} applied
              </span>
              {surfaceBadge}
              {surfaceType === "floor" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <Layers2 className="h-3 w-3" />
                  Exact slab texture
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {bookmatchToggle}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={resetToTap}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retap surface
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                New photo
              </button>
            </div>
          </div>

          {/* Before / Slab / After images */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Before</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={roomPreviewUrl ?? ""}
                alt="Before"
                className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                draggable={false}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {activeSlab.marbleName ?? activeSlab.slabCode}
              </span>
              {activeSlab.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeSlab.thumbnailUrl}
                  alt={activeSlab.slabCode}
                  className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex w-full flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-10 text-xs text-gray-300">
                  No image
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">After</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="After"
                className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                draggable={false}
              />
            </div>
          </div>

          {/* Compare with other slabs */}
          {comparisons.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">
                Compare with another slab
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {comparisons.map((slab) => (
                  <button
                    key={slab.id}
                    type="button"
                    onClick={() => void handleCompareSlab(slab)}
                    disabled={isLoading}
                    className={`flex shrink-0 flex-col overflow-hidden rounded-xl border transition-all hover:border-indigo-400 hover:shadow-md disabled:opacity-50 ${
                      activeSlab.id === slab.id
                        ? "border-indigo-500 ring-2 ring-indigo-500"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="h-20 w-28 overflow-hidden bg-gray-100">
                      {slab.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slab.thumbnailUrl}
                          alt={slab.slabCode}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-300">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-left">
                      <p className="truncate w-28 text-xs font-semibold text-gray-900">{slab.slabCode}</p>
                      {slab.marbleName && (
                        <p className="truncate w-28 text-xs text-gray-400">{slab.marbleName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
