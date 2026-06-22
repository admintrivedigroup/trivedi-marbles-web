"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, LoaderCircle, Save, X } from "lucide-react";

import { addSlabToLot } from "@/app/inventory/_actions/add-slab-to-lot";
import {
  cleanupCloudinaryImages,
  saveSlabImages,
} from "@/app/inventory/_actions/slab-images";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { compressImage } from "@/lib/cloudinary/compress";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";

type LotMeta = {
  id: string;
  lotNumber: string | null;
  marbleName: string | null;
  categoryId: string | null;
  thicknessId: string | null;
  warehouseId: string | null;
  sellingPrice: number | null;
  dealerPrice: number | null;
  suggestedSlabCode: string;
};

function calcSqft(length: string, width: string) {
  const l = parseFloat(length);
  const w = parseFloat(width);
  return l > 0 && w > 0 ? (l * w).toFixed(2) : "—";
}

export function AddSlabToLotForm({ lot }: { lot: LotMeta }) {
  const router = useRouter();
  const { options } = useLookupOptions();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const defaultStatusId =
    options.statuses.find((s) => s.name === "Available")?.id ??
    options.statuses[0]?.id ??
    "";

  const [fields, setFields] = useState({
    slabCode: lot.suggestedSlabCode,
    length: "",
    width: "",
    rackNumber: "",
    notes: "",
    statusId: defaultStatusId,
  });

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = url;
    setImageFile(file);
    setImagePreviewUrl(url);
  }

  function removeImage() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    const formData = new FormData();
    formData.set("slabCode", fields.slabCode);
    formData.set("length", fields.length);
    formData.set("width", fields.width);
    formData.set("rackNumber", fields.rackNumber);
    formData.set("notes", fields.notes);
    formData.set("statusId", fields.statusId);
    formData.set("categoryId", lot.categoryId ?? "");
    formData.set("thicknessId", lot.thicknessId ?? "");
    formData.set("warehouseId", lot.warehouseId ?? "");
    formData.set("marbleName", lot.marbleName ?? "");
    formData.set("sellingPrice", lot.sellingPrice != null ? String(lot.sellingPrice) : "");
    formData.set("dealerPrice", lot.dealerPrice != null ? String(lot.dealerPrice) : "");

    startTransition(async () => {
      const result = await addSlabToLot(lot.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      const slabId = result.slabId!;

      // Upload photo if one was selected
      if (imageFile) {
        setStatusMessage("Uploading photo...");
        try {
          const compressed = await compressImage(imageFile);
          const { secureUrl, publicId } = await uploadToCloudinary(compressed);
          const saveResult = await saveSlabImages([
            { slabId, imageUrl: secureUrl, publicId, sortOrder: 0 },
          ]);
          if (saveResult.error) {
            // Photo failed to save — clean up Cloudinary and warn but still navigate
            cleanupCloudinaryImages([publicId]).catch(() => {});
            setError(`Slab saved, but photo could not be recorded. ${saveResult.error}`);
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed.";
          setError(`Slab saved, but photo upload failed. ${msg}`);
          return;
        }
      }

      router.push(`/inventory/lot/${lot.id}`);
    });
  }

  const sqft = calcSqft(fields.length, fields.width);

  return (
    <div className="p-4 md:p-8">
      {/* Back */}
      <div className="mb-6">
        <Link
          href={`/inventory/lot/${lot.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {lot.lotNumber ?? "Lot"}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Slab</h1>
        <p className="mt-1 text-sm text-gray-500">
          Adding to lot{" "}
          <span className="font-mono font-semibold text-gray-700">
            {lot.lotNumber ?? lot.id}
          </span>
          {lot.marbleName ? ` · ${lot.marbleName}` : ""}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {statusMessage && !error && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <LoaderCircle className="h-4 w-4 animate-spin shrink-0" />
            {statusMessage}
          </div>
        )}

        {/* Photo upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Photo <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          {imagePreviewUrl ? (
            <div className="relative w-full overflow-hidden rounded-xl border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Slab preview"
                className="aspect-4/3 w-full object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                disabled={isPending}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-gray-400 hover:bg-white">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleImageChange}
                disabled={isPending}
              />
              <Camera className="h-6 w-6 text-gray-300" />
              <span className="text-sm text-gray-400">Tap to add photo</span>
            </label>
          )}
        </div>

        {/* Slab Code */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="slabCode" className="text-sm font-medium text-gray-700">
            Slab Code
          </label>
          <input
            id="slabCode"
            name="slabCode"
            type="text"
            value={fields.slabCode}
            onChange={handleChange}
            placeholder="LOT001-S1"
            disabled={isPending}
            className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-3">
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
              value={fields.length}
              onChange={handleChange}
              placeholder="0"
              disabled={isPending}
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
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
              value={fields.width}
              onChange={handleChange}
              placeholder="0"
              disabled={isPending}
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Sqft</label>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {sqft}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="statusId" className="text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="statusId"
            name="statusId"
            value={fields.statusId}
            onChange={handleChange}
            disabled={isPending || options.statuses.length === 0}
            className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            {options.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Rack Number */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rackNumber" className="text-sm font-medium text-gray-700">
            Rack Number <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="rackNumber"
            name="rackNumber"
            type="text"
            value={fields.rackNumber}
            onChange={handleChange}
            placeholder="A-12"
            disabled={isPending}
            className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-gray-700">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={fields.notes}
            onChange={handleChange}
            placeholder="Any notes about this slab..."
            disabled={isPending}
            className="resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>

        {/* Inherited info note */}
        <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          Marble name, category, thickness, warehouse, and pricing are inherited from lot{" "}
          <span className="font-mono font-medium">{lot.lotNumber}</span>.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Add Slab
              </>
            )}
          </button>
          <Link
            href={`/inventory/lot/${lot.id}`}
            className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
