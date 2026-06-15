"use client";

import Link from "next/link";
import { Layers, MapPin, Package, Phone, MessageCircle } from "lucide-react";

import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import type { LotInfo } from "@/app/inventory/_lib/lot-detail";
import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import { formatThickness, getStatusBadgeStyle } from "@/app/inventory/_lib/format";

const CONTACT_PHONE = "+919876543210";

type LotPublicViewProps = {
  lot: LotInfo;
  slabs: InventoryListSlab[];
};

export function LotPublicView({ lot, slabs }: LotPublicViewProps) {
  const thickness = formatThickness(lot.thicknessName);
  const subtitle = [lot.categoryName, thickness].filter(Boolean).join(" · ");
  const availableSlabs = slabs.filter((s) => s.statusName === "Available");

  const whatsappMessage = encodeURIComponent(
    `Hi, I'm interested in lot ${lot.lotNumber ?? lot.id} — ${lot.marbleName ?? ""}. Please share more details.`,
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

      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-5">
        {/* Lot info card */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight text-gray-900">
                  {lot.marbleName ?? "—"}
                </h1>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1">
                <Layers className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-mono text-xs font-semibold text-gray-700">
                  {lot.lotNumber ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Total slabs</span>
              <span className="text-sm font-semibold text-gray-900">{slabs.length}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Available</span>
              <span className="text-sm font-semibold text-green-700">{availableSlabs.length}</span>
            </div>
            {lot.warehouseName && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </span>
                <span className="text-sm font-semibold text-gray-900">{lot.warehouseName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Slabs list */}
        {slabs.length > 0 && (
          <div>
            <h2 className="mb-2.5 px-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Slabs in this lot
            </h2>
            <div className="space-y-2">
              {slabs.map((slab) => {
                const sizeText =
                  slab.length && slab.width
                    ? `${slab.length}' × ${slab.width}'${slab.sqft ? ` (${slab.sqft} sqft)` : ""}`
                    : null;

                return (
                  <Link
                    key={slab.id}
                    href={`/inventory/slab/${slab.id}/view`}
                    className="flex items-center gap-3.5 overflow-hidden rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.99]"
                  >
                    {/* Thumbnail */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {slab.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={withCloudinaryThumbnail(slab.thumbnailUrl)}
                          alt={slab.slabCode ?? "Slab"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold text-gray-900">
                        {slab.slabCode ?? "—"}
                      </p>
                      {sizeText && (
                        <p className="mt-0.5 text-xs text-gray-500">{sizeText}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusBadgeStyle(slab.statusName)}`}
                    >
                      {slab.statusName ?? "—"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact CTA */}
        {availableSlabs.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Interested in this lot?</p>
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

        <p className="text-center text-xs text-gray-400">
          Trivedi Grani Marmo · Natural Stone Specialists
        </p>

        <p className="text-center">
          <Link
            href={`/inventory/login?next=/inventory/lot/${lot.id}/view`}
            className="text-[11px] text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
          >
            Login as staff
          </Link>
        </p>
      </div>
    </div>
  );
}
