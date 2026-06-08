"use client";

import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/inventory/_components/ui/dialog";
import { Input } from "@/app/inventory/_components/ui/input";
import type { ReservationData } from "@/app/inventory/_actions/update-slab-status";

export type { ReservationData };

const QUICK_PICKS = [1, 3, 7, 14, 30] as const;

function getLocalDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type ReserveDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: (data: ReservationData) => void;
  bulk?: boolean;
};

export function ReserveDialog({ open, onCancel, onConfirm, bulk = false }: ReserveDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(7);
  const [customDate, setCustomDate] = useState("");
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerName("");
      setSelectedDays(7);
      setCustomDate("");
      setNameError(false);
    }
  }, [open]);

  function handleConfirm() {
    const name = customerName.trim();
    if (!name) { setNameError(true); return; }
    const until = selectedDays !== null ? getLocalDateOffset(selectedDays) : customDate;
    if (!until) return;
    onConfirm({ reservedFor: name, reservedUntil: until });
  }

  const todayStr = getLocalDateOffset(0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{bulk ? "Reserve All Available Slabs" : "Reserve Slab"}</DialogTitle>
          <DialogDescription>
            {bulk
              ? "Enter customer details. All available slabs in this lot will be reserved."
              : "Enter customer details and how long to reserve this slab."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">
              Reserved for <span className="text-red-500">*</span>
            </label>
            <Input
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setNameError(false); }}
              placeholder="Customer name"
              aria-invalid={nameError}
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-600">Customer name is required.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">
              Reserve until
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_PICKS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => { setSelectedDays(days); setCustomDate(""); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedDays === days
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {days === 1 ? "1 Day" : `${days} Days`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedDays(null)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedDays === null
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Custom
              </button>
            </div>

            {selectedDays === null ? (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={todayStr}
                className="mt-2 flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800/20"
              />
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                Until {fmtDateShort(getLocalDateOffset(selectedDays))}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedDays === null && !customDate}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulk ? "Reserve All" : "Reserve"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
