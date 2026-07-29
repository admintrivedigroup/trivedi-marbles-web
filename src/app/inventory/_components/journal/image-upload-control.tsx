"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";

import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { cn } from "@/lib/utils";
import { inputClass } from "./field-kit";

/** Shared cover-image / in-body-image upload widget: upload-or-URL toggle,
 * client-side compression, Cloudinary upload — reuses the exact helpers the
 * pre-existing journal admin already used for cover images, unchanged. */
export function ImageUploadControl({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      const { secureUrl } = await uploadToCloudinary(compressed);
      onChange(secureUrl);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn("flex-1 px-3 py-1.5", mode === "upload" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
        >
          <Upload className="mr-1 inline h-3 w-3" /> Upload
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn("flex-1 px-3 py-1.5", mode === "url" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
        >
          <LinkIcon className="mr-1 inline h-3 w-3" /> URL
        </button>
      </div>

      {mode === "upload" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100",
            isUploading && "cursor-wait opacity-60",
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          ) : (
            <span className="text-sm text-gray-400">Click to upload an image</span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </button>
      ) : (
        <input
          type="url"
          value={url}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
