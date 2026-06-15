"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, LoaderCircle, Save } from "lucide-react";

import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import { updateLot } from "@/app/inventory/_actions/update-lot";
import type { LotForEdit } from "@/app/inventory/_lib/lot-edit";

function PriceInput({
  disabled,
  id,
  label,
  name,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          Rs.
        </span>
        <input
          id={id}
          name={name}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={onChange}
          placeholder="0"
          disabled={disabled}
          className="w-full rounded-xl border border-gray-200 py-3 pl-9 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}

function formatThicknessLabel(value: string) {
  return /^\d+(\.\d+)?$/.test(value) ? `${value}mm` : value;
}

export function EditLot({ lot }: { lot: LotForEdit }) {
  const router = useRouter();
  const { options } = useLookupOptions();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    lotNumber: lot.lotNumber,
    marbleName: lot.marbleName,
    categoryId: lot.categoryId,
    statusId: lot.statusId,
    thicknessId: lot.thicknessId,
    warehouseId: lot.warehouseId,
    purchaseDate: lot.purchaseDate,
    invoiceNumber: lot.invoiceNumber,
    costPrice: lot.costPrice,
    sellingPrice: lot.sellingPrice,
    dealerPrice: lot.dealerPrice,
    notes: lot.notes,
    showOnWebsite: lot.showOnWebsite,
  });

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setError(null);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.set(key, typeof value === "boolean" ? String(value) : value);
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateLot(lot.id, formData);
        if (result.error) {
          setError(result.error);
        } else {
          router.push(`/inventory/lot/${lot.id}`);
        }
      } catch {
        setError("Unable to save lot right now. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push(`/inventory/lot/${lot.id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lot
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Edit Lot</h2>
          <p className="mt-1 text-gray-500">Update lot details below</p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Lot Details */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Lot Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lotNumber" className="text-sm font-medium text-gray-700">
                Lot Number
              </label>
              <input
                id="lotNumber"
                name="lotNumber"
                type="text"
                value={form.lotNumber}
                onChange={handleChange}
                placeholder="LOT001"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marbleName" className="text-sm font-medium text-gray-700">
                Marble Name
              </label>
              <input
                id="marbleName"
                name="marbleName"
                type="text"
                value={form.marbleName}
                onChange={handleChange}
                placeholder="Ambaji White Grey"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="categoryId" className="text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                disabled={isPending || options.categories.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select Category</option>
                {options.categories.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="statusId" className="text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="statusId"
                name="statusId"
                value={form.statusId}
                onChange={handleChange}
                disabled={isPending || options.statuses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.statuses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="thicknessId" className="text-sm font-medium text-gray-700">
                Thickness (mm)
              </label>
              <select
                id="thicknessId"
                name="thicknessId"
                value={form.thicknessId}
                onChange={handleChange}
                disabled={isPending || options.thicknesses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.thicknesses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatThicknessLabel(o.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="warehouseId" className="text-sm font-medium text-gray-700">
                Warehouse
              </label>
              <select
                id="warehouseId"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                disabled={isPending || options.warehouses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.warehouses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Website Visibility
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.showOnWebsite}
                  disabled={isPending}
                  onChange={(e) => {
                    setError(null);
                    setForm((prev) => ({ ...prev, showOnWebsite: e.target.checked }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 accent-gray-900"
                />
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  <Globe className="h-4 w-4 text-gray-400" />
                  Show this lot on the public website collection page
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Purchase Info */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Purchase Info
            <span className="ml-2 text-sm font-normal text-gray-400">(optional)</span>
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="purchaseDate" className="text-sm font-medium text-gray-700">
                Purchase Date
              </label>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                value={form.purchaseDate}
                onChange={handleChange}
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invoiceNumber" className="text-sm font-medium text-gray-700">
                Invoice Number
              </label>
              <input
                id="invoiceNumber"
                name="invoiceNumber"
                type="text"
                value={form.invoiceNumber}
                onChange={handleChange}
                placeholder="INV-2024-001"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Pricing (per sqft <span className="font-light text-gray-400">(estimate)</span>)
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <PriceInput
              id="costPrice"
              label="Cost Price"
              name="costPrice"
              value={form.costPrice}
              onChange={handleChange}
              disabled={isPending}
            />
            <PriceInput
              id="sellingPrice"
              label="Sell Price"
              name="sellingPrice"
              value={form.sellingPrice}
              onChange={handleChange}
              disabled={isPending}
            />
            <PriceInput
              id="dealerPrice"
              label="Dealer Price"
              name="dealerPrice"
              value={form.dealerPrice}
              onChange={handleChange}
              disabled={isPending}
            />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Updating pricing here will apply to all slabs in this lot.
          </p>
        </section>

        {/* Lot Notes */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Lot Notes</h3>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            value={form.notes}
            onChange={handleChange}
            placeholder="Any additional information about this lot..."
            disabled={isPending}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/inventory/lot/${lot.id}`)}
            disabled={isPending}
            className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
