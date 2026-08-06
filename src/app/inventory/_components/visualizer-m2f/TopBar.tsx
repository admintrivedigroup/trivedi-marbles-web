"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useExitTransition, ExitOverlay } from "@/app/inventory/_components/visualizer-exit-button";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

type Props = {
  exitHref: string;
  productPageHref: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  shareableUrl: string | null; // renderUrl ?? photoUrl — what Zoom/Share/Download act on
  onZoom: () => void;
  onCompare: () => void;
  compareDisabled: boolean;
  compareActive: boolean;
  onChangeRoom: () => void;
  onEnquire: () => void;
  onToggleDebug: () => void;
  onReset: () => void;
  onShared?: (url: string) => void;
};

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64 ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

function ActionIcon({ children }: { children: React.ReactNode }) {
  return <span className="h-3.5 w-3.5 shrink-0 [&>svg]:h-full [&>svg]:w-full">{children}</span>;
}

export function TopBar({
  exitHref, productPageHref, isFavorite, onToggleFavorite, shareableUrl,
  onZoom, onCompare, compareDisabled, compareActive, onChangeRoom, onEnquire,
  onToggleDebug, onReset, onShared,
}: Props) {
  const { exiting, progress, triggerExit } = useExitTransition(exitHref);
  const [sharing, setSharing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleShare() {
    if (!shareableUrl || sharing) return;
    setSharing(true);
    try {
      const file = dataUrlToFile(shareableUrl, "marble-render.jpg");
      const { secureUrl } = await uploadToCloudinary(file);
      await navigator.clipboard.writeText(secureUrl);
      onShared?.(secureUrl);
      toast.success("Link copied to clipboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a shareable link");
    } finally {
      setSharing(false);
    }
  }

  function handleDownload() {
    if (!shareableUrl) return;
    const a = document.createElement("a");
    a.href = shareableUrl;
    a.download = "marble-render.jpg";
    a.click();
  }

  return (
    <>
      <div className="flex h-[68px] shrink-0 items-center justify-between gap-6 bg-[#17130f] px-5">
        {/* Brand + favorite */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/images/vijay-trivedi-logo.webp" alt="Vijay Trivedi Group" fill className="object-contain" />
          </div>
          <div className="hidden leading-tight sm:flex sm:flex-col">
            <span className="font-serif text-[17px] font-semibold tracking-wide text-[#faf8f5]">Trivedi</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.24em] text-[#c8a96a]">Grani Marmo</span>
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            title="Favorite this render"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              isFavorite
                ? "border-[#c8a96a] bg-[#c8a96a] text-[#17130f]"
                : "border-white/15 bg-white/5 text-[#cfc6b8] hover:border-white/30"
            }`}
          >
            <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.6 6.7 4.4 5.2 6.6 4 9.2 4.6 12 7.4c2.8-2.8 5.4-3.4 7.6-2.2 2.8 1.5 3.4 4.9 1.7 7.7C18.7 16.65 12 21 12 21z" />
            </svg>
          </button>
        </div>

        {/* Action row */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto">
          <button type="button" onClick={triggerExit} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5]">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></ActionIcon>
            Exit
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <button
            type="button"
            onClick={onCompare}
            disabled={compareDisabled}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
              compareActive ? "bg-[#c8a96a]/15 text-[#c8a96a]" : "text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5]"
            }`}
          >
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h6M3 12l3-3M3 12l3 3M21 12h-6M21 12l-3-3M21 12l-3 3" /></svg></ActionIcon>
            Compare
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <button type="button" onClick={onZoom} disabled={!shareableUrl} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-30">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg></ActionIcon>
            Zoom
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <button type="button" onClick={() => void handleShare()} disabled={!shareableUrl || sharing} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-30">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M8 11l8-3.5M8 13l8 3.5" /></svg></ActionIcon>
            {sharing ? "Sharing…" : "Share"}
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <button type="button" onClick={handleDownload} disabled={!shareableUrl} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-30">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg></ActionIcon>
            Download
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <button type="button" onClick={onChangeRoom} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5]">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" /></svg></ActionIcon>
            Change Room
          </button>
          <div className="mx-1 h-4.5 w-px shrink-0 bg-white/10" />
          <Link href={productPageHref} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cfc6b8] hover:bg-white/5 hover:text-[#faf8f5]">
            <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg></ActionIcon>
            <span className="hidden lg:inline">Go to product page</span>
            <span className="lg:hidden">Product</span>
          </Link>
        </div>

        {/* CTA + menu */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEnquire}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#c8a96a] px-4 py-2.5 text-xs font-bold text-[#17130f] transition-colors hover:bg-[#d9bd83]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
              <path d="M4 4h2l1.6 10.4A2 2 0 009.6 16h7.8a2 2 0 002-1.6L21 8H6" /><circle cx="10" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" />
            </svg>
            <span className="hidden md:inline">Enquire About This Slab</span>
            <span className="md:hidden">Enquire</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-[#cfc6b8] hover:border-white/30"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-stone-200 bg-white py-1.5 shadow-xl"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => { onReset(); setMenuOpen(false); }}
                  className="block w-full px-4 py-2 text-left text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Reset scene
                </button>
                <button
                  type="button"
                  onClick={() => { onToggleDebug(); setMenuOpen(false); }}
                  className="block w-full px-4 py-2 text-left text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Toggle debug panel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {exiting && <ExitOverlay progress={progress} />}
    </>
  );
}
