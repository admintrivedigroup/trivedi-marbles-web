"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Download,
  Loader2,
  RefreshCw,
  Scan,
} from "lucide-react";

import { detectSurface, renderVisualization } from "@/app/inventory/_actions/visualize";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "upload"      // waiting for room photo
  | "tap"         // photo loaded, waiting for surface tap
  | "segmenting"  // SAM-2 running
  | "rendering"   // GPT Image 1 running
  | "result"      // showing rendered result
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

// Compress room photo before sending: max 1500px, JPEG 85%
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
        // SAM white (surface) → alpha=0 (editable); SAM black → alpha=255 (preserve)
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

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizerAI({ currentSlab, comparisons }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // room photo kept in memory for re-renders when comparing slabs
  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const [roomPreviewUrl, setRoomPreviewUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  // tap indicator shown while in "tap" phase
  const [tapDisplay, setTapDisplay] = useState<{ pct: { x: number; y: number } } | null>(null);

  // alpha mask kept for slab comparison re-renders (no need to re-run SAM)
  const [alphaMaskBase64, setAlphaMaskBase64] = useState<string | null>(null);

  // which slab is currently being rendered / shown
  const [activeSlab, setActiveSlab] = useState<SlabOption>(currentSlab);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [loadingMsg, setLoadingMsg] = useState("");

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    const compressed = await compressPhoto(file);
    const previewUrl = URL.createObjectURL(compressed);
    setCompressedPhoto(compressed);
    setRoomPreviewUrl(previewUrl);
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
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

    // CSS-relative percentages for the dot overlay
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    setTapDisplay({ pct: { x: pctX, y: pctY } });

    // Actual pixel coords in the original image for SAM
    const pixelX = Math.round(pctX * imgNatural.w);
    const pixelY = Math.round(pctY * imgNatural.h);

    void runPipeline(pixelX, pixelY);
  }

  async function runPipeline(pixelX: number, pixelY: number) {
    if (!compressedPhoto) return;

    try {
      // Step 1: surface detection
      setPhase("segmenting");
      setLoadingMsg("Detecting surface…");

      const detectFd = new FormData();
      detectFd.append("photo", compressedPhoto);
      detectFd.append("pointX", String(pixelX));
      detectFd.append("pointY", String(pixelY));

      const { rawMaskBase64, error: detectError } = await detectSurface(detectFd);
      if (detectError || !rawMaskBase64) {
        setErrorMsg(detectError ?? "Surface detection returned no mask.");
        setPhase("error");
        return;
      }

      // Step 2: convert SAM mask → OpenAI alpha mask (client-side canvas)
      const alphaMask = await buildAlphaMask(rawMaskBase64, imgNatural.w, imgNatural.h);
      setAlphaMaskBase64(alphaMask);

      // Step 3: AI render
      await runRender(alphaMask, activeSlab);

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  async function runRender(alphaMask: string, slab: SlabOption) {
    if (!compressedPhoto || !slab.imageUrl) return;

    setPhase("rendering");
    setLoadingMsg("Generating visualization…");

    const renderFd = new FormData();
    renderFd.append("photo", compressedPhoto);
    renderFd.append("alphaMaskBase64", alphaMask);
    renderFd.append("slabImageUrl", slab.imageUrl);
    renderFd.append("marbleName", slab.marbleName ?? slab.slabCode);

    const { resultBase64, error: renderError } = await renderVisualization(renderFd);

    if (renderError || !resultBase64) {
      setErrorMsg(renderError ?? "Rendering failed.");
      setPhase("error");
      return;
    }

    setResultUrl(resultBase64);
    setActiveSlab(slab);
    setPhase("result");
  }

  async function handleCompareSlab(slab: SlabOption) {
    if (!alphaMaskBase64) return;
    setActiveSlab(slab);
    await runRender(alphaMaskBase64, slab);
  }

  function handleDownload() {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${activeSlab.slabCode}-visualization.jpg`;
    link.click();
  }

  function resetToTap() {
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setErrorMsg(null);
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
    setPhase("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── render ───────────────────────────────────────────────────────────────────

  const isLoading = phase === "segmenting" || phase === "rendering";

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
              <span className="font-semibold">Tap once</span> on the floor or wall surface you want to replace with marble.
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

          <div className="flex justify-end">
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
          {roomPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={roomPreviewUrl}
              alt="Room"
              className="w-full rounded-xl border border-gray-200 opacity-60 shadow-sm"
              draggable={false}
            />
          )}
          <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-5">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-gray-700">{loadingMsg}</span>
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
            <span className="text-sm font-medium text-gray-700">
              {activeSlab.marbleName ?? activeSlab.slabCode} applied
            </span>
            <div className="flex gap-2">
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

          {/* Result image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="AI visualization"
            className="w-full rounded-xl border border-gray-200 shadow-sm"
          />

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
                      <p className="text-xs font-semibold text-gray-900 truncate w-28">{slab.slabCode}</p>
                      {slab.marbleName && (
                        <p className="truncate text-xs text-gray-400 w-28">{slab.marbleName}</p>
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
