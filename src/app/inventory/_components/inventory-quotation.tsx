"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Package,
  Plus,
  Search,
  Share2,
  X,
} from "lucide-react";

import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import { logQuotation } from "@/app/inventory/_actions/log-quotation";

type QuotationItem = {
  dbId: string;
  slabCode: string;
  marbleName: string;
  length: number | null;
  width: number | null;
  sqft: number;
  pricePerSqft: number;
  lotNumber: string | null;
  thumbnailUrl: string | null;
};

type LotGroup = {
  key: string;
  lotId: string | null;
  lotNumber: string | null;
  marbleName: string | null;
  thumbnailUrl: string | null;
  slabs: InventoryListSlab[];
  totalSqft: number;
  minPrice: number | null;
  maxPrice: number | null;
};

type InventoryQuotationProps = {
  slabs: InventoryListSlab[];
  initialLotId?: string | null;
  initialSlabId?: string | null;
};

function slabToItem(slab: InventoryListSlab): QuotationItem {
  return {
    dbId: slab.id,
    slabCode: slab.slabCode ?? "-",
    marbleName: slab.marbleName ?? "Unknown",
    length: slab.length,
    width: slab.width,
    sqft: slab.sqft ?? 0,
    pricePerSqft: slab.sellingPrice ?? 0,
    lotNumber: slab.lotNumber,
    thumbnailUrl: slab.thumbnailUrl ?? null,
  };
}

export function InventoryQuotation({ slabs, initialLotId, initialSlabId }: InventoryQuotationProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [expandedLotKey, setExpandedLotKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMarble, setActiveMarble] = useState<string | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(12);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // per-lot custom price override (keyed by group.key, value is the raw input string)
  const [lotPriceInputs, setLotPriceInputs] = useState<Record<string, string>>({});

  const PAGE_SIZE = 8;

  useEffect(() => {
    if (initialLotId) {
      const lotSlabs = slabs.filter((s) => s.lotId === initialLotId);
      if (lotSlabs.length > 0) {
        setQuotationItems(lotSlabs.map(slabToItem));
      }
    } else if (initialSlabId) {
      const slab = slabs.find((s) => s.id === initialSlabId);
      if (slab) {
        setQuotationItems([slabToItem(slab)]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableSlabs = useMemo(
    () => slabs.filter((s) => s.statusName === "Available"),
    [slabs],
  );

  const lotGroups = useMemo((): LotGroup[] => {
    const map = new Map<string, LotGroup>();

    for (const slab of availableSlabs) {
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
          minPrice: null,
          maxPrice: null,
        });
      }
      const group = map.get(key)!;
      group.slabs.push(slab);
      group.totalSqft += slab.sqft ?? 0;
      if (!group.thumbnailUrl && slab.thumbnailUrl) {
        group.thumbnailUrl = slab.thumbnailUrl;
      }
      if (slab.sellingPrice !== null) {
        group.minPrice =
          group.minPrice === null
            ? slab.sellingPrice
            : Math.min(group.minPrice, slab.sellingPrice);
        group.maxPrice =
          group.maxPrice === null
            ? slab.sellingPrice
            : Math.max(group.maxPrice, slab.sellingPrice);
      }
    }

    return Array.from(map.values());
  }, [availableSlabs]);

  const uniqueMarbleNames = useMemo(
    () =>
      [
        ...new Set(
          availableSlabs
            .map((s) => s.marbleName)
            .filter((n): n is string => n !== null),
        ),
      ].sort(),
    [availableSlabs],
  );

  const uniqueWarehouses = useMemo(
    () =>
      [
        ...new Set(
          availableSlabs
            .map((s) => s.warehouseName)
            .filter((w): w is string => w !== null),
        ),
      ].sort(),
    [availableSlabs],
  );

  const filteredLotGroups = useMemo(() => {
    let groups = lotGroups;

    if (activeMarble) {
      groups = groups.filter((g) => g.marbleName === activeMarble);
    }

    if (activeWarehouse) {
      groups = groups.filter((g) =>
        g.slabs.some((s) => s.warehouseName === activeWarehouse),
      );
    }

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
    [filteredLotGroups, currentPage, PAGE_SIZE],
  );

  const resetPage = () => setCurrentPage(1);

  const addedIds = useMemo(
    () => new Set(quotationItems.map((i) => i.dbId)),
    [quotationItems],
  );

  const parseLotPrice = (key: string, fallback: number | null): number => {
    const raw = lotPriceInputs[key]?.trim();
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return fallback ?? 0;
  };

  const addSlab = (slab: InventoryListSlab, priceOverride?: number) => {
    if (addedIds.has(slab.id)) return;
    setQuotationItems((prev) => [
      ...prev,
      {
        dbId: slab.id,
        slabCode: slab.slabCode ?? "-",
        marbleName: slab.marbleName ?? "Unknown",
        length: slab.length,
        width: slab.width,
        sqft: slab.sqft ?? 0,
        pricePerSqft: priceOverride ?? slab.sellingPrice ?? 0,
        lotNumber: slab.lotNumber,
        thumbnailUrl: slab.thumbnailUrl ?? null,
      },
    ]);
  };

  const addLot = (group: LotGroup) => {
    const toAdd = group.slabs.filter((s) => !addedIds.has(s.id));
    if (toAdd.length === 0) return;
    const price = parseLotPrice(group.key, group.minPrice);
    setQuotationItems((prev) => [
      ...prev,
      ...toAdd.map((slab) => ({
        dbId: slab.id,
        slabCode: slab.slabCode ?? "-",
        marbleName: slab.marbleName ?? "Unknown",
        length: slab.length,
        width: slab.width,
        sqft: slab.sqft ?? 0,
        pricePerSqft: price,
        lotNumber: slab.lotNumber,
        thumbnailUrl: group.thumbnailUrl ?? slab.thumbnailUrl ?? null,
      })),
    ]);
  };

  const updateItemPrice = (dbId: string, newPrice: number) => {
    setQuotationItems((prev) =>
      prev.map((item) =>
        item.dbId === dbId ? { ...item, pricePerSqft: newPrice } : item,
      ),
    );
  };

  const removeSlab = (dbId: string) => {
    setQuotationItems((prev) => prev.filter((i) => i.dbId !== dbId));
  };

  const subtotal = quotationItems.reduce(
    (sum, item) => sum + item.sqft * item.pricePerSqft,
    0,
  );
  const totalSqft = quotationItems.reduce((sum, item) => sum + item.sqft, 0);
  const discountAmount = Math.round((subtotal * discount) / 100);
  const afterDiscount = subtotal - discountAmount;
  const gstAmount = Math.round((afterDiscount * gstPercent) / 100);
  const grandTotal = afterDiscount + gstAmount;

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const [{ pdf }, { QuotationDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./quotation-pdf"),
      ]);

      const date = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const qtNum = `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const blob = await pdf(
        <QuotationDocument
          quotationNumber={qtNum}
          date={date}
          customerName={customerName}
          customerPhone={customerPhone}
          customerEmail={customerEmail}
          items={quotationItems.map((item) => ({
            slabCode: item.slabCode,
            marbleName: item.marbleName,
            lotNumber: item.lotNumber,
            length: item.length,
            width: item.width,
            sqft: item.sqft,
            pricePerSqft: item.pricePerSqft,
            thumbnailUrl: item.thumbnailUrl,
          }))}
          totalSqft={totalSqft}
          subtotal={subtotal}
          discountPercent={discount}
          discountAmount={discountAmount}
          gstPercent={gstPercent}
          gstAmount={gstAmount}
          grandTotal={grandTotal}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const namePart = customerName.trim()
        ? `-${customerName.trim().replace(/\s+/g, "-")}`
        : "";
      a.download = `${qtNum}${namePart}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      logQuotation({
        action: "quotation.pdf_downloaded",
        quotationNumber: qtNum,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        slabCount: quotationItems.length,
        totalSqft,
        grandTotal,
        slabIds: quotationItems.map((i) => i.dbId),
      }).catch(() => {});
    } catch {
      window.alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleWhatsApp = () => {
    const qtNum = `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const lines: string[] = [];

    lines.push("*Trivedi Marbles — Quotation*");
    lines.push("");

    if (customerName) lines.push(`*Customer:* ${customerName}`);
    if (customerPhone) lines.push(`*Phone:* ${customerPhone}`);
    if (customerEmail) lines.push(`*Email:* ${customerEmail}`);
    if (customerName || customerPhone || customerEmail) lines.push("");

    lines.push("*Items:*");
    for (const item of quotationItems) {
      const amount = item.sqft * item.pricePerSqft;
      const amountStr =
        item.pricePerSqft > 0
          ? ` — Rs. ${amount.toLocaleString("en-IN")}`
          : "";
      lines.push(
        `• ${item.marbleName} (${item.slabCode}) — ${item.sqft} sqft${amountStr}`,
      );
    }

    lines.push("");
    lines.push(`*Total Area:* ${totalSqft.toLocaleString("en-IN")} sqft`);
    lines.push(`*Subtotal:* Rs. ${subtotal.toLocaleString("en-IN")}`);
    if (discount > 0)
      lines.push(`*Discount (${discount}%):* – Rs. ${discountAmount.toLocaleString("en-IN")}`);
    if (gstPercent > 0)
      lines.push(`*GST (${gstPercent}%):* + Rs. ${gstAmount.toLocaleString("en-IN")}`);
    lines.push(`*Grand Total:* Rs. ${grandTotal.toLocaleString("en-IN")}`);

    const message = encodeURIComponent(lines.join("\n"));
    const phone = customerPhone.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(url, "_blank");

    logQuotation({
      action: "quotation.whatsapp_shared",
      quotationNumber: qtNum,
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      slabCount: quotationItems.length,
      totalSqft,
      grandTotal,
      slabIds: quotationItems.map((i) => i.dbId),
    }).catch(() => {});
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Create Quotation
        </h1>
        <p className="text-gray-500">Generate quotations for customers</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
        {/* ── Left column ─────────────────────────────────────── */}
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
          {/* Customer Information */}
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
            <h2 className="mb-4 text-lg font-bold text-gray-900 md:mb-6 md:text-xl">
              Customer Information
            </h2>
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="Mr. Patel"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </section>

          {/* Marketplace — Lots */}
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between md:mb-5">
              <h2 className="text-lg font-bold text-gray-900 md:text-xl">
                Available Lots
              </h2>
              {availableSlabs.length > 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                  {filteredLotGroups.length}/{lotGroups.length} lots
                </span>
              )}
            </div>

            {/* Search */}
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

            {/* Marble name chips */}
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
                    onClick={() => {
                      setActiveMarble(activeMarble === name ? null : name);
                      resetPage();
                    }}
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

            {/* Warehouse filter */}
            {uniqueWarehouses.length > 1 && (
              <div className="mb-4 flex items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-gray-500">
                  Warehouse:
                </span>
                <select
                  value={activeWarehouse ?? ""}
                  onChange={(e) => {
                    setActiveWarehouse(e.target.value || null);
                    resetPage();
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                >
                  <option value="">All warehouses</option>
                  {uniqueWarehouses.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Active filter summary */}
            {(activeMarble || activeWarehouse || searchQuery) && (
              <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {filteredLotGroups.length} result
                  {filteredLotGroups.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMarble(null);
                    setActiveWarehouse(null);
                    setSearchQuery("");
                    resetPage();
                  }}
                  className="ml-auto rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Lot cards grid */}
            {filteredLotGroups.length === 0 ? (
              <p className="py-12 text-center text-gray-400">
                {lotGroups.length === 0
                  ? "No available slabs"
                  : "No lots match your search or filters"}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {paginatedLotGroups.map((group) => {
                  const isExpanded = expandedLotKey === group.key;
                  const allAdded = group.slabs.every((s) =>
                    addedIds.has(s.id),
                  );
                  const addedCount = group.slabs.filter((s) =>
                    addedIds.has(s.id),
                  ).length;

                  const priceLabel =
                    group.minPrice === null
                      ? null
                      : group.minPrice === group.maxPrice
                        ? `Rs. ${group.minPrice.toLocaleString("en-IN")}/sqft (estimate)`
                        : `Rs. ${group.minPrice.toLocaleString("en-IN")}–${group.maxPrice!.toLocaleString("en-IN")}/sqft (estimate)`;

                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                    >
                      {/* Thumbnail */}
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
                          <span className="absolute right-2 top-2 rounded-md bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                            {addedCount}/{group.slabs.length} added
                          </span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        <p className="mb-1 text-base font-bold text-gray-900">
                          {group.marbleName ?? "Unknown Marble"}
                        </p>
                        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                          <span>
                            {group.slabs.length} slab
                            {group.slabs.length !== 1 ? "s" : ""}
                          </span>
                          <span>·</span>
                          <span>{Math.round(group.totalSqft)} sqft <span className="font-light text-gray-400">(estimate)</span></span>
                          {priceLabel && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-gray-700">
                                {priceLabel}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Price override input */}
                        <div className="mb-3">
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            Price / sqft (Rs.)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={lotPriceInputs[group.key] ?? ""}
                            onChange={(e) =>
                              setLotPriceInputs((prev) => ({
                                ...prev,
                                [group.key]: e.target.value,
                              }))
                            }
                            placeholder={
                              group.minPrice !== null
                                ? group.minPrice === group.maxPrice
                                  ? String(group.minPrice)
                                  : `${group.minPrice}–${group.maxPrice}`
                                : "Enter price"
                            }
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => addLot(group)}
                            disabled={allAdded}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            {allAdded ? (
                              <>
                                <Check className="h-4 w-4" />
                                All Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Add All
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLotKey(
                                isExpanded ? null : group.key,
                              )
                            }
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            Slabs
                          </button>
                        </div>

                        {/* Expanded slab list */}
                        {isExpanded && (
                          <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                            {group.slabs.map((slab) => {
                              const isAdded = addedIds.has(slab.id);
                              const amount =
                                (slab.sqft ?? 0) * (slab.sellingPrice ?? 0);
                              return (
                                <div
                                  key={slab.id}
                                  className="flex items-center justify-between px-3 py-2.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-mono text-xs font-medium text-gray-800">
                                      {slab.slabCode ?? "-"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {slab.sqft ?? 0} sqft <span className="font-light text-gray-400">(estimate)</span>
                                      {slab.sellingPrice
                                        ? ` · Rs. ${amount.toLocaleString("en-IN")}`
                                        : ""}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isAdded
                                        ? removeSlab(slab.id)
                                        : addSlab(slab, parseLotPrice(group.key, slab.sellingPrice))
                                    }
                                    className={`ml-2 flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                      isAdded
                                        ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600"
                                        : "bg-gray-900 text-white hover:bg-gray-700"
                                    }`}
                                  >
                                    {isAdded ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Plus className="h-3 w-3" />
                                    )}
                                    {isAdded ? "Added" : "Add"}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages} &middot;{" "}
                  {filteredLotGroups.length} lots
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
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("…");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1 text-sm text-gray-400"
                        >
                          …
                        </span>
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
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Right sidebar (shown first on mobile) ────────────── */}
        <div className="order-first lg:order-none lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-xl border border-gray-100 bg-white shadow-sm md:rounded-2xl">
            {/* Sidebar header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-gray-900">
                Quotation
              </h2>
              {quotationItems.length > 0 && (
                <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {quotationItems.length}
                </span>
              )}
            </div>

            {/* Items list */}
            <div className="max-h-105 overflow-y-auto">
              {quotationItems.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  Add slabs from the lots to build your quotation
                </p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {quotationItems.map((item, index) => (
                    <li
                      key={`${item.dbId}-${index}`}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {item.marbleName}
                        </p>
                        <p className="font-mono text-xs text-gray-500">
                          {item.slabCode}
                          {item.lotNumber && (
                            <span className="ml-1 text-gray-400">
                              · {item.lotNumber}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {item.sqft} sqft <span className="font-light text-gray-400">(est.)</span>
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">Rs.</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={item.pricePerSqft === 0 ? "" : item.pricePerSqft}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              updateItemPrice(item.dbId, isNaN(v) ? 0 : Math.max(0, v));
                            }}
                            placeholder="0"
                            className="w-20 rounded-md border border-gray-200 px-2 py-0.5 text-xs focus:border-transparent focus:outline-none focus:ring-1 focus:ring-gray-800"
                          />
                          <span className="text-xs text-gray-400">/sqft</span>
                          {item.pricePerSqft > 0 && (
                            <span className="ml-auto text-xs font-medium text-gray-700">
                              = Rs. {(item.sqft * item.pricePerSqft).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlab(item.dbId)}
                        className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Summary & actions */}
            <div className="border-t border-gray-100 px-5 py-4">
              {/* Discount + GST controls */}
              {quotationItems.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-xs font-medium text-gray-600">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discount === 0 ? "" : discount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setDiscount(isNaN(v) ? 0 : Math.min(100, Math.max(0, v)));
                      }}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-xs font-medium text-gray-600">
                      GST (%)
                    </label>
                    <select
                      value={gstPercent}
                      onChange={(e) => setGstPercent(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                    >
                      <option value={0}>0% (None)</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Items</span>
                  <span className="font-medium text-gray-900">
                    {quotationItems.length}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total sqft <span className="font-light text-gray-400">(est.)</span></span>
                  <span className="font-medium text-gray-900">
                    {totalSqft.toLocaleString("en-IN")} sqft
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">
                    Rs. {subtotal.toLocaleString("en-IN")}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Discount ({discount}%)</span>
                    <span className="font-medium text-red-600">
                      – Rs. {discountAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                {gstPercent > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>GST ({gstPercent}%)</span>
                    <span className="font-medium text-gray-900">
                      + Rs. {gstAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="font-bold text-gray-900">Grand Total</span>
                  <span className="text-xl font-bold text-gray-900">
                    Rs. {grandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={quotationItems.length === 0 || isGeneratingPdf}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPdf ? "Generating…" : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  disabled={quotationItems.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Share2 className="h-4 w-4" />
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
