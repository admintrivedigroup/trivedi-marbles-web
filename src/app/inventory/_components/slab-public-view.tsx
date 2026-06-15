"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Package, Phone, MessageCircle, Layers, X, ZoomIn } from "lucide-react";

import { withCloudinaryTransforms } from "@/lib/cloudinary/upload";
import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import type { SlabImage } from "@/app/inventory/_lib/slab-detail";
import { formatThickness, getStatusBadgeStyle } from "@/app/inventory/_lib/format";

const CONTACT_PHONE = "+919876543210";

type SlabPublicViewProps = {
  slab: InventoryListSlab;
  images: SlabImage[];
};

export function SlabPublicView({ slab, images }: SlabPublicViewProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const thickness = formatThickness(slab.thicknessName);
  const subtitle = [slab.categoryName, thickness].filter(Boolean).join(" · ");
  const sizeText =
    slab.length && slab.width
      ? `${slab.length}' × ${slab.width}'${slab.sqft ? ` (${slab.sqft} sqft)` : ""}`
      : null;

  const isSold = slab.statusName === "Sold";

  const whatsappMessage = encodeURIComponent(
    `Hi, I'm interested in slab ${slab.slabCode ?? slab.id} — ${slab.marbleName ?? ""}. Please share more details.`,
  );
  const whatsappUrl = `https://wa.me/${CONTACT_PHONE.replace(/\D/g, "")}?text=${whatsappMessage}`;
  const callUrl = `tel:${CONTACT_PHONE}`;

  return (
    <div className="inventory-theme min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-gray-900 px-5 py-3.5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
          Trivedi Grani Marmo
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-10 pt-5 space-y-4">
        {/* Image gallery */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 shadow-sm">
          {images.length > 0 ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group relative block w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withCloudinaryTransforms(images[activeIdx].imageUrl)}
                alt={`Slab ${slab.slabCode ?? ""}`}
                className="aspect-4/3 w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10 group-active:bg-black/20">
                <div className="rounded-full bg-black/30 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-5 w-5 text-white" />
                </div>
              </div>
            </button>
          ) : (
            <div className="flex aspect-4/3 items-center justify-center">
              <Package className="h-16 w-16 text-gray-300" />
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxOpen && images.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 active:bg-white/40"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withCloudinaryTransforms(images[activeIdx].imageUrl)}
              alt={`Slab ${slab.slabCode ?? ""}`}
              className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {images.length > 1 && (
              <p className="absolute bottom-4 text-sm text-white/60">
                {activeIdx + 1} / {images.length}
              </p>
            )}
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-100 transition-colors ${
                  idx === activeIdx ? "border-gray-800" : "border-transparent hover:border-gray-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={withCloudinaryTransforms(img.imageUrl)}
                  alt={`Photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Main info card */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight text-gray-900">
                  {slab.marbleName ?? "—"}
                </h1>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeStyle(slab.statusName)}`}
              >
                {slab.statusName ?? "Unknown"}
              </span>
            </div>
          </div>

          {/* Specs */}
          <div className="divide-y divide-gray-50 border-t border-gray-100">
            {slab.slabCode && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-gray-500">Slab ID</span>
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {slab.slabCode}
                </span>
              </div>
            )}
            {sizeText && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-gray-500">Size</span>
                <span className="text-sm font-semibold text-gray-900">{sizeText}</span>
              </div>
            )}
            {thickness && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-gray-500">Thickness</span>
                <span className="text-sm font-semibold text-gray-900">{thickness}</span>
              </div>
            )}
            {slab.lotNumber && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Layers className="h-3.5 w-3.5" />
                  Lot
                </span>
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {slab.lotNumber}
                </span>
              </div>
            )}
            {slab.warehouseName && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {slab.warehouseName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CTA card */}
        {!isSold && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Interested in this slab?</p>
            <p className="mt-1 text-sm text-gray-500">
              Contact us to check availability, pricing, and samples.
            </p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Us
              </a>
              <a
                href={callUrl}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" />
                Call Us
              </a>
            </div>
          </div>
        )}

        {isSold && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-gray-600">This slab has been sold</p>
            <p className="mt-1 text-xs text-gray-400">
              Contact us — we may have similar material available.
            </p>
            <a
              href={callUrl}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Phone className="h-4 w-4" />
              Call Us
            </a>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Trivedi Grani Marmo · Natural Stone Specialists</p>

        <p className="text-center">
          <Link
            href={`/inventory/login?next=/inventory/slab/${slab.id}`}
            className="text-[11px] text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
          >
            Login as staff
          </Link>
        </p>
      </div>
    </div>
  );
}
