"use client";

import { useEffect, useRef, useState } from "react";
import { getTestImages } from "../../surface-benchmark/_actions/getTestImages";

type Props = {
  photo:    File | null;
  photoUrl: string | null;
  onFile:   (f: File) => void;
};

export function ImagePicker({ photo, photoUrl, onFile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [testImages, setTestImages] = useState<{ path: string; displayName: string }[]>([]);
  const [fetching,   setFetching]   = useState<string | null>(null);
  const [active,     setActive]     = useState<string | null>(null);

  useEffect(() => {
    void getTestImages().then(setTestImages).catch(() => undefined);
  }, []);

  async function loadTestImage(img: { path: string; displayName: string }) {
    if (fetching) return;
    setFetching(img.path);
    try {
      const url  = `/debug/surface-benchmark/asset?file=${encodeURIComponent(img.path)}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = img.path.split(/[/\\]/).pop() ?? img.path;
      setActive(img.path);
      onFile(new File([blob], name, { type: blob.type || "image/jpeg" }));
    } catch (e) {
      console.error("[ImagePicker]", e);
    } finally {
      setFetching(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f?.type.startsWith("image/")) { setActive(null); onFile(f); }
        }}
        onDragOver={(e) => e.preventDefault()}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-5 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
      >
        {photoUrl && photo ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Preview" className="h-16 rounded-xl border border-gray-200 object-cover shadow-sm" draggable={false} />
            <div>
              <p className="font-semibold text-gray-700 text-sm">{photo.name}</p>
              <p className="text-xs text-gray-400">{Math.round(photo.size / 1024)} KB</p>
              <p className="text-[10px] text-indigo-400 mt-0.5">Click to change</p>
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
            if (f) { setActive(null); onFile(f); }
            e.target.value = "";
          }}
        />
      </div>

      {/* Test image grid */}
      {testImages.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Or pick a test image
          </p>
          <div className="flex flex-wrap gap-1.5">
            {testImages.map((img) => {
              const src       = `/debug/surface-benchmark/asset?file=${encodeURIComponent(img.path)}`;
              const isActive  = active === img.path;
              const isLoading = fetching === img.path;
              return (
                <button
                  key={img.path}
                  type="button"
                  onClick={() => void loadTestImage(img)}
                  disabled={fetching !== null}
                  title={img.displayName}
                  className={`group relative overflow-hidden rounded-xl border-2 transition-all disabled:cursor-wait ${
                    isActive ? "border-indigo-500" : "border-transparent hover:border-indigo-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={img.displayName} className="h-14 w-20 object-cover" draggable={false} />
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  {isActive && !isLoading && (
                    <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
