"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Crop, LoaderCircle, RotateCcw, X } from "lucide-react";

import { compressImage } from "@/lib/cloudinary/compress";
import { cropImageToFile, detectSlabCropBox, type CropBox } from "@/lib/cloudinary/auto-crop";

const MIN_BOX = 0.08;

export type SlabCropResult = {
  croppedFile: File;
  originalFile: File | null;
  cropBox: CropBox | null;
};

type SlabCropDialogProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (result: SlabCropResult) => void;
};

type DragHandle = "tl" | "tr" | "bl" | "br" | "move";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function SlabCropDialog({ file, onCancel, onConfirm }: SlabCropDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [box, setBox] = useState<CropBox | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startBox: CropBox } | null>(null);

  useEffect(() => {
    // Object URL is created *and* revoked inside this effect (rather than via
    // useMemo + a separate cleanup) so the pair survives React 18 Strict
    // Mode's dev-only mount→cleanup→mount cycle — otherwise the first
    // simulated cleanup revokes the URL before the second mount's <img>
    // ever loads it.
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above; this is the create/revoke pairing, not derived state.
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleImageLoad() {
    if (!imgRef.current) return;
    const detected = await detectSlabCropBox(imgRef.current);
    setBox(detected);
  }

  function handlePointerDown(handle: DragHandle, e: ReactPointerEvent<HTMLDivElement>) {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startBox: box };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const s = drag.startBox;
    let next: CropBox = s;

    if (drag.handle === "move") {
      next = {
        x: clamp(s.x + dx, 0, 1 - s.width),
        y: clamp(s.y + dy, 0, 1 - s.height),
        width: s.width,
        height: s.height,
      };
    } else if (drag.handle === "tl") {
      const x = clamp(s.x + dx, 0, s.x + s.width - MIN_BOX);
      const y = clamp(s.y + dy, 0, s.y + s.height - MIN_BOX);
      next = { x, y, width: s.x + s.width - x, height: s.y + s.height - y };
    } else if (drag.handle === "tr") {
      const y = clamp(s.y + dy, 0, s.y + s.height - MIN_BOX);
      const width = clamp(s.width + dx, MIN_BOX, 1 - s.x);
      next = { x: s.x, y, width, height: s.y + s.height - y };
    } else if (drag.handle === "bl") {
      const x = clamp(s.x + dx, 0, s.x + s.width - MIN_BOX);
      const height = clamp(s.height + dy, MIN_BOX, 1 - s.y);
      next = { x, y: s.y, width: s.x + s.width - x, height };
    } else if (drag.handle === "br") {
      const width = clamp(s.width + dx, MIN_BOX, 1 - s.x);
      const height = clamp(s.height + dy, MIN_BOX, 1 - s.y);
      next = { x: s.x, y: s.y, width, height };
    }
    setBox(next);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleResetToDetected() {
    if (!imgRef.current) return;
    const detected = await detectSlabCropBox(imgRef.current);
    setBox(detected);
  }

  function handleUseFullPhoto() {
    setIsProcessing(true);
    compressImage(file)
      .then((compressed) => onConfirm({ croppedFile: compressed, originalFile: null, cropBox: null }))
      .catch(() => onConfirm({ croppedFile: file, originalFile: null, cropBox: null }));
  }

  async function handleConfirm() {
    if (!box || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const [croppedFile, originalFile] = await Promise.all([
        cropImageToFile(imgRef.current, box, file.name),
        compressImage(file),
      ]);
      onConfirm({ croppedFile, originalFile, cropBox: box });
    } catch {
      setIsProcessing(false);
    }
  }

  const handles: DragHandle[] = ["tl", "tr", "bl", "br"];
  const handleClasses: Record<DragHandle, string> = {
    tl: "-left-2 -top-2 cursor-nwse-resize",
    tr: "-right-2 -top-2 cursor-nesw-resize",
    bl: "-left-2 -bottom-2 cursor-nesw-resize",
    br: "-right-2 -bottom-2 cursor-nwse-resize",
    move: "",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Crop className="h-4 w-4 text-gray-500" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Adjust slab crop</h3>
              <p className="text-xs text-gray-400">Drag the corners to fit the slab, then confirm.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-950 p-4">
          {!objectUrl && <LoaderCircle className="h-6 w-6 animate-spin text-white" />}
          {objectUrl && (
          <div
            ref={containerRef}
            className="relative inline-block touch-none select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={objectUrl}
              alt="Slab to crop"
              onLoad={handleImageLoad}
              className="block max-h-[60vh] max-w-full"
              draggable={false}
            />
            {!box && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <LoaderCircle className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            {box && (
              <>
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{ left: 0, top: 0, right: 0, height: `${box.y * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{ left: 0, bottom: 0, right: 0, height: `${(1 - (box.y + box.height)) * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{ left: 0, top: `${box.y * 100}%`, width: `${box.x * 100}%`, height: `${box.height * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{
                    right: 0,
                    top: `${box.y * 100}%`,
                    width: `${(1 - (box.x + box.width)) * 100}%`,
                    height: `${box.height * 100}%`,
                  }}
                />
                <div
                  onPointerDown={(e) => handlePointerDown("move", e)}
                  className="absolute cursor-move border-2 border-white/90"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                  }}
                >
                  {handles.map((h) => (
                    <div
                      key={h}
                      onPointerDown={(e) => handlePointerDown(h, e)}
                      className={`absolute h-4 w-4 rounded-full border-2 border-gray-900 bg-white shadow ${handleClasses[h]}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDetected}
              disabled={!box || isProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-detect
            </button>
            <button
              type="button"
              onClick={handleUseFullPhoto}
              disabled={isProcessing}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use full photo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!box || isProcessing}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
