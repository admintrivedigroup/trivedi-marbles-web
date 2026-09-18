"use client";

import { useEffect, useState } from "react";
import { Check, Package } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/inventory/_components/ui/dialog";
import { Checkbox } from "@/app/inventory/_components/ui/checkbox";
import type { InventoryListSlab } from "@/app/inventory/_lib/inventory-list";
import { formatSize } from "@/app/inventory/_lib/format";
import type { LotGroup } from "./inventory-quotation";

type LotSlabPickerModalProps = {
  open: boolean;
  group: LotGroup | null;
  addedIds: Set<string>;
  defaultPrice: number | null;
  onClose: () => void;
  onAddSelected: (selections: { slab: InventoryListSlab; price: number }[]) => void;
};

export function LotSlabPickerModal({
  open,
  group,
  addedIds,
  defaultPrice,
  onClose,
  onAddSelected,
}: LotSlabPickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && group) {
      const notAdded = group.slabs.filter((s) => !addedIds.has(s.id));
      setSelected(new Set(notAdded.map((s) => s.id)));
      const initialPrices: Record<string, string> = {};
      for (const slab of group.slabs) {
        const price = defaultPrice ?? slab.sellingPrice;
        initialPrices[slab.id] = price ? String(price) : "";
      }
      setPrices(initialPrices);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.key]);

  if (!group) return null;

  const availableSlabs = group.slabs.filter((s) => !addedIds.has(s.id));
  const alreadyAddedCount = group.slabs.length - availableSlabs.length;
  const allSelected = availableSlabs.length > 0 && availableSlabs.every((s) => selected.has(s.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(availableSlabs.map((s) => s.id)));
  };

  const priceFor = (id: string): number => {
    const raw = prices[id]?.trim();
    const parsed = raw ? parseFloat(raw) : NaN;
    return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
  };

  const selectedSlabs = group.slabs.filter((s) => selected.has(s.id));
  const selectedTotal = selectedSlabs.reduce((sum, s) => sum + (s.sqft ?? 0) * priceFor(s.id), 0);

  const handleAdd = () => {
    const picks = selectedSlabs
      .filter((s) => !addedIds.has(s.id))
      .map((slab) => ({ slab, price: priceFor(slab.id) }));
    if (picks.length === 0) return;
    onAddSelected(picks);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-gray-100 px-6 py-4 text-left">
          <DialogTitle className="text-gray-900">
            {group.marbleName ?? "Unknown Marble"}
            {group.lotNumber && (
              <span className="ml-2 font-mono text-sm font-normal text-gray-400">
                Lot {group.lotNumber}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Select the slabs to add to this quotation, and adjust price per slab if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-6 py-2.5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={availableSlabs.length === 0}
            />
            Select all ({availableSlabs.length})
          </label>
          {alreadyAddedCount > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {alreadyAddedCount} already in quotation
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {group.slabs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No slabs in this lot</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {group.slabs.map((slab) => {
                const isAdded = addedIds.has(slab.id);
                const isChecked = selected.has(slab.id);
                const size = formatSize(slab.length, slab.width);
                return (
                  <li
                    key={slab.id}
                    className={`flex items-center gap-3 py-2.5 ${isAdded ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={isAdded ? true : isChecked}
                      disabled={isAdded}
                      onCheckedChange={() => toggle(slab.id)}
                    />
                    {slab.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slab.thumbnailUrl}
                        alt=""
                        className="h-10 w-14 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-gray-100">
                        <Package className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-medium text-gray-800">
                        {slab.slabCode ?? "-"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {size ? `${size} · ` : ""}
                        {slab.sqft ?? 0} sqft
                        {isAdded && <span className="ml-1.5 font-medium text-green-600">· Added</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-gray-400">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={prices[slab.id] ?? ""}
                        disabled={isAdded}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [slab.id]: e.target.value }))
                        }
                        className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-transparent focus:outline-none focus:ring-1 focus:ring-gray-800 disabled:bg-gray-50"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 px-6 py-4 sm:justify-between">
          <p className="text-sm text-gray-600">
            {selected.size} selected
            {selected.size > 0 && ` · Rs. ${Math.round(selectedTotal).toLocaleString("en-IN")}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Check className="h-4 w-4" />
              Add Selected ({selected.size})
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
