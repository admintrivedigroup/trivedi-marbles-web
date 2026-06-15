"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Edit2,
  FileText,
  History,
  MapPin,
  Package,
  Printer,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { withCloudinaryTransforms } from "@/lib/cloudinary/upload";
import type { SlabImage, SlabMovement, ReservationHistoryEntry } from "@/app/inventory/_lib/slab-detail";

import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import {
  updateSlabStatus,
  type SlabStatusName,
} from "@/app/inventory/_actions/update-slab-status";
import { deleteSlab } from "@/app/inventory/_actions/delete-slab";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReserveDialog, type ReservationData } from "@/app/inventory/_components/reserve-dialog";
import {
  formatCurrency as fmtCurrency,
  formatDate,
  formatDateTime,
  formatThickness,
  getStatusColor,
} from "@/app/inventory/_lib/format";

type SlabDetailProps = {
  images: SlabImage[];
  movements: SlabMovement[];
  reservationHistory: ReservationHistoryEntry[];
  slab: InventoryListSlab;
  canViewCostPrice: boolean;
  isInTransit?: boolean;
};


function SpecRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p
          className={`mt-0.5 text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

const PAGE_SIZE = 5;

function MovementHistory({ movements }: { movements: SlabMovement[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(movements.length / PAGE_SIZE);
  const pageMovements = movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <History className="h-4 w-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Movement History</h2>
        {movements.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{movements.length} total</span>
        )}
      </div>

      {movements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ArrowLeftRight className="h-7 w-7 text-gray-200" />
          <p className="text-xs text-gray-400">No movements recorded yet</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {pageMovements.map((movement, index) => (
              <div key={movement.id} className="flex gap-3 px-4 py-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  {index < pageMovements.length - 1 && (
                    <div className="w-px flex-1 bg-gray-100" />
                  )}
                </div>
                <div className="min-w-0 pb-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {movement.eventType}
                  </p>
                  {movement.fromLocation && movement.toLocation && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {movement.fromLocation}
                      <span className="text-gray-300">→</span>
                      {movement.toLocation}
                    </p>
                  )}
                  {movement.notes && (
                    <p className="mt-0.5 text-xs text-gray-400">{movement.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReservationHistory({ entries }: { entries: ReservationHistoryEntry[] }) {
  if (entries.length === 0) return null;

  function dotColor(after: string | null) {
    if (after === "Reserved") return "bg-orange-400";
    if (after === "Sold") return "bg-gray-300";
    return "bg-green-400";
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <Clock className="h-4 w-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Reservation History</h2>
        <span className="ml-auto text-xs text-gray-400">{entries.length} event{entries.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {entries.map((entry, index) => (
          <div key={entry.id} className="flex gap-3 px-4 py-3">
            <div className="flex flex-col items-center gap-1">
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor(entry.after)}`} />
              {index < entries.length - 1 && <div className="w-px flex-1 bg-gray-100" />}
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-sm font-medium text-gray-900">
                {entry.before ?? "—"} → {entry.after ?? "—"}
                {entry.reservedFor && (
                  <span className="ml-1.5 font-normal text-gray-600">for {entry.reservedFor}</span>
                )}
              </p>
              {entry.reservedUntil && (
                <p className="mt-0.5 text-xs text-gray-500">Until {formatDate(entry.reservedUntil) ?? entry.reservedUntil}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">{formatDateTime(entry.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SlabDetail({ images, movements, reservationHistory, slab, canViewCostPrice, isInTransit = false }: SlabDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<SlabStatusName | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const [priceBasis, setPriceBasis] = useState<"cost" | "selling" | "dealer">("selling");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
      if (e.key === "ArrowRight") setActiveImageIndex((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setActiveImageIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, images.length]);

  const sqft = slab.sqft ?? 0;
  const selectedPrice =
    priceBasis === "cost"
      ? slab.costPrice
      : priceBasis === "dealer"
        ? slab.dealerPrice
        : slab.sellingPrice;
  const totalValue = selectedPrice !== null && sqft > 0 ? selectedPrice * sqft : null;

  const sizeLabel =
    slab.length && slab.width ? (
      <>
        {slab.length}&apos; × {slab.width}&apos; ({sqft} sqft{" "}
        <span className="font-light text-gray-400">(estimate)</span>)
      </>
    ) : (
      "-"
    );

  function requestStatusChange(status: SlabStatusName) {
    setActionError(null);
    setPendingAction(status);
  }

  function confirmStatusChange() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    startTransition(async () => {
      const result = await updateSlabStatus(slab.id, action);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleReserveConfirm(data: ReservationData) {
    setShowReserveDialog(false);
    startTransition(async () => {
      const result = await updateSlabStatus(slab.id, "Reserved", data);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    setShowDeleteConfirm(false);
    startTransition(async () => {
      const result = await deleteSlab(slab.id);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.push(result.lotId ? `/inventory/lot/${result.lotId}` : "/inventory/list");
      }
    });
  }

  const isReserved = slab.statusName === "Reserved";
  const isSold = slab.statusName === "Sold";

  return (
    <>
      <div className="px-4 py-4 md:px-8">
        <Link
          href="/inventory/list"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
      </div>

      <div className="px-4 pb-10 md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left column — fixed narrow width */}
          <div className="shrink-0 space-y-3 lg:w-172.5">
            {/* Main photo */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm">
              {images.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="relative w-full cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withCloudinaryTransforms(images[activeImageIndex].imageUrl)}
                    alt={`Slab ${slab.slabCode ?? ""}`}
                    className="aspect-9/8 w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex aspect-9/8 items-center justify-center">
                  <Package className="h-16 w-16 text-gray-200" />
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            <div className="flex gap-2 overflow-x-auto">
              {images.length > 0 ? (
                images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`shrink-0 h-14 w-14 overflow-hidden rounded-xl border-2 bg-gray-50 transition-colors ${
                      idx === activeImageIndex
                        ? "border-gray-800"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={withCloudinaryTransforms(img.imageUrl)}
                      alt={`Photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))
              ) : (
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-800 bg-gray-50">
                  <Package className="h-5 w-5 text-gray-200" />
                </div>
              )}
            </div>

            {/* Movement history */}
            <MovementHistory movements={movements} />

            {/* Reservation history */}
            <ReservationHistory entries={reservationHistory} />
          </div>

          {/* Right column — detail card, grows to fill space */}
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Header */}
            <div className="p-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold leading-tight text-gray-900">
                  {slab.marbleName ?? "-"}
                </h1>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(slab.statusName)}`}
                >
                  {slab.statusName ?? "Unknown"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {slab.categoryName ?? "-"}
              </p>
            </div>

            {/* Specs */}
            <div className="border-t border-gray-100 px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <SpecRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Size"
                  value={sizeLabel}
                />
                <SpecRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Thickness"
                  value={formatThickness(slab.thicknessName) ?? "-"}
                />
                <SpecRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={slab.warehouseName ?? "-"}
                />
                <SpecRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Rack"
                  value={slab.rackNumber ?? "-"}
                />
                <SpecRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Added"
                  value={formatDate(slab.createdAt) ?? "-"}
                />
                <SpecRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Slab ID"
                  value={slab.slabCode ?? "-"}
                  mono
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t border-gray-100 px-6 py-5">
              <h2 className="mb-4 font-semibold text-gray-900">Pricing</h2>
              <div className={`grid gap-4 ${canViewCostPrice ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"}`}>
                {canViewCostPrice && (
                  <div>
                    <p className="text-xs text-gray-500">Cost Price</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      {fmtCurrency(slab.costPrice)}
                    </p>
                    <p className="text-xs text-gray-400">per sqft <span className="font-light text-gray-300">(estimate)</span></p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Sell Price</p>
                  <p className="mt-1 text-xl font-bold text-green-600">
                    {fmtCurrency(slab.sellingPrice)}
                  </p>
                  <p className="text-xs text-gray-400">per sqft <span className="font-light text-gray-300">(estimate)</span></p>
                </div>
                {canViewCostPrice && (
                  <div>
                    <p className="text-xs text-gray-500">Dealer Price</p>
                    <p className="mt-1 text-xl font-bold text-blue-600">
                      {fmtCurrency(slab.dealerPrice)}
                    </p>
                    <p className="text-xs text-gray-400">per sqft <span className="font-light text-gray-300">(estimate)</span></p>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-700">
                    Total Value:{" "}
                    <span className="font-semibold text-gray-900">
                      {totalValue !== null ? fmtCurrency(totalValue) : "-"}
                    </span>
                  </p>
                  {canViewCostPrice && (
                    <select
                      value={priceBasis}
                      onChange={(e) =>
                        setPriceBasis(e.target.value as "cost" | "selling" | "dealer")
                      }
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                    >
                      <option value="cost">by Cost Price</option>
                      <option value="selling">by Selling Price</option>
                      <option value="dealer">by Dealer Price</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {slab.notes ? (
              <div className="border-t border-gray-100 px-6 py-5">
                <h2 className="mb-2 font-semibold text-gray-900">Notes</h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  {slab.notes}
                </p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="border-t border-gray-100 px-6 py-5">
              <h2 className="mb-4 font-semibold text-gray-900">Actions</h2>

              {isInTransit && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  <span className="font-medium">In Transit</span>
                  <span className="text-blue-500">—</span>
                  This slab is currently being transferred. Editing and reserving are disabled until it is received at the destination.
                </div>
              )}

              {isReserved && slab.reservedFor && (
                <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Reserved</p>
                  <p className="mt-1 text-sm font-semibold text-orange-900">{slab.reservedFor}</p>
                  {slab.reservedUntil && (() => {
                    const expiry = new Date(slab.reservedUntil + "T23:59:59");
                    const isExpired = expiry < new Date();
                    return (
                      <p className={`mt-0.5 text-xs ${isExpired ? "font-medium text-red-600" : "text-orange-600"}`}>
                        {isExpired ? "Expired · was due " : "Until "}
                        {formatDate(slab.reservedUntil) ?? "-"}
                      </p>
                    );
                  })()}
                </div>
              )}

              {actionError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                {/* Row 1 — Edit */}
                {isInTransit ? (
                  <div className="col-span-2 flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400">
                    <Edit2 className="h-4 w-4" />
                    Edit Details
                  </div>
                ) : (
                  <Link
                    href={`/inventory/edit/${slab.id}`}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl border-2 border-gray-800 bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-800 hover:text-white hover:shadow-md active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Details
                  </Link>
                )}

                {/* Row 2 — Status */}
                {isReserved ? (
                  <button
                    type="button"
                    onClick={() => requestStatusChange("Available")}
                    disabled={isPending || isInTransit}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gray-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-gray-600 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Unreserve
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReserveDialog(true)}
                    disabled={isPending || isSold || isInTransit}
                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-orange-600 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clock className="h-4 w-4" />
                    Reserve
                  </button>
                )}

                {isSold ? (
                  <button
                    type="button"
                    onClick={() => requestStatusChange("Available")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gray-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-gray-600 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Mark Available
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestStatusChange("Sold")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-green-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <DollarSign className="h-4 w-4" />
                    Mark as Sold
                  </button>
                )}

                {/* Row 3 — Documents */}
                <Link
                  href={`/inventory/quotations?slabId=${slab.id}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
                >
                  <FileText className="h-4 w-4" />
                  Create Quote
                </Link>

                <a
                  href={`/inventory/slab/${slab.id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4" />
                  Print Label
                </a>

                {/* Row 4 — Delete */}
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-all hover:bg-red-50 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Slab
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReserveDialog
        open={showReserveDialog}
        onCancel={() => setShowReserveDialog(false)}
        onConfirm={handleReserveConfirm}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "Reserved"
            ? "Reserve this slab?"
            : pendingAction === "Available"
              ? "Mark this slab as available?"
              : "Mark this slab as sold?"
        }
        description={
          pendingAction === "Reserved"
            ? "This will mark the slab as reserved. It will no longer appear as available to other customers."
            : pendingAction === "Available"
              ? "This will mark the slab as available again and remove its current reserved or sold status."
              : "This will mark the slab as sold. Only do this once the sale is confirmed and complete."
        }
        confirmLabel={
          pendingAction === "Reserved"
            ? "Reserve"
            : pendingAction === "Available"
              ? "Mark as Available"
              : "Mark as Sold"
        }
        cancelLabel="Cancel"
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this slab?"
        description={`This will permanently delete slab ${slab.slabCode ?? ""} and all its photos. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {isFullscreen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {activeImageIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => i - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Next */}
          {activeImageIndex < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => i + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withCloudinaryTransforms(images[activeImageIndex].imageUrl)}
            alt={`Slab ${slab.slabCode ?? ""}`}
            className="max-h-screen max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              {activeImageIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
