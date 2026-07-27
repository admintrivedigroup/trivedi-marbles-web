"use client";

import { useEffect, useState } from "react";
import { getTestImages } from "../_actions/getTestImages";
import type { TestImage } from "../_lib/types";

type Props = { onSelect: (file: File) => void };

export function TestImagePicker({ onSelect }: Props) {
  const [images, setImages]         = useState<TestImage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetching, setFetching]     = useState<string | null>(null);
  const [activeImg, setActiveImg]   = useState<string | null>(null);

  useEffect(() => {
    getTestImages()
      .then((imgs) => { setImages(imgs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleClick(img: TestImage) {
    if (fetching) return;
    setFetching(img.path);
    try {
      const url = `/debug/surface-benchmark/asset?file=${encodeURIComponent(img.path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = img.path.split(/[/\\]/).pop() ?? img.path;
      const file = new File([blob], name, { type: blob.type || "image/png" });
      setActiveImg(img.path);
      onSelect(file);
    } catch (e) {
      console.error("[TestImagePicker] Failed to load:", img.path, e);
    } finally {
      setFetching(null);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-20 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        No images found in{" "}
        <code className="rounded bg-gray-100 px-1 font-mono text-gray-500">
          test-images/surfaces/
        </code>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img) => {
        const imgUrl = `/debug/surface-benchmark/asset?file=${encodeURIComponent(img.path)}`;
        const isActive  = activeImg === img.path;
        const isFetching = fetching === img.path;

        return (
          <button
            key={img.path}
            type="button"
            onClick={() => void handleClick(img)}
            disabled={fetching !== null}
            title={img.displayName}
            className={`group relative overflow-hidden rounded-xl border-2 transition-all disabled:cursor-wait
              ${isActive
                ? "border-indigo-500 shadow-sm shadow-indigo-200"
                : "border-transparent hover:border-indigo-300"}
            `}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={img.displayName}
              className="h-14 w-20 object-cover"
              draggable={false}
            />
            {/* Hover label */}
            <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 to-transparent p-1 group-hover:block">
              <p className="truncate text-[9px] leading-tight text-white">{img.displayName}</p>
            </div>
            {/* Loading spinner */}
            {isFetching && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            {/* Active tick */}
            {isActive && !isFetching && (
              <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                ✓
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
