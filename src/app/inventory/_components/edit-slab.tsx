"use client";

import {
  useState,
  useRef,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Save, X } from "lucide-react";

import { updateSlab } from "@/app/inventory/_actions/update-slab";
import {
  deleteSlabImage,
  saveSlabImages,
} from "@/app/inventory/_actions/slab-images";
import { reorderSlabImages } from "@/app/inventory/_actions/reorder-slab-images";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { compressImage } from "@/lib/cloudinary/compress";
import type { SlabEditImage, SlabForEdit } from "@/app/inventory/_lib/slab-edit";

function calcSqft(length: string, width: string) {
  const l = parseFloat(length);
  const w = parseFloat(width);
  return l > 0 && w > 0 ? (l * w).toFixed(2) : "0.00";
}

export function EditSlab({ slab }: { slab: SlabForEdit }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slabCode: slab.slabCode,
    length: slab.length,
    width: slab.width,
    rackNumber: slab.rackNumber,
    notes: slab.notes,
    updatedAt: slab.updatedAt,
  });

  const [images, setImages] = useState<SlabEditImage[]>(slab.images);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setError(null);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.set(key, value);
    }
    setError(null);
    startTransition(async () => {
      try {
        // Commit staged deletions before saving slab fields
        for (const imageId of pendingDeleteIds) {
          const image = images.find((img) => img.id === imageId);
          if (!image) continue;
          const result = await deleteSlabImage(image.id, image.publicId, slab.id);
          if (result.error) {
            setError(result.error);
            return;
          }
        }
        const result = await updateSlab(slab.id, formData);
        if (result.error) {
          setError(result.error);
        } else {
          router.push(`/inventory/slab/${slab.id}`);
        }
      } catch {
        setError("Unable to save slab right now. Please try again.");
      }
    });
  }

  function toggleDeleteImage(imageId: string) {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  async function moveImage(imageId: string, direction: "left" | "right") {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx === -1) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;

    const next = [...images];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setImages(next);

    const result = await reorderSlabImages(slab.id, next.map((img) => img.id));
    if (result.error) setImageError(result.error);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImageError(null);
    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      const { secureUrl, publicId } = await uploadToCloudinary(compressed);
      const nextSortOrder = images.length > 0
        ? Math.max(...images.map((img) => img.sortOrder)) + 1
        : 0;
      const result = await saveSlabImages([
        { imageUrl: secureUrl, publicId, slabId: slab.id, sortOrder: nextSortOrder },
      ]);
      if (result.error) {
        setImageError(result.error);
      } else {
        setImages((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, imageUrl: secureUrl, publicId, sortOrder: nextSortOrder, fileSize: compressed.size },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setImageError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  const backHref = slab.lotId
    ? `/inventory/lot/${slab.lotId}`
    : "/inventory/list";
  const backLabel = slab.lotNumber
    ? `Back to ${slab.lotNumber}`
    : "Back to Inventory";

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Edit Slab</h2>
          {slab.marbleName ? (
            <p className="mt-1 text-gray-500">{slab.marbleName}</p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Slab Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="slabCode" className="text-sm font-medium text-gray-700">
                Slab Code
              </label>
              <input
                id="slabCode"
                name="slabCode"
                type="text"
                value={form.slabCode}
                onChange={handleChange}
                placeholder="LOT001-S1"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="length" className="text-sm font-medium text-gray-700">
                Length (ft)
              </label>
              <input
                id="length"
                name="length"
                type="number"
                min="0"
                step="0.1"
                value={form.length}
                onChange={handleChange}
                placeholder="0"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="width" className="text-sm font-medium text-gray-700">
                Width (ft)
              </label>
              <input
                id="width"
                name="width"
                type="number"
                min="0"
                step="0.1"
                value={form.width}
                onChange={handleChange}
                placeholder="0"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Area (sqft) <span className="font-light text-gray-400">(estimate)</span></span>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {calcSqft(form.length, form.width)}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rackNumber" className="text-sm font-medium text-gray-700">
                Rack Number
              </label>
              <input
                id="rackNumber"
                name="rackNumber"
                type="text"
                value={form.rackNumber}
                onChange={handleChange}
                placeholder="A-12"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 md:text-lg">Photos</h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || isUploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" />
                  Add Photo
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {imageError ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {imageError}
            </div>
          ) : null}

          {images.length === 0 && !isUploading ? (
            <p className="text-sm text-gray-400">No photos yet. Click &quot;Add Photo&quot; to upload one.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image, imageIndex) => {
                const markedForDelete = pendingDeleteIds.has(image.id);
                const sizeLabel = image.fileSize != null
                  ? image.fileSize >= 1024 * 1024
                    ? `${(image.fileSize / 1024 / 1024).toFixed(1)} MB`
                    : `${Math.round(image.fileSize / 1024)} KB`
                  : null;

                const isFirst = imageIndex === 0;
                const isLast = imageIndex === images.length - 1;

                return (
                  <div key={image.id} className="flex flex-col gap-1">
                    <div
                      className={`group relative aspect-square overflow-hidden rounded-xl border bg-gray-50 ${markedForDelete ? "border-red-300" : "border-gray-100"}`}
                    >
                      <img
                        src={image.imageUrl}
                        alt="Slab photo"
                        className={`h-full w-full object-cover transition-opacity ${markedForDelete ? "opacity-30" : ""}`}
                      />
                      {markedForDelete && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                            Will be deleted
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDeleteImage(image.id)}
                        disabled={isPending}
                        className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white transition-all disabled:cursor-not-allowed ${
                          markedForDelete
                            ? "bg-red-500 opacity-100 hover:bg-gray-700"
                            : "bg-black/60 opacity-100 hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
                        }`}
                        aria-label={markedForDelete ? "Undo delete" : "Mark for deletion"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, "left")}
                        disabled={isPending || isFirst}
                        title="Move left"
                        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {sizeLabel ? (
                        <span className="flex-1 text-center text-xs text-gray-400">{sizeLabel}</span>
                      ) : (
                        <span className="flex-1 text-center text-xs text-gray-400">{imageIndex + 1}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, "right")}
                        disabled={isPending || isLast}
                        title="Move right"
                        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Notes</h3>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            value={form.notes}
            onChange={handleChange}
            placeholder="Any additional information about this slab..."
            disabled={isPending}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
        </section>

        <input type="hidden" name="updatedAt" value={form.updatedAt} />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/inventory/slab/${slab.id}`)}
            disabled={isPending}
            className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
