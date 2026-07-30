"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { VisualizerJobResponse } from "../_lib/types";

import ResultCanvas from "./ResultCanvas";

type TapPoint = { x: number; y: number };

export default function VisualizerClient() {
  const [roomPhoto, setRoomPhoto] = useState<File | null>(null);
  const [roomPhotoUrl, setRoomPhotoUrl] = useState<string | null>(null);
  const [slabImage, setSlabImage] = useState<File | null>(null);
  const [tapPoint, setTapPoint] = useState<TapPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleRoomPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setRoomPhoto(file);
    setTapPoint(null);
    setResultUrl(null);
    setError(null);
    setRoomPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    setTapPoint({
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    });
  }

  async function handleSubmit() {
    if (!roomPhoto || !slabImage || !tapPoint) {
      setError("Upload a room photo, pick a slab image, and tap the floor first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const formData = new FormData();
      formData.append("roomPhoto", roomPhoto);
      formData.append("slabImage", slabImage);
      formData.append("tapX", String(tapPoint.x));
      formData.append("tapY", String(tapPoint.y));

      const res = await fetch("/api/visualizer/jobs", { method: "POST", body: formData });
      const json = (await res.json()) as VisualizerJobResponse;

      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : "Render failed.");
        return;
      }

      setResultUrl(json.resultUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">1. Room photo</label>
          <input type="file" accept="image/*" onChange={handleRoomPhotoChange} />
          {roomPhotoUrl && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-foreground/60">Tap the floor in the photo:</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- natural pixel coords needed for the tap point */}
              <img
                ref={imgRef}
                src={roomPhotoUrl}
                alt="Uploaded room"
                onClick={handleImageClick}
                className="w-full cursor-crosshair rounded-md border border-border"
              />
              {tapPoint && (
                <p className="mt-1 text-xs text-foreground/60">
                  Tapped at ({tapPoint.x}, {tapPoint.y})
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">2. Slab / product image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlabImage(e.target.files?.[0] ?? null)}
          />
        </div>

        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Rendering…" : "Render"}
        </Button>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Result</label>
        {resultUrl ? (
          <ResultCanvas imageUrl={resultUrl} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-sm text-foreground/50">
            Render output will appear here
          </div>
        )}
      </div>
    </div>
  );
}
