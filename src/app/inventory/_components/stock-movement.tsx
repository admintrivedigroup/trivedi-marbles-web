"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  History,
  LoaderCircle,
  MapPin,
  Package,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";

import { cancelTransfer, createTransferRequest, receiveTransfer } from "@/app/inventory/_actions/movement";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import type { RecentMovement } from "@/app/inventory/_lib/movement";
import type { TransferRequest } from "@/app/inventory/_lib/transfers";

type Tab = "transfer" | "incoming" | "history";

type StockMovementProps = {
  slabs: InventoryListSlab[];
  recentMovements: RecentMovement[];
  incomingTransfers: TransferRequest[];
  outgoingTransfers: TransferRequest[];
  historyDateFrom?: string;
  historyDateTo?: string;
};

type TransferItem = {
  id: string;
  slabCode: string | null;
  marbleName: string | null;
  warehouseName: string | null;
  sqft: number | null;
  lotNumber: string | null;
};

type LotGroup = {
  key: string;
  lotId: string | null;
  lotNumber: string | null;
  marbleName: string | null;
  thumbnailUrl: string | null;
  slabs: InventoryListSlab[];
  totalSqft: number;
  warehouses: string[];
};

const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 15;

// ─── Incoming transfers panel ─────────────────────────────────────────────────

function IncomingTransfers({
  incomingTransfers,
}: {
  incomingTransfers: TransferRequest[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rackInputs, setRackInputs] = useState<
    Record<string, Record<string, { rackNumber: string; notes: string }>>
  >({});
  const [results, setResults] = useState<Record<string, { error: string | null; status: string }>>({});
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function getRack(transferId: string, slabId: string) {
    return rackInputs[transferId]?.[slabId] ?? { rackNumber: "", notes: "" };
  }

  function setRack(
    transferId: string,
    slabId: string,
    field: "rackNumber" | "notes",
    value: string,
  ) {
    setRackInputs((prev) => ({
      ...prev,
      [transferId]: {
        ...(prev[transferId] ?? {}),
        [slabId]: {
          ...getRack(transferId, slabId),
          [field]: value,
        },
      },
    }));
  }

  function handleReceive(transfer: TransferRequest) {
    const formData = new FormData();
    formData.set("transferId", transfer.id);
    formData.set("items", JSON.stringify(rackInputs[transfer.id] ?? {}));

    startTransition(async () => {
      const res = await receiveTransfer(formData);
      setResults((prev) => ({ ...prev, [transfer.id]: res }));
      if (res.status === "success") {
        setExpandedId(null);
      }
    });
  }

  function handleCancel(transferId: string) {
    const formData = new FormData();
    formData.set("transferId", transferId);
    startTransition(async () => {
      const res = await cancelTransfer(formData);
      setResults((prev) => ({ ...prev, [transferId]: res }));
      setCancelConfirmId(null);
    });
  }

  if (incomingTransfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Truck className="mb-3 h-12 w-12 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No incoming transfers</p>
        <p className="mt-1 text-xs text-gray-400">
          Transfers sent to your warehouse will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incomingTransfers.map((transfer) => {
        const isExpanded = expandedId === transfer.id;
        const result = results[transfer.id];
        const totalSqft = transfer.slabs.reduce((s, sl) => s + (sl.sqft ?? 0), 0);

        return (
          <div
            key={transfer.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex w-full items-center gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : transfer.id)}
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                  <Truck className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    From{" "}
                    <span className="text-orange-600">
                      {transfer.fromWarehouseName ?? "Unknown"}
                    </span>
                    {" → "}
                    <span className="text-green-600">
                      {transfer.toWarehouseName ?? "Unknown"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {transfer.slabs.length} slab{transfer.slabs.length !== 1 ? "s" : ""}{" "}
                    &middot; {Math.round(totalSqft)} sqft <span className="font-light text-gray-400">(estimate)</span> &middot;{" "}
                    {new Date(transfer.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {transfer.notes && (
                    <p className="mt-0.5 truncate text-xs italic text-gray-400">
                      {transfer.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    In Transit
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCancelConfirmId(cancelConfirmId === transfer.id ? null : transfer.id)}
                className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Cancel
              </button>
            </div>

            {/* Cancel confirmation */}
            {cancelConfirmId === transfer.id && (
              <div className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-5 py-3">
                <p className="text-sm text-red-700">
                  Cancel this transfer? Slabs will return to available stock.
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelConfirmId(null)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(transfer.id)}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                  >
                    {pending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                    Yes, Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expanded — slab list with rack inputs */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-5 pb-5">
                {result && (
                  <div
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                      result.status === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {result.status === "success"
                      ? "Transfer confirmed. Slabs moved to this warehouse."
                      : result.error}
                  </div>
                )}

                <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Slabs — Enter rack numbers before confirming
                </p>

                <div className="space-y-2">
                  {transfer.slabs.map((slab) => {
                    const rack = getRack(transfer.id, slab.slabId);
                    return (
                      <div
                        key={slab.slabId}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-medium text-gray-800">
                              {slab.slabCode ?? "—"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {slab.marbleName ?? "Unknown"}
                              {slab.lotNumber && (
                                <span className="ml-1 text-gray-400">
                                  · {slab.lotNumber}
                                </span>
                              )}
                              {slab.sqft !== null && (
                                <span className="ml-1">· {slab.sqft} sqft <span className="font-light text-gray-400">(estimate)</span></span>
                              )}
                            </p>
                            {slab.currentRackNumber && (
                              <p className="mt-0.5 text-xs text-gray-400">
                                Current rack: {slab.currentRackNumber}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={rack.rackNumber}
                            onChange={(e) =>
                              setRack(transfer.id, slab.slabId, "rackNumber", e.target.value)
                            }
                            placeholder="New rack number"
                            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                          />
                          <input
                            type="text"
                            value={rack.notes}
                            onChange={(e) =>
                              setRack(transfer.id, slab.slabId, "notes", e.target.value)
                            }
                            placeholder="Notes (e.g. damaged)"
                            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleReceive(transfer)}
                  disabled={pending}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {pending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Receipt
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Outgoing transfers panel ─────────────────────────────────────────────────

function OutgoingTransfers({ outgoingTransfers }: { outgoingTransfers: TransferRequest[] }) {
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { error: string | null; status: string }>>({});
  const [pending, startTransition] = useTransition();

  function handleCancel(transferId: string) {
    const formData = new FormData();
    formData.set("transferId", transferId);
    startTransition(async () => {
      const res = await cancelTransfer(formData);
      setResults((prev) => ({ ...prev, [transferId]: res }));
      setCancelConfirmId(null);
    });
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
        <Clock className="h-4 w-4 text-orange-500" />
        Pending Outgoing Transfers
        <span className="ml-auto rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
          {outgoingTransfers.length}
        </span>
      </h2>
      <div className="space-y-2">
        {outgoingTransfers.map((t) => {
          const result = results[t.id];
          return (
            <div key={t.id} className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3 px-4 py-3">
                <Truck className="h-4 w-4 shrink-0 text-orange-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    → {t.toWarehouseName ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.slabs.length} slab{t.slabs.length !== 1 ? "s" : ""} &middot;{" "}
                    {new Date(t.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  In Transit
                </span>
                <button
                  type="button"
                  onClick={() => setCancelConfirmId(cancelConfirmId === t.id ? null : t.id)}
                  className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Cancel
                </button>
              </div>
              {result?.status === "error" && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                  {result.error}
                </p>
              )}
              {cancelConfirmId === t.id && (
                <div className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-4 py-2.5">
                  <p className="text-xs text-red-700">
                    Cancel this transfer? Slabs return to available stock.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setCancelConfirmId(null)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(t.id)}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                    >
                      {pending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                      Yes, Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StockMovement({
  slabs,
  recentMovements,
  incomingTransfers,
  outgoingTransfers,
  historyDateFrom,
  historyDateTo,
}: StockMovementProps) {
  const { options } = useLookupOptions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>("transfer");

  // Transfer tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMarble, setActiveMarble] = useState<string | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLotKey, setExpandedLotKey] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  // History date filter state
  const [histFromVal, setHistFromVal] = useState(historyDateFrom ?? "");
  const [histToVal, setHistToVal] = useState(historyDateTo ?? "");

  const hasActiveHistoryFilter = !!(historyDateFrom || historyDateTo);

  function applyHistoryFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (histFromVal) params.set("histFrom", histFromVal); else params.delete("histFrom");
    if (histToVal) params.set("histTo", histToVal); else params.delete("histTo");
    setHistoryPage(1);
    router.push(`?${params.toString()}`);
  }

  function clearHistoryFilter() {
    setHistFromVal("");
    setHistToVal("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("histFrom");
    params.delete("histTo");
    setHistoryPage(1);
    router.push(`?${params.toString()}`);
  }

  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<{
    error: string | null;
    status: "idle" | "success" | "error";
    transferred?: number;
  }>({ error: null, status: "idle" });
  const [isPending, startTransition] = useTransition();

  const lotGroups = useMemo((): LotGroup[] => {
    const map = new Map<string, LotGroup>();
    for (const slab of slabs) {
      const key = slab.lotId ?? "ungrouped";
      if (!map.has(key)) {
        map.set(key, {
          key,
          lotId: slab.lotId,
          lotNumber: slab.lotNumber,
          marbleName: slab.marbleName,
          thumbnailUrl: slab.thumbnailUrl,
          slabs: [],
          totalSqft: 0,
          warehouses: [],
        });
      }
      const group = map.get(key)!;
      group.slabs.push(slab);
      group.totalSqft += slab.sqft ?? 0;
      if (!group.thumbnailUrl && slab.thumbnailUrl) group.thumbnailUrl = slab.thumbnailUrl;
      if (slab.warehouseName && !group.warehouses.includes(slab.warehouseName)) {
        group.warehouses.push(slab.warehouseName);
      }
    }
    return Array.from(map.values());
  }, [slabs]);

  const uniqueMarbleNames = useMemo(
    () =>
      [...new Set(slabs.map((s) => s.marbleName).filter((n): n is string => n !== null))].sort(),
    [slabs],
  );

  const uniqueWarehouses = useMemo(
    () =>
      [...new Set(slabs.map((s) => s.warehouseName).filter((w): w is string => w !== null))].sort(),
    [slabs],
  );

  const filteredLotGroups = useMemo(() => {
    let groups = lotGroups;
    if (activeMarble) groups = groups.filter((g) => g.marbleName === activeMarble);
    if (activeWarehouse) groups = groups.filter((g) => g.warehouses.includes(activeWarehouse));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      groups = groups.filter(
        (g) =>
          g.marbleName?.toLowerCase().includes(q) ||
          g.lotNumber?.toLowerCase().includes(q),
      );
    }
    return groups;
  }, [lotGroups, activeMarble, activeWarehouse, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLotGroups.length / PAGE_SIZE));

  const paginatedLotGroups = useMemo(
    () => filteredLotGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredLotGroups, currentPage],
  );

  const addedIds = useMemo(() => new Set(transferItems.map((i) => i.id)), [transferItems]);

  const addSlab = (slab: InventoryListSlab) => {
    if (addedIds.has(slab.id)) return;
    setTransferItems((prev) => [
      ...prev,
      {
        id: slab.id,
        slabCode: slab.slabCode,
        marbleName: slab.marbleName,
        warehouseName: slab.warehouseName,
        sqft: slab.sqft,
        lotNumber: slab.lotNumber,
      },
    ]);
  };

  const addLot = (group: LotGroup) => {
    const toAdd = group.slabs.filter((s) => !addedIds.has(s.id));
    if (toAdd.length === 0) return;
    setTransferItems((prev) => [
      ...prev,
      ...toAdd.map((slab) => ({
        id: slab.id,
        slabCode: slab.slabCode,
        marbleName: slab.marbleName,
        warehouseName: slab.warehouseName,
        sqft: slab.sqft,
        lotNumber: slab.lotNumber,
      })),
    ]);
  };

  const removeSlab = (id: string) => {
    setTransferItems((prev) => prev.filter((i) => i.id !== id));
  };

  const totalSqft = transferItems.reduce((sum, i) => sum + (i.sqft ?? 0), 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (transferItems.length === 0 || !toWarehouseId) return;

    const formData = new FormData();
    formData.set("slabIds", transferItems.map((i) => i.id).join(","));
    formData.set("toWarehouseId", toWarehouseId);
    formData.set("notes", notes);

    startTransition(async () => {
      const res = await createTransferRequest(formData);
      setResult(res);
      if (res.status === "success") {
        setTransferItems([]);
        setToWarehouseId("");
        setNotes("");
      }
    });
  }

  const resetPage = () => setCurrentPage(1);

  const tabs: { id: Tab; label: string; icon: typeof ArrowLeftRight; badge?: number }[] = [
    { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
    { id: "incoming", label: "Incoming", icon: Truck, badge: incomingTransfers.length || undefined },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">Stock Movement</h1>
        <p className="text-gray-500">Transfer slabs between warehouse locations</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="absolute right-2 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transfer tab */}
      {activeTab === "transfer" && (
        <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
          {/* Left — lot browser */}
          <div className="space-y-4 md:space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
              <div className="mb-4 flex items-center justify-between md:mb-5">
                <h2 className="text-lg font-bold text-gray-900 md:text-xl">Available Lots</h2>
                {slabs.length > 0 && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                    {filteredLotGroups.length}/{lotGroups.length} lots
                  </span>
                )}
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
                  placeholder="Search by marble name or lot number…"
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); resetPage(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {uniqueMarbleNames.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => { setActiveMarble(null); resetPage(); }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeMarble === null
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {uniqueMarbleNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setActiveMarble(activeMarble === name ? null : name); resetPage(); }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeMarble === name
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {uniqueWarehouses.length > 1 && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-gray-500">From:</span>
                  <select
                    value={activeWarehouse ?? ""}
                    onChange={(e) => { setActiveWarehouse(e.target.value || null); resetPage(); }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  >
                    <option value="">All warehouses</option>
                    {uniqueWarehouses.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              )}

              {(activeMarble || activeWarehouse || searchQuery) && (
                <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
                  <span>
                    {filteredLotGroups.length} result{filteredLotGroups.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setActiveMarble(null); setActiveWarehouse(null); setSearchQuery(""); resetPage(); }}
                    className="ml-auto rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {filteredLotGroups.length === 0 ? (
                <p className="py-12 text-center text-gray-400">
                  {lotGroups.length === 0
                    ? "No slabs available"
                    : "No lots match your search or filters"}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {paginatedLotGroups.map((group) => {
                    const isExpanded = expandedLotKey === group.key;
                    const allAdded = group.slabs.every((s) => addedIds.has(s.id));
                    const addedCount = group.slabs.filter((s) => addedIds.has(s.id)).length;

                    return (
                      <div
                        key={group.key}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-3/2 w-full bg-gray-100">
                          {group.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={group.thumbnailUrl}
                              alt={group.marbleName ?? "Marble slab"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-12 w-12 text-gray-300" />
                            </div>
                          )}
                          {group.lotNumber && (
                            <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 font-mono text-xs text-white">
                              {group.lotNumber}
                            </span>
                          )}
                          {addedCount > 0 && (
                            <span className="absolute right-2 top-2 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                              {addedCount}/{group.slabs.length} selected
                            </span>
                          )}
                        </div>

                        <div className="p-4">
                          <p className="mb-1 text-base font-bold text-gray-900">
                            {group.marbleName ?? "Unknown Marble"}
                          </p>
                          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                            <span>{group.slabs.length} slab{group.slabs.length !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{Math.round(group.totalSqft)} sqft <span className="font-light text-gray-400">(estimate)</span></span>
                          </div>
                          {group.warehouses.length > 0 && (
                            <p className="mb-3 flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3" />
                              {group.warehouses.join(", ")}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => addLot(group)}
                              disabled={allAdded}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              {allAdded ? (
                                <><Check className="h-4 w-4" /> All Selected</>
                              ) : (
                                <><Plus className="h-4 w-4" /> Select All</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedLotKey(isExpanded ? null : group.key)}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              Slabs
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                              {group.slabs.map((slab) => {
                                const isAdded = addedIds.has(slab.id);
                                return (
                                  <div key={slab.id} className="flex items-center justify-between px-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-mono text-xs font-medium text-gray-800">
                                        {slab.slabCode ?? "-"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {slab.sqft ?? 0} sqft <span className="font-light text-gray-400">(estimate)</span>
                                        {slab.warehouseName ? ` · ${slab.warehouseName}` : ""}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => isAdded ? removeSlab(slab.id) : addSlab(slab)}
                                      className={`ml-2 flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                        isAdded
                                          ? "bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-600"
                                          : "bg-gray-900 text-white hover:bg-gray-700"
                                      }`}
                                    >
                                      {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                      {isAdded ? "Selected" : "Select"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages} &middot; {filteredLotGroups.length} lots
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "…" ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-sm text-gray-400">…</span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === item
                                ? "bg-gray-900 text-white"
                                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {item}
                          </button>
                        ),
                      )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Outgoing pending transfers */}
            {outgoingTransfers.length > 0 && (
              <OutgoingTransfers outgoingTransfers={outgoingTransfers} />
            )}
          </div>

          {/* Right sidebar — transfer queue (shown first on mobile) */}
          <div className="order-first lg:order-none lg:sticky lg:top-4 lg:self-start">
            <form onSubmit={handleSubmit}>
              <section className="rounded-xl border border-gray-100 bg-white shadow-sm md:rounded-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <h2 className="text-base font-bold text-gray-900">Transfer Queue</h2>
                  {transferItems.length > 0 && (
                    <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {transferItems.length}
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {transferItems.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-400">
                      Select slabs from the lots to transfer
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {transferItems.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {item.marbleName}
                            </p>
                            <p className="font-mono text-xs text-gray-500">
                              {item.slabCode}
                              {item.lotNumber && (
                                <span className="ml-1 text-gray-400">· {item.lotNumber}</span>
                              )}
                            </p>
                            {item.warehouseName && (
                              <p className="mt-0.5 text-xs text-gray-400">{item.warehouseName}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSlab(item.id)}
                            className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-4 border-t border-gray-100 px-5 py-4">
                  {result.status !== "idle" && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        result.status === "success"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {result.status === "success"
                        ? `${result.transferred} slab${result.transferred !== 1 ? "s" : ""} sent — waiting for receiver to confirm.`
                        : result.error}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Destination Warehouse
                    </label>
                    <select
                      value={toWarehouseId}
                      onChange={(e) => {
                        setToWarehouseId(e.target.value);
                        if (result.status !== "idle") setResult({ error: null, status: "idle" });
                      }}
                      disabled={isPending}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                      <option value="">
                        {options.warehouses.length === 0
                          ? "No warehouses available"
                          : "Select warehouse..."}
                      </option>
                      {options.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isPending}
                      placeholder="Reason for transfer..."
                      className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
                    />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Slabs</span>
                      <span className="font-medium text-gray-900">{transferItems.length}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total sqft <span className="font-light text-gray-400">(estimate)</span></span>
                      <span className="font-medium text-gray-900">
                        {Math.round(totalSqft).toLocaleString("en-IN")} sqft <span className="font-light text-gray-400">(estimate)</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending || transferItems.length === 0 || !toWarehouseId}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-sm font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isPending ? (
                      <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Truck className="h-4 w-4" /> Send{" "}
                        {transferItems.length > 0
                          ? `${transferItems.length} Slab${transferItems.length !== 1 ? "s" : ""}`
                          : "Stock"}
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Slabs stay in transit until the receiver confirms receipt
                  </p>
                </div>
              </section>
            </form>
          </div>
        </div>
      )}

      {/* Incoming tab */}
      {activeTab === "incoming" && (
        <div className="max-w-2xl">
          <IncomingTransfers incomingTransfers={incomingTransfers} />
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (() => {
        const totalHistoryPages = Math.max(1, Math.ceil(recentMovements.length / HISTORY_PAGE_SIZE));
        const pagedMovements = recentMovements.slice(
          (historyPage - 1) * HISTORY_PAGE_SIZE,
          historyPage * HISTORY_PAGE_SIZE,
        );
        return (
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 md:text-lg">Movement History</h2>
              {recentMovements.length > 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {recentMovements.length} record{recentMovements.length !== 1 ? "s" : ""}
                  {hasActiveHistoryFilter ? " (filtered)" : ""}
                </span>
              )}
            </div>

            {/* Date range filter */}
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 self-center text-gray-400" />
              <div className="flex flex-1 flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">From</label>
                  <input
                    type="date"
                    value={histFromVal}
                    max={histToVal || undefined}
                    onChange={(e) => setHistFromVal(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">To</label>
                  <input
                    type="date"
                    value={histToVal}
                    min={histFromVal || undefined}
                    onChange={(e) => setHistToVal(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyHistoryFilter}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
                >
                  Apply
                </button>
                {hasActiveHistoryFilter && (
                  <button
                    type="button"
                    onClick={clearHistoryFilter}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {recentMovements.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">
                {hasActiveHistoryFilter ? "No movements found in this date range" : "No movements recorded yet"}
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedMovements.map((movement) => {
                    const notes = movement.notes ?? "";
                    const eventBadge =
                      notes.startsWith("[Sent]")
                        ? { label: "Sent", cls: "bg-orange-100 text-orange-700" }
                        : notes.startsWith("[Received]")
                          ? { label: "Received", cls: "bg-green-100 text-green-700" }
                          : notes.startsWith("[Cancelled]")
                            ? { label: "Cancelled", cls: "bg-red-100 text-red-700" }
                            : { label: movement.eventType, cls: "bg-gray-100 text-gray-600" };
                    const ts = new Date(movement.createdAt);
                    const dateStr = ts.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const timeStr = ts.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });
                    return (
                      <div key={movement.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {movement.marbleName ?? "Unknown"}
                              {movement.slabCode && (
                                <span className="ml-1 font-mono text-xs text-gray-500">
                                  ({movement.slabCode})
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {movement.fromLocation ?? "—"} → {movement.toLocation ?? "—"}
                            </p>
                            {movement.notes && (
                              <p className="mt-1 text-xs italic text-gray-400">{movement.notes}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventBadge.cls}`}>
                              {eventBadge.label}
                            </span>
                            <span className="text-xs text-gray-400">{dateStr}</span>
                            <span className="text-xs text-gray-400">{timeStr}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalHistoryPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Page {historyPage} of {totalHistoryPages} &middot; {recentMovements.length} records
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalHistoryPages || Math.abs(p - historyPage) <= 1)
                        .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "…" ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-gray-400">…</span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setHistoryPage(item)}
                              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                                historyPage === item
                                  ? "bg-gray-900 text-white"
                                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {item}
                            </button>
                          ),
                        )}
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage === totalHistoryPages}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })()}
    </div>
  );
}
