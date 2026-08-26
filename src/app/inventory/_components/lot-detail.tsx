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
import { cloneLot } from "@/app/inventory/_actions/clone-lot";
import { deleteSlab } from "@/app/inventory/_actions/delete-slab";
import { deleteLot } from "@/app/inventory/_actions/delete-lot";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReserveDialog, type ReservationData } from "@/app/inventory/_components/reserve-dialog";
import { toggleLotWebsite } from "@/app/inventory/_actions/toggle-lot-website";
import {
  formatNumber as fmtNum,
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
    <div className="flex aspect-4/3 w-full items-center justify-center bg-muted">
      <Package className="h-10 w-10 text-muted-foreground" />
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
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
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
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
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
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${colorClass ?? "text-foreground"}`}>
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
    | "selection-reserve" | "selection-sold" | "selection-unreserve" | "selection-unsell" | "selection-delete"
    | null;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [pendingSlabDelete, setPendingSlabDelete] = useState<PendingSlabDelete | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showOnWebsite, setShowOnWebsite] = useState(lot.showOnWebsite);
  const [cloneLotNumber, setCloneLotNumber] = useState("");
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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
              <span className="font-mono text-2xl font-bold text-foreground md:text-3xl">
                {lot.lotNumber ?? "—"}
              </span>
              {lot.categoryName ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {lot.categoryName}
                </span>
              ) : null}
              {thickness ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {thickness}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-lg font-semibold text-muted-foreground">
              {lot.marbleName ?? "—"}
            </p>
          </div>
          <Link
            href={`/inventory/lot/${lot.id}/edit`}
            className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Edit Lot
          </Link>
        </div>
      </div>

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
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
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                {visibleSlabs.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-sm text-muted-foreground underline hover:text-foreground"
                  >
                    Select all {visibleSlabs.length}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Select
              </button>
            )}
          </div>

          {visibleSlabs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
              <Package className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
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
                    className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:shadow-md"
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
                            <span className="font-mono text-sm font-bold text-foreground leading-tight">
                              {slab.slabCode ?? "—"}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(slab.statusName)}`}
                            >
                              {slab.statusName ?? "—"}
                            </span>
                          </div>
                          {size ? (
                            <p className="text-xs text-muted-foreground">
                              {size} &middot; {fmtNum(slab.sqft)} sqft <span className="font-light text-muted-foreground">(estimate)</span>
                            </p>
                          ) : null}
                          {(slab.warehouseName || slab.rackNumber) ? (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[slab.warehouseName, slab.rackNumber]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {isReserved && (
                            <div className="mt-1 space-y-0.5">
                              {(isExpired || isExpiringSoon) && (
                                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isExpired ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                  {isExpired ? "Expired" : "Expiring soon"}
                                </span>
                              )}
                              {slab.reservedFor && (
                                <p className={`truncate text-xs font-medium ${isExpired ? "text-red-500 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
                                  {slab.reservedFor}
                                  {slab.reservedUntil ? (
                                    <span className={`ml-1 font-normal ${isExpired ? "text-red-400 dark:text-red-300" : "text-orange-400 dark:text-orange-300"}`}>
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

                    {/* Footer: actions */}
                    <div className="flex items-center justify-end border-t border-border px-3 py-2">
                      <div className="flex items-center gap-0.5">
                        {isReserved ? (
                          <button
                            type="button"
                            title="Unreserve"
                            disabled={isPending}
                            onClick={() => requestStatusChange(slab.id, slab.slabCode, "Available")}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Reserve"
                            disabled={isPending || isSold}
                            onClick={() => { setActionError(null); setPendingReserveSlab({ slabId: slab.id, slabCode: slab.slabCode }); }}
                            className="rounded-lg p-1.5 text-orange-500 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:cursor-not-allowed disabled:opacity-30"
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
                          className="rounded-lg p-1.5 text-green-600 dark:text-green-400 transition-colors hover:bg-green-50 dark:hover:bg-green-950/30 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/inventory/edit/${slab.id}`}
                          title="Edit"
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
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
                          className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-30"
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
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lot Summary
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Slabs" value={counts.All} />
              <StatBox label="Total Sqft (estimate)" value={fmtNum(totalSqft)} />
              <StatBox
                label="Available"
                value={counts.Available}
                colorClass="text-green-600 dark:text-green-400"
              />
              <StatBox
                label="Reserved"
                value={counts.Reserved}
                colorClass="text-orange-500 dark:text-orange-400"
              />
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
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

          {/* Purchase info */}
          {(lot.invoiceNumber || purchaseDate) ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lot.notes}
              </p>
            </div>
          ) : null}

          {/* Website Visibility */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Website
            </h2>
            <button
              type="button"
              disabled={isTogglingWebsite}
              onClick={handleToggleWebsite}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                showOnWebsite
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                  : "border-border bg-muted text-muted-foreground hover:bg-muted"
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
                  showOnWebsite ? "bg-emerald-500" : "bg-border"
                }`}
              >
                <span
                  className={`block h-5 w-5 translate-y-0 rounded-full bg-card shadow-sm ring-1 ring-border transition-transform ${
                    showOnWebsite ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              {showOnWebsite
                ? "This lot is visible on the public collection page."
                : "Toggle to show this lot on the public collection page."}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link
              href={`/inventory/lot/${lot.id}/add-slab`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-background px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-primary hover:text-primary-foreground"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                Mark Lot as Available ({counts.Sold} sold)
              </button>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={() => { setCloneLotNumber(""); setActionError(null); setActiveModal("clone-lot"); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Clone Lot
            </button>

            <Link
              href={`/inventory/quotations?lotId=${lot.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
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
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors ${
                counts.Available === 0
                  ? "cursor-not-allowed text-muted-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Printer className="h-4 w-4" />
              Print QR Labels ({counts.Available} available)
            </a>
            <button
              type="button"
              onClick={() => setActiveModal("delete-lot")}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Lot
            </button>
          </div>
        </div>
      </div>

      {/* Floating selection action bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
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
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
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
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Mark Available ({selectionSoldIds.length})
                </button>
              )}
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
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
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
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold text-foreground">Clone Lot</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Creates a new lot with the same marble and dimensions. All slabs are cloned as Available.
            </p>
            <label htmlFor="clone-lot-number" className="mb-1.5 block text-sm font-medium text-muted-foreground">
              New Lot Number
            </label>
            <input
              id="clone-lot-number"
              type="text"
              value={cloneLotNumber}
              onChange={(e) => setCloneLotNumber(e.target.value)}
              placeholder={`${lot.lotNumber ?? "LOT001"}-COPY`}
              autoFocus
              className="mb-4 w-full rounded-xl border border-border px-4 py-3 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => { if (e.key === "Enter") confirmCloneLot(); if (e.key === "Escape") setActiveModal(null); }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !cloneLotNumber.trim()}
                onClick={confirmCloneLot}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Clone
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
