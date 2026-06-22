"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  DollarSign,
  Edit,
  FileText,
  Globe,
  GlobeLock,
  MapPin,
  Package,
  Plus,
  Printer,
  Receipt,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { withCloudinaryTransforms } from "@/lib/cloudinary/upload";
import type { LotInfo } from "@/app/inventory/_lib/lot-detail";
import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import {
  updateSlabStatus,
  type SlabStatusName,
} from "@/app/inventory/_actions/update-slab-status";
import { updateLotSlabsStatus } from "@/app/inventory/_actions/update-lot-status";
import { batchUpdateSlabsStatus } from "@/app/inventory/_actions/batch-update-slab-status";
import { batchDeleteSlabs } from "@/app/inventory/_actions/batch-delete-slabs";
import { batchUpdateSlabPrice } from "@/app/inventory/_actions/batch-update-slab-price";
import { cloneLot } from "@/app/inventory/_actions/clone-lot";
import { deleteSlab } from "@/app/inventory/_actions/delete-slab";
import { deleteLot } from "@/app/inventory/_actions/delete-lot";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReserveDialog, type ReservationData } from "@/app/inventory/_components/reserve-dialog";
import { toggleLotWebsite } from "@/app/inventory/_actions/toggle-lot-website";
import {
  formatNumber as fmtNum,
  formatCurrency as fmtCurrency,
  formatDate as fmtDate,
  formatThickness as fmtThickness,
  formatSize as fmtSize,
  getStatusColor,
} from "@/app/inventory/_lib/format";

type LotDetailProps = {
  lot: LotInfo;
  slabs: InventoryListSlab[];
};

type StatusFilter = "All" | "Available" | "Reserved" | "Sold";

type PendingAction = {
  slabId: string;
  slabCode: string | null;
  status: "Sold" | "Available";
};

type PendingReserveSlab = {
  slabId: string;
  slabCode: string | null;
};

type PendingSlabDelete = {
  slabId: string;
  slabCode: string | null;
};


function SlabThumbnail({ imageUrl }: { imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={withCloudinaryTransforms(imageUrl)}
        alt="Slab"
        className="aspect-4/3 w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-4/3 w-full items-center justify-center bg-gray-100">
      <Package className="h-10 w-10 text-gray-300" />
    </div>
  );
}

function StatusTab({
  label,
  count,
  active,
  onClick,
}: {
  label: StatusFilter;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
          active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="text-[11px] leading-tight text-gray-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${colorClass ?? "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

export function LotDetail({ lot, slabs }: LotDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingReserveSlab, setPendingReserveSlab] = useState<PendingReserveSlab | null>(null);
  type ActiveModal =
    | "bulk-reserve" | "bulk-sold" | "bulk-unreserve" | "bulk-unsell"
    | "delete-lot" | "clone-lot"
    | "selection-reserve" | "selection-sold" | "selection-unreserve" | "selection-unsell" | "selection-delete" | "selection-price"
    | null;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [pendingSlabDelete, setPendingSlabDelete] = useState<PendingSlabDelete | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [priceBasis, setPriceBasis] = useState<"selling" | "dealer">("selling");
  const [showOnWebsite, setShowOnWebsite] = useState(lot.showOnWebsite);
  const [cloneLotNumber, setCloneLotNumber] = useState("");
  const [priceFormValues, setPriceFormValues] = useState({ sell: "", dealer: "" });
  const [isTogglingWebsite, setIsTogglingWebsite] = useState(false);

  // --- Selection state ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const counts = {
    All: slabs.length,
    Available: slabs.filter((s) => s.statusName === "Available").length,
    Reserved: slabs.filter((s) => s.statusName === "Reserved").length,
    Sold: slabs.filter((s) => s.statusName === "Sold").length,
  };

  const visibleSlabs =
    statusFilter === "All"
      ? slabs
      : slabs.filter((s) => s.statusName === statusFilter);

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const totalSqft = slabs.reduce((sum, s) => sum + (s.sqft ?? 0), 0);
  const selectedLotPrice = priceBasis === "dealer" ? lot.dealerPrice : lot.sellingPrice;
  const totalValue =
    selectedLotPrice !== null && totalSqft > 0
      ? selectedLotPrice * totalSqft
      : null;

  // Derived selection data
  const selectedSlabs = slabs.filter((s) => selectedIds.has(s.id));
  const selectionAvailableIds = selectedSlabs
    .filter((s) => s.statusName === "Available")
    .map((s) => s.id);
  const selectionReservedIds = selectedSlabs
    .filter((s) => s.statusName === "Reserved")
    .map((s) => s.id);
  const selectionSoldIds = selectedSlabs
    .filter((s) => s.statusName === "Sold")
    .map((s) => s.id);
  const selectionSellableIds = [...selectionAvailableIds, ...selectionReservedIds];

  function requestStatusChange(
    slabId: string,
    slabCode: string | null,
    status: "Sold" | "Available",
  ) {
    setActionError(null);
    setPendingAction({ slabId, slabCode, status });
  }

  function confirmStatusChange() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    startTransition(async () => {
      const result = await updateSlabStatus(action.slabId, action.status);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleSlabReserveConfirm(data: ReservationData) {
    if (!pendingReserveSlab) return;
    const { slabId } = pendingReserveSlab;
    setPendingReserveSlab(null);
    startTransition(async () => {
      const result = await updateSlabStatus(slabId, "Reserved", data);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleBulkReserveConfirm(data: ReservationData) {
    setActiveModal(null);
    startTransition(async () => {
      const result = await updateLotSlabsStatus(lot.id, "Reserved", data);
      if (result.error) { setActionError(result.error); } else { router.refresh(); }
    });
  }

  function confirmBulkSold() {
    setActiveModal(null);
    startTransition(async () => {
      const result = await updateLotSlabsStatus(lot.id, "Sold");
      if (result.error) { setActionError(result.error); } else { router.refresh(); }
    });
  }

  function confirmBulkUnreserve() {
    setActiveModal(null);
    startTransition(async () => {
      const result = await updateLotSlabsStatus(lot.id, "UnreserveLot");
      if (result.error) { setActionError(result.error); } else { router.refresh(); }
    });
  }

  function confirmBulkUnsell() {
    setActiveModal(null);
    startTransition(async () => {
      const result = await updateLotSlabsStatus(lot.id, "UnsellLot");
      if (result.error) { setActionError(result.error); } else { router.refresh(); }
    });
  }

  function confirmSlabDelete() {
    if (!pendingSlabDelete) return;
    const { slabId } = pendingSlabDelete;
    setPendingSlabDelete(null);
    startTransition(async () => {
      const result = await deleteSlab(slabId);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function confirmLotDelete() {
    setActiveModal(null);
    startTransition(async () => {
      const result = await deleteLot(lot.id);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.push("/inventory/list");
      }
    });
  }

  async function handleToggleWebsite() {
    setIsTogglingWebsite(true);
    setActionError(null);
    const result = await toggleLotWebsite(lot.id, showOnWebsite);
    setIsTogglingWebsite(false);
    if (result.error) {
      setActionError(result.error);
    } else {
      setShowOnWebsite(result.showOnWebsite ?? !showOnWebsite);
    }
  }

  // --- Selection handlers ---
  function toggleSelectMode() {
    setIsSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSlab(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visibleSlabs.map((s) => s.id)));
  }

  function handleSelectionReserveConfirm(data: ReservationData) {
    setActiveModal(null);
    if (selectionAvailableIds.length === 0) return;
    const ids = selectionAvailableIds;
    startTransition(async () => {
      const result = await batchUpdateSlabsStatus(ids, "Reserved", lot.id, data);
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); router.refresh(); }
    });
  }

  function confirmSelectionSold() {
    setActiveModal(null);
    if (selectionSellableIds.length === 0) return;
    const ids = selectionSellableIds;
    startTransition(async () => {
      const result = await batchUpdateSlabsStatus(ids, "Sold", lot.id);
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); router.refresh(); }
    });
  }

  function confirmSelectionUnreserve() {
    setActiveModal(null);
    if (selectionReservedIds.length === 0) return;
    const ids = selectionReservedIds;
    startTransition(async () => {
      const result = await batchUpdateSlabsStatus(ids, "Available", lot.id);
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); router.refresh(); }
    });
  }

  function confirmSelectionUnsell() {
    setActiveModal(null);
    if (selectionSoldIds.length === 0) return;
    const ids = selectionSoldIds;
    startTransition(async () => {
      const result = await batchUpdateSlabsStatus(ids, "Available", lot.id);
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); router.refresh(); }
    });
  }

  function confirmSelectionDelete() {
    setActiveModal(null);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await batchDeleteSlabs(ids, lot.id);
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); router.refresh(); }
    });
  }

  function confirmSelectionPriceUpdate() {
    setActiveModal(null);
    const ids = Array.from(selectedIds);
    const sell = priceFormValues.sell ? Number(priceFormValues.sell) : null;
    const dealer = priceFormValues.dealer ? Number(priceFormValues.dealer) : null;
    if (sell === null && dealer === null) {
      setActionError("Enter at least one price to update.");
      return;
    }
    startTransition(async () => {
      const result = await batchUpdateSlabPrice(ids, lot.id, {
        sellingPrice: sell,
        dealerPrice: dealer,
      });
      if (result.error) { setActionError(result.error); }
      else { setSelectedIds(new Set()); setPriceFormValues({ sell: "", dealer: "" }); router.refresh(); }
    });
  }

  function confirmCloneLot() {
    setActiveModal(null);
    const newNumber = cloneLotNumber.trim();
    if (!newNumber) { setActionError("New lot number is required."); return; }
    startTransition(async () => {
      const result = await cloneLot(lot.id, newNumber);
      if (result.error) { setActionError(result.error); }
      else if (result.newLotId) {
        setCloneLotNumber("");
        router.push(`/inventory/lot/${result.newLotId}`);
      }
    });
  }

  const thickness = fmtThickness(lot.thicknessName);
  const addedDate = fmtDate(lot.createdAt);
  const purchaseDate = fmtDate(lot.purchaseDate);

  return (
    <>
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/inventory/list"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-bold text-gray-900 md:text-3xl">
                {lot.lotNumber ?? "—"}
              </span>
              {lot.categoryName ? (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {lot.categoryName}
                </span>
              ) : null}
              {thickness ? (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {thickness}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-700">
              {lot.marbleName ?? "—"}
            </p>
          </div>
          <Link
            href={`/inventory/lot/${lot.id}/edit`}
            className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Edit Lot
          </Link>
        </div>
      </div>

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {/* Main layout: gallery left, summary right */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_272px] lg:grid-cols-3">
        {/* ── Left: Slab gallery ── */}
        <div className="lg:col-span-2">
          {/* Status filter tabs + Select toggle */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Available", "Reserved", "Sold"] as StatusFilter[]).map(
                (tab) => (
                  <StatusTab
                    key={tab}
                    label={tab}
                    count={counts[tab]}
                    active={statusFilter === tab}
                    onClick={() => setStatusFilter(tab)}
                  />
                ),
              )}
            </div>
            {isSelectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedIds.size} selected
                </span>
                {visibleSlabs.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-sm text-gray-700 underline hover:text-gray-900"
                  >
                    Select all {visibleSlabs.length}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Select
              </button>
            )}
          </div>

          {visibleSlabs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
              <Package className="h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">
                No {statusFilter !== "All" ? statusFilter.toLowerCase() : ""}{" "}
                slabs in this lot
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {visibleSlabs.map((slab) => {
                const isReserved = slab.statusName === "Reserved";
                const isSold = slab.statusName === "Sold";
                const isSelected = selectedIds.has(slab.id);
                const isExpired = isReserved && !!slab.reservedUntil && new Date(slab.reservedUntil) < now;
                const isExpiringSoon = isReserved && !isExpired && !!slab.reservedUntil && new Date(slab.reservedUntil) <= threeDaysFromNow;
                const size = fmtSize(slab.length, slab.width);

                return (
                  <div
                    key={slab.id}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                      isSelected
                        ? "border-gray-900 ring-2 ring-gray-900/20"
                        : "border-gray-100 hover:shadow-md"
                    }`}
                  >
                    {/* Clickable area: photo + info */}
                    <div className="relative">
                      {/* Select mode overlay — captures clicks over photo+info */}
                      {isSelectMode && (
                        <button
                          type="button"
                          onClick={() => toggleSlab(slab.id)}
                          className="absolute inset-0 z-10 cursor-pointer"
                          aria-label={isSelected ? "Deselect slab" : "Select slab"}
                        >
                          <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded border-2 shadow-sm transition-colors"
                            style={{
                              background: isSelected ? "#111827" : "rgba(255,255,255,0.85)",
                              borderColor: isSelected ? "#111827" : "#fff",
                            }}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </span>
                        </button>
                      )}
                      <Link href={`/inventory/slab/${slab.id}`} className="block">
                        {/* Photo */}
                        <SlabThumbnail imageUrl={slab.thumbnailUrl} />

                        {/* Info */}
                        <div className="px-3 pt-3 pb-2">
                          <div className="mb-1.5 flex items-start justify-between gap-1">
                            <span className="font-mono text-sm font-bold text-gray-900 leading-tight">
                              {slab.slabCode ?? "—"}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(slab.statusName)}`}
                            >
                              {slab.statusName ?? "—"}
                            </span>
                          </div>
                          {size ? (
                            <p className="text-xs text-gray-500">
                              {size} &middot; {fmtNum(slab.sqft)} sqft <span className="font-light text-gray-400">(estimate)</span>
                            </p>
                          ) : null}
                          {(slab.warehouseName || slab.rackNumber) ? (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[slab.warehouseName, slab.rackNumber]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {isReserved && (
                            <div className="mt-1 space-y-0.5">
                              {(isExpired || isExpiringSoon) && (
                                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isExpired ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                                  {isExpired ? "Expired" : "Expiring soon"}
                                </span>
                              )}
                              {slab.reservedFor && (
                                <p className={`truncate text-xs font-medium ${isExpired ? "text-red-500" : "text-orange-600"}`}>
                                  {slab.reservedFor}
                                  {slab.reservedUntil ? (
                                    <span className={`ml-1 font-normal ${isExpired ? "text-red-400" : "text-orange-400"}`}>
                                      · until {fmtDate(slab.reservedUntil)}
                                    </span>
                                  ) : null}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    </div>

                    {/* Footer: price + actions */}
                    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {fmtCurrency(slab.sellingPrice)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {isReserved ? (
                          <button
                            type="button"
                            title="Unreserve"
                            disabled={isPending}
                            onClick={() => requestStatusChange(slab.id, slab.slabCode, "Available")}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Reserve"
                            disabled={isPending || isSold}
                            onClick={() => { setActionError(null); setPendingReserveSlab({ slabId: slab.id, slabCode: slab.slabCode }); }}
                            className="rounded-lg p-1.5 text-orange-500 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Mark as Sold"
                          disabled={isPending || isSold}
                          onClick={() =>
                            requestStatusChange(slab.id, slab.slabCode, "Sold")
                          }
                          className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/inventory/edit/${slab.id}`}
                          title="Edit"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          title="Delete"
                          disabled={isPending}
                          onClick={() =>
                            setPendingSlabDelete({ slabId: slab.id, slabCode: slab.slabCode })
                          }
                          className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Lot summary ── */}
        <div className="space-y-3 lg:col-span-1 lg:space-y-4">
          {/* Lot info */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Lot Summary
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Slabs" value={counts.All} />
              <StatBox label="Total Sqft (estimate)" value={fmtNum(totalSqft)} />
              <StatBox
                label="Available"
                value={counts.Available}
                colorClass="text-green-600"
              />
              <StatBox
                label="Reserved"
                value={counts.Reserved}
                colorClass="text-orange-500"
              />
            </div>

            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {lot.warehouseName ? (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={lot.warehouseName}
                />
              ) : null}
              {thickness ? (
                <InfoRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Thickness"
                  value={thickness}
                />
              ) : null}
              {addedDate ? (
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Added"
                  value={addedDate}
                />
              ) : null}
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Pricing
              </h2>
              <select
                value={priceBasis}
                onChange={(e) =>
                  setPriceBasis(e.target.value as "selling" | "dealer")
                }
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-800"
              >
                <option value="selling">Sell Price</option>
                <option value="dealer">Dealer Price</option>
              </select>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {fmtCurrency(selectedLotPrice)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">per sqft <span className="font-light text-gray-300">(estimate)</span></p>

            {totalValue !== null ? (
              <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Total Lot Value</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">
                  {fmtCurrency(totalValue)}
                </p>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-gray-100 pt-3">
              {[
                { label: "Sell", value: lot.sellingPrice },
                { label: "Dealer", value: lot.dealerPrice },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[11px] text-gray-400">{label}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-gray-800">
                    {fmtCurrency(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase info */}
          {(lot.invoiceNumber || purchaseDate) ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Purchase Info
              </h2>
              <div className="space-y-3">
                {lot.invoiceNumber ? (
                  <InfoRow
                    icon={<Receipt className="h-4 w-4" />}
                    label="Invoice"
                    value={lot.invoiceNumber}
                  />
                ) : null}
                {purchaseDate ? (
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Purchase Date"
                    value={purchaseDate}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {lot.notes ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">
                {lot.notes}
              </p>
            </div>
          ) : null}

          {/* Website Visibility */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Website
            </h2>
            <button
              type="button"
              disabled={isTogglingWebsite}
              onClick={handleToggleWebsite}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                showOnWebsite
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                {showOnWebsite ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <GlobeLock className="h-4 w-4" />
                )}
                {showOnWebsite ? "Shown on Website" : "Hidden from Website"}
              </span>
              <span
                className={`h-5 w-9 rounded-full transition-colors ${
                  showOnWebsite ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`block h-5 w-5 translate-y-0 rounded-full bg-white shadow-sm ring-1 ring-gray-200 transition-transform ${
                    showOnWebsite ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
            <p className="mt-2 text-xs text-gray-400">
              {showOnWebsite
                ? "This lot is visible on the public collection page."
                : "Toggle to show this lot on the public collection page."}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link
              href={`/inventory/lot/${lot.id}/add-slab`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-900 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-900 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add Slab
            </Link>

            <button
              type="button"
              disabled={isPending || counts.Available === 0}
              onClick={() => { setActionError(null); setActiveModal("bulk-reserve"); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Clock className="h-4 w-4" />
              Reserve Lot ({counts.Available} available)
            </button>

            {counts.Reserved > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setActionError(null); setActiveModal("bulk-unreserve"); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                Unreserve Lot ({counts.Reserved} reserved)
              </button>
            )}

            <button
              type="button"
              disabled={isPending || (counts.Available === 0 && counts.Reserved === 0)}
              onClick={() => { setActionError(null); setActiveModal("bulk-sold"); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DollarSign className="h-4 w-4" />
              Mark Lot as Sold ({counts.Available + counts.Reserved} slabs)
            </button>

            {counts.Sold > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setActionError(null); setActiveModal("bulk-unsell"); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                Mark Lot as Available ({counts.Sold} sold)
              </button>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={() => { setCloneLotNumber(""); setActionError(null); setActiveModal("clone-lot"); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Clone Lot
            </button>

            <Link
              href={`/inventory/quotations?lotId=${lot.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              Create Quotation
            </Link>
            <a
              href={`/inventory/lot/${lot.id}/labels`}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={counts.Available === 0}
              onClick={counts.Available === 0 ? (e) => e.preventDefault() : undefined}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium transition-colors ${
                counts.Available === 0
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Printer className="h-4 w-4" />
              Print QR Labels ({counts.Available} available)
            </a>
            <button
              type="button"
              onClick={() => setActiveModal("delete-lot")}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Lot
            </button>
          </div>
        </div>
      </div>

      {/* Floating selection action bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} slab{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              {selectionAvailableIds.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { setActionError(null); setActiveModal("selection-reserve"); }}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Reserve ({selectionAvailableIds.length})
                </button>
              )}
              {selectionSellableIds.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { setActionError(null); setActiveModal("selection-sold"); }}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Mark Sold ({selectionSellableIds.length})
                </button>
              )}
              {selectionReservedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { setActionError(null); setActiveModal("selection-unreserve"); }}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Unreserve ({selectionReservedIds.length})
                </button>
              )}
              {selectionSoldIds.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { setActionError(null); setActiveModal("selection-unsell"); }}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Mark Available ({selectionSoldIds.length})
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setPriceFormValues({ cost: "", sell: "", dealer: "" }); setActionError(null); setActiveModal("selection-price"); }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Tag className="h-3.5 w-3.5" />
                Update Prices
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setActionError(null); setActiveModal("selection-delete"); }}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual slab reserve */}
      <ReserveDialog
        open={pendingReserveSlab !== null}
        onCancel={() => setPendingReserveSlab(null)}
        onConfirm={handleSlabReserveConfirm}
      />

      {/* Bulk lot reserve */}
      <ReserveDialog
        open={activeModal === "bulk-reserve"}
        onCancel={() => setActiveModal(null)}
        onConfirm={handleBulkReserveConfirm}
        bulk
      />

      {/* Selection reserve */}
      <ReserveDialog
        open={activeModal === "selection-reserve"}
        onCancel={() => setActiveModal(null)}
        onConfirm={handleSelectionReserveConfirm}
        bulk
      />

      {/* Bulk lot sold */}
      <ConfirmDialog
        open={activeModal === "bulk-sold"}
        title="Mark entire lot as sold?"
        description={`This will mark all ${counts.Available + counts.Reserved} available and reserved slabs in this lot as sold.`}
        confirmLabel="Mark All as Sold"
        cancelLabel="Cancel"
        onConfirm={confirmBulkSold}
        onCancel={() => setActiveModal(null)}
      />

      {/* Bulk unreserve */}
      <ConfirmDialog
        open={activeModal === "bulk-unreserve"}
        title="Unreserve entire lot?"
        description={`This will mark all ${counts.Reserved} reserved slabs as available again.`}
        confirmLabel="Unreserve All"
        cancelLabel="Cancel"
        onConfirm={confirmBulkUnreserve}
        onCancel={() => setActiveModal(null)}
      />

      {/* Bulk unsell */}
      <ConfirmDialog
        open={activeModal === "bulk-unsell"}
        title="Mark entire lot as available?"
        description={`This will mark all ${counts.Sold} sold slabs as available again.`}
        confirmLabel="Mark All as Available"
        cancelLabel="Cancel"
        onConfirm={confirmBulkUnsell}
        onCancel={() => setActiveModal(null)}
      />

      {/* Individual slab sold / unreserve */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.status === "Available" ? "Unreserve this slab?" : "Mark this slab as sold?"}
        description={
          pendingAction?.status === "Available"
            ? `This will mark slab ${pendingAction?.slabCode ?? ""} as available again.`
            : `This will mark slab ${pendingAction?.slabCode ?? ""} as sold. Only do this once the sale is confirmed.`
        }
        confirmLabel={pendingAction?.status === "Available" ? "Unreserve" : "Mark as Sold"}
        cancelLabel="Cancel"
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingSlabDelete !== null}
        title="Delete this slab?"
        description={`This will permanently delete slab ${pendingSlabDelete?.slabCode ?? ""} and all its photos. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmSlabDelete}
        onCancel={() => setPendingSlabDelete(null)}
      />

      <ConfirmDialog
        open={activeModal === "delete-lot"}
        title="Delete this lot?"
        description={`This will permanently delete lot ${lot.lotNumber ?? ""} and all ${counts.All} slab${counts.All !== 1 ? "s" : ""} in it, including all photos. This cannot be undone.`}
        confirmLabel="Delete Lot"
        cancelLabel="Cancel"
        onConfirm={confirmLotDelete}
        onCancel={() => setActiveModal(null)}
      />

      {/* Selection confirm dialogs */}
      <ConfirmDialog
        open={activeModal === "selection-sold"}
        title={`Mark ${selectionSellableIds.length} slab${selectionSellableIds.length !== 1 ? "s" : ""} as sold?`}
        description="This will mark the selected available and reserved slabs as sold."
        confirmLabel="Mark as Sold"
        cancelLabel="Cancel"
        onConfirm={confirmSelectionSold}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmDialog
        open={activeModal === "selection-unreserve"}
        title={`Unreserve ${selectionReservedIds.length} slab${selectionReservedIds.length !== 1 ? "s" : ""}?`}
        description="This will mark the selected reserved slabs as available again."
        confirmLabel="Unreserve"
        cancelLabel="Cancel"
        onConfirm={confirmSelectionUnreserve}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmDialog
        open={activeModal === "selection-unsell"}
        title={`Mark ${selectionSoldIds.length} slab${selectionSoldIds.length !== 1 ? "s" : ""} as available?`}
        description="This will mark the selected sold slabs as available again."
        confirmLabel="Mark as Available"
        cancelLabel="Cancel"
        onConfirm={confirmSelectionUnsell}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmDialog
        open={activeModal === "selection-delete"}
        title={`Delete ${selectedIds.size} slab${selectedIds.size !== 1 ? "s" : ""}?`}
        description="This will permanently delete the selected slabs and all their photos. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmSelectionDelete}
        onCancel={() => setActiveModal(null)}
      />

      {/* Clone Lot dialog */}
      {activeModal === "clone-lot" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold text-gray-900">Clone Lot</h3>
            <p className="mb-4 text-sm text-gray-500">
              Creates a new lot with the same marble, dimensions, and prices. All slabs are cloned as Available.
            </p>
            <label htmlFor="clone-lot-number" className="mb-1.5 block text-sm font-medium text-gray-700">
              New Lot Number
            </label>
            <input
              id="clone-lot-number"
              type="text"
              value={cloneLotNumber}
              onChange={(e) => setCloneLotNumber(e.target.value)}
              placeholder={`${lot.lotNumber ?? "LOT001"}-COPY`}
              autoFocus
              className="mb-4 w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              onKeyDown={(e) => { if (e.key === "Enter") confirmCloneLot(); if (e.key === "Escape") setActiveModal(null); }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !cloneLotNumber.trim()}
                onClick={confirmCloneLot}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Clone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price update dialog */}
      {activeModal === "selection-price" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold text-gray-900">Update Prices</h3>
            <p className="mb-4 text-sm text-gray-500">
              Override prices for {selectedIds.size} selected slab{selectedIds.size !== 1 ? "s" : ""}. Leave a field blank to keep the existing value.
            </p>
            <div className="space-y-3 mb-5">
              {(
                [
                  { id: "price-sell", label: "Sell Price", key: "sell" },
                  { id: "price-dealer", label: "Dealer Price", key: "dealer" },
                ] as const
              ).map(({ id, label, key }) => (
                <div key={key}>
                  <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">₹</span>
                    <input
                      id={id}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="(unchanged)"
                      value={priceFormValues[key]}
                      onChange={(e) => setPriceFormValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmSelectionPriceUpdate}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
