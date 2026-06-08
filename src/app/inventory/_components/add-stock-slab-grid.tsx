"use client";

import { type ChangeEvent } from "react";
import { Camera, Trash2, X } from "lucide-react";

export type SlabRow = {
  id: string;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  length: string;
  notes: string;
  rackNumber: string;
  slabCode: string;
  slabCodeAuto: boolean;
  width: string;
};

export type SlabFieldKey = keyof Omit<SlabRow, "id" | "slabCodeAuto" | "imageFile" | "imagePreviewUrl">;

export function calcSqft(length: string, width: string) {
  const l = parseFloat(length);
  const w = parseFloat(width);
  return l > 0 && w > 0 ? (l * w).toFixed(2) : "0.00";
}

type SlabGridProps = {
  slabs: SlabRow[];
  isPending: boolean;
  onFieldChange: (slabId: string, field: SlabFieldKey, value: string) => void;
  onImageChange: (slabId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveSlab: (slabId: string) => void;
  onRemoveImage: (slabId: string) => void;
};

export function SlabGrid({
  slabs,
  isPending,
  onFieldChange,
  onImageChange,
  onRemoveSlab,
  onRemoveImage,
}: SlabGridProps) {
  if (slabs.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
        No slabs added yet. Click &quot;Add Slab&quot; to begin.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="max-md:hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="pb-3 pr-3 w-14">Photo</th>
              <th className="pb-3 pr-3 w-8">#</th>
              <th className="pb-3 pr-3 min-w-35">Slab Code</th>
              <th className="pb-3 pr-3 w-24">Length (ft)</th>
              <th className="pb-3 pr-3 w-24">Width (ft)</th>
              <th className="pb-3 pr-3 w-20">Sqft</th>
              <th className="pb-3 pr-3 w-28">Rack</th>
              <th className="pb-3 pr-3">Notes</th>
              <th className="pb-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slabs.map((slab, index) => (
              <tr key={slab.id}>
                <td className="py-2 pr-3">
                  {slab.imagePreviewUrl ? (
                    <div className="group relative h-12 w-12">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slab.imagePreviewUrl}
                        alt={`Slab ${index + 1}`}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveImage(slab.id)}
                        disabled={isPending}
                        className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex disabled:cursor-not-allowed"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-gray-400 hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="sr-only"
                        onChange={(e) => onImageChange(slab.id, e)}
                        disabled={isPending}
                      />
                      <Camera className="h-4 w-4 text-gray-300" />
                    </label>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-gray-400">{index + 1}</td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={slab.slabCode}
                    onChange={(e) => onFieldChange(slab.id, "slabCode", e.target.value)}
                    placeholder="LOT001-S1"
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slab.length}
                    onChange={(e) => onFieldChange(slab.id, "length", e.target.value)}
                    placeholder="0"
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slab.width}
                    onChange={(e) => onFieldChange(slab.id, "width", e.target.value)}
                    placeholder="0"
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </td>
                <td className="py-2 pr-3">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {calcSqft(slab.length, slab.width)}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={slab.rackNumber}
                    onChange={(e) => onFieldChange(slab.id, "rackNumber", e.target.value)}
                    placeholder="A-12"
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={slab.notes}
                    onChange={(e) => onFieldChange(slab.id, "notes", e.target.value)}
                    placeholder="Optional notes"
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => onRemoveSlab(slab.id)}
                    disabled={isPending || slabs.length === 1}
                    title="Remove slab"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {slabs.map((slab, index) => (
          <div key={slab.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Slab {index + 1}</span>
              <button
                type="button"
                onClick={() => onRemoveSlab(slab.id)}
                disabled={isPending || slabs.length === 1}
                title="Remove slab"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mb-3">
              {slab.imagePreviewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slab.imagePreviewUrl}
                    alt={`Slab ${index + 1}`}
                    className="h-40 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(slab.id)}
                    disabled={isPending}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 bg-white transition-colors hover:border-gray-400 hover:bg-gray-50">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => onImageChange(slab.id, e)}
                    disabled={isPending}
                  />
                  <Camera className="h-5 w-5 text-gray-300" />
                  <span className="text-xs text-gray-400">Add Photo</span>
                </label>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Slab Code</label>
                <input
                  type="text"
                  value={slab.slabCode}
                  onChange={(e) => onFieldChange(slab.id, "slabCode", e.target.value)}
                  placeholder="LOT001-S1"
                  disabled={isPending}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Length (ft)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slab.length}
                    onChange={(e) => onFieldChange(slab.id, "length", e.target.value)}
                    placeholder="0"
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Width (ft)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slab.width}
                    onChange={(e) => onFieldChange(slab.id, "width", e.target.value)}
                    placeholder="0"
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Sqft</label>
                  <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-600">
                    {calcSqft(slab.length, slab.width)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Rack Number</label>
                <input
                  type="text"
                  value={slab.rackNumber}
                  onChange={(e) => onFieldChange(slab.id, "rackNumber", e.target.value)}
                  placeholder="A-12"
                  disabled={isPending}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <input
                  type="text"
                  value={slab.notes}
                  onChange={(e) => onFieldChange(slab.id, "notes", e.target.value)}
                  placeholder="Optional notes"
                  disabled={isPending}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
