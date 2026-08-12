"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSlabTextures } from "@/lib/visualizerM2F/actions/getSlabTextures";
import { fetchTextureBase64 } from "@/lib/visualizerM2F/actions/fetchTextureBase64";
import { formatSlabDimensions } from "@/lib/visualizerM2F/types";
import type { SlabTexture, PipelineSegment } from "@/lib/visualizerM2F/types";
import { SurfaceSelector } from "@/app/inventory/_components/visualizer-m2f/SurfaceSelector";
import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

type Props = {
  segments: PipelineSegment[];
  selectedCat: string | null;
  onSelectSurface: (cat: string, segs: PipelineSegment[]) => void;
  selectedSlabId: string | null;
  onSelectSlab: (slab: SlabTexture, base64: string) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
};

function HeartButton({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`flex h-4 w-4 items-center justify-center rounded-full ${active ? "text-[#9c7c42]" : "text-stone-400 hover:text-stone-600"}`}
    >
      <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
        <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.6 6.7 4.4 5.2 6.6 4 9.2 4.6 12 7.4c2.8-2.8 5.4-3.4 7.6-2.2 2.8 1.5 3.4 4.9 1.7 7.7C18.7 16.65 12 21 12 21z" />
      </svg>
    </button>
  );
}

export function Sidebar({
  segments, selectedCat, onSelectSurface, selectedSlabId, onSelectSlab, isFavorite, onToggleFavorite,
}: Props) {
  const [slabs,   setSlabs]   = useState<SlabTexture[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [view,    setView]    = useState<"list" | "grid">("list");
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getSlabTextures().then((s) => { setSlabs(s); setLoading(false); });
  }, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const [base64, { secureUrl }] = await Promise.all([
        readAsDataUrl(compressed),
        uploadToCloudinary(compressed),
      ]);
      const slab: SlabTexture = {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        slabCode: null,
        marbleName: file.name.replace(/\.[^.]+$/, "") || "Custom upload",
        lotNumber: null,
        thumbnailUrl: secureUrl,
        length: null,
        width: null,
      };
      setSlabs((prev) => [slab, ...prev]);
      onSelectSlab(slab, base64);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return slabs.filter((s) => {
      if (favOnly && !isFavorite(s.id)) return false;
      if (!q) return true;
      return (s.marbleName ?? "").toLowerCase().includes(q) || (s.slabCode ?? "").toLowerCase().includes(q);
    });
    // isFavorite intentionally excluded from deps — it closes over a Set that changes identity each toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slabs, search, favOnly]);

  async function handleSelect(slab: SlabTexture) {
    if (fetching) return;
    setFetching(slab.id);
    try {
      const b64 = await fetchTextureBase64(slab.thumbnailUrl);
      if (b64) onSelectSlab(slab, b64);
    } finally {
      setFetching(null);
    }
  }

  return (
    <div className="flex w-[302px] shrink-0 flex-col border-r border-stone-200 bg-[#faf8f5]">
      <SurfaceSelector segments={segments} selected={selectedCat} onSelect={onSelectSurface} />

      <div className="flex items-center gap-2 border-t border-stone-200 px-3 py-2.5">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-stone-400">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search marble, granite…"
            className="w-full min-w-0 bg-transparent text-[11.5px] text-stone-700 outline-none placeholder:text-stone-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setFavOnly((v) => !v)}
          title="Favorites only"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            favOnly ? "border-[#17130f] bg-[#17130f] text-[#faf8f5]" : "border-stone-200 bg-white text-stone-400 hover:text-stone-600"
          }`}
        >
          <svg viewBox="0 0 24 24" fill={favOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.6 6.7 4.4 5.2 6.6 4 9.2 4.6 12 7.4c2.8-2.8 5.4-3.4 7.6-2.2 2.8 1.5 3.4 4.9 1.7 7.7C18.7 16.65 12 21 12 21z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setView((v) => (v === "list" ? "grid" : "list"))}
          title="Toggle view"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-stone-700"
        >
          {view === "list" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          )}
        </button>
      </div>

      <div className="px-3 pb-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFileSelected(e)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 bg-white px-2.5 py-2 text-[11.5px] font-semibold text-stone-600 hover:border-stone-400 hover:text-stone-800 disabled:cursor-wait disabled:opacity-60"
        >
          {uploading ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
              Uploading…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
              </svg>
              Upload your own slab
            </>
          )}
        </button>
        {uploadError && (
          <p className="mt-1.5 text-[10.5px] text-red-600">{uploadError}</p>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2.5 pb-2">
        {loading ? (
          <div className="space-y-2 p-1.5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-lg bg-stone-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-stone-400">
            {favOnly ? "No favorites yet." : "No slabs match your search."}
          </p>
        ) : view === "list" ? (
          <div className="space-y-1.5 p-0.5">
            {filtered.map((slab) => {
              const isSelected = selectedSlabId === slab.id;
              const size = formatSlabDimensions(slab.length, slab.width);
              return (
                // A nested favorite <button> (HeartButton below) means this row can't be a
                // <button> itself — HTML forbids interactive-in-interactive nesting.
                <div
                  key={slab.id}
                  role="button"
                  tabIndex={fetching !== null ? -1 : 0}
                  aria-disabled={fetching !== null}
                  onClick={() => { if (fetching === null) void handleSelect(slab); }}
                  onKeyDown={(e) => {
                    if (fetching !== null) return;
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void handleSelect(slab); }
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors ${
                    fetching !== null ? "cursor-wait" : "cursor-pointer"
                  } ${
                    isSelected ? "border border-[#c8a96a]/60 bg-[#c8a96a]/10" : "border border-transparent hover:bg-white"
                  }`}
                >
                  <div className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-md border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slab.thumbnailUrl} alt={slab.marbleName ?? slab.id} className="h-full w-full object-cover" draggable={false} />
                    <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/85">
                      <HeartButton active={isFavorite(slab.id)} onClick={() => onToggleFavorite(slab.id)} />
                    </div>
                    {fetching === slab.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {slab.lotNumber && (
                      <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-[#9c7c42]">Lot {slab.lotNumber}</p>
                    )}
                    <p className="truncate font-serif text-[14px] font-semibold leading-tight text-stone-900">
                      {slab.marbleName ?? slab.slabCode ?? "Unnamed slab"}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-stone-500">
                      {size ?? "Size not recorded"}
                      {slab.slabCode && <span className="text-stone-400"> · #{slab.slabCode}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-1">
            {filtered.map((slab) => {
              const isSelected = selectedSlabId === slab.id;
              return (
                <button
                  key={slab.id}
                  type="button"
                  disabled={fetching !== null}
                  onClick={() => void handleSelect(slab)}
                  title={slab.marbleName ?? slab.id}
                  className={`group relative rounded-lg border p-1 transition-all disabled:cursor-wait ${
                    isSelected ? "border-[#c8a96a] bg-[#c8a96a]/10" : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <div className="relative h-[72px] w-[72px] overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slab.thumbnailUrl} alt={slab.marbleName ?? slab.id} className="h-full w-full object-cover" draggable={false} />
                    {fetching === slab.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </div>
                  {isSelected && !fetching && (
                    <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#9c7c42] text-[9px] font-bold text-white">✓</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-stone-200 px-4 py-3 text-center">
        <button
          type="button"
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="mx-auto mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          Back to top
        </button>
        <p className="text-[9.5px] leading-relaxed text-stone-400">
          Visualization is an approximation — actual product may vary.{" "}
          <span className="cursor-help underline decoration-dotted underline-offset-2" title="Screen color and lighting affect how the marble appears. Confirm final selection against a physical slab before ordering.">
            View disclaimer
          </span>
        </p>
      </div>
    </div>
  );
}
