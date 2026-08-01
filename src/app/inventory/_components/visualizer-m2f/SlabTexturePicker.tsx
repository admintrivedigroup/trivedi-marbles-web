"use client";

import { useEffect, useState } from "react";
import { getSlabTextures }    from "@/lib/visualizerM2F/actions/getSlabTextures";
import { fetchTextureBase64 } from "@/lib/visualizerM2F/actions/fetchTextureBase64";
import type { SlabTexture }   from "@/lib/visualizerM2F/types";

type Props = {
  selectedId:    string | null;
  onSelect:      (slab: SlabTexture, base64DataUrl: string) => void;
};

export function SlabTexturePicker({ selectedId, onSelect }: Props) {
  const [slabs,    setSlabs]    = useState<SlabTexture[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fetching, setFetching] = useState<string | null>(null); // id being downloaded
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    void getSlabTextures()
      .then((s) => { setSlabs(s); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  async function handleSelect(slab: SlabTexture) {
    if (fetching) return;
    setFetching(slab.id);
    try {
      const b64 = await fetchTextureBase64(slab.thumbnailUrl);
      if (b64) {
        onSelect(slab, b64);
      } else {
        setError(`Could not download texture for ${slab.marbleName ?? slab.id}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setFetching(null);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 w-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
        {error}
      </div>
    );
  }

  if (slabs.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        No slab images found — make sure SUPABASE_SERVICE_ROLE_KEY is set and slabs have images.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
        {slabs.map((slab) => {
          const isSelected = selectedId === slab.id;
          const isLoading  = fetching === slab.id;
          return (
            <button
              key={slab.id}
              type="button"
              onClick={() => void handleSelect(slab)}
              disabled={fetching !== null}
              title={[slab.marbleName, slab.lotNumber, slab.slabCode].filter(Boolean).join(" · ")}
              className={`group relative overflow-hidden rounded-xl border-2 transition-all disabled:cursor-wait ${
                isSelected
                  ? "border-indigo-500 shadow-sm"
                  : "border-transparent hover:border-indigo-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slab.thumbnailUrl}
                alt={slab.marbleName ?? slab.id}
                className="h-16 w-20 object-cover"
                draggable={false}
              />

              {/* Name tooltip on hover */}
              <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 to-transparent p-1 group-hover:block">
                <p className="truncate text-[8px] leading-tight text-white">
                  {slab.marbleName ?? slab.slabCode ?? slab.id}
                </p>
              </div>

              {/* Spinner while downloading */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}

              {/* Checkmark when selected */}
              {isSelected && !isLoading && (
                <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {fetching && (
        <p className="text-[10px] text-indigo-400 animate-pulse">
          Downloading texture from inventory…
        </p>
      )}
    </div>
  );
}
