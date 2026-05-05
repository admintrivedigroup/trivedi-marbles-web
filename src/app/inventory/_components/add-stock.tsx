"use client";

import { useState } from "react";
import { Save, Upload } from "lucide-react";

import type { InventoryLocation, InventoryStatus } from "@/data/inventory";

const CATEGORIES = [
  "Marble",
  "Granite",
  "Quartzite",
  "Onyx",
  "Travertine",
  "Limestone",
] as const;

const LOCATIONS: InventoryLocation[] = ["Ahmedabad", "Ambaji"];
const STATUSES: InventoryStatus[] = ["Available", "Reserved", "Sold"];
const THICKNESSES = ["12", "16", "18", "20", "25", "30"] as const;

type AddStockFormValues = {
  category: string;
  costPrice: string;
  dealerPrice: string;
  length: string;
  location: InventoryLocation;
  name: string;
  notes: string;
  rack: string;
  sellPrice: string;
  slabId: string;
  status: InventoryStatus;
  thickness: string;
  width: string;
};

const emptyForm: AddStockFormValues = {
  category: "",
  costPrice: "",
  dealerPrice: "",
  length: "",
  location: "Ahmedabad",
  name: "",
  notes: "",
  rack: "",
  sellPrice: "",
  slabId: "",
  status: "Available",
  thickness: "18",
  width: "",
};

function PriceInput({
  id,
  label,
  name,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          ₹
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
          className="w-full rounded-xl border border-gray-200 py-3 pl-9 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
      </div>
    </div>
  );
}

export function AddStock() {
  const [form, setForm] = useState<AddStockFormValues>(emptyForm);

  const sqft =
    form.length && form.width
      ? (parseFloat(form.length) * parseFloat(form.width)).toFixed(2)
      : "0.00";

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // TODO: Supabase insert
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Add New Stock
        </h2>
        <p className="mt-1 text-gray-500">Enter slab details below</p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Photo Upload
        </h3>
        <label className="flex min-h-45 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-50">
          <input type="file" accept="image/png,image/jpeg" className="sr-only" multiple />
          <Upload className="mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
          <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 10MB</p>
        </label>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Basic Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Marble Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Ambaji White Grey"
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="category"
              className="text-sm font-medium text-gray-700"
            >
              Category
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              <option value="">Select Category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="slabId"
              className="text-sm font-medium text-gray-700"
            >
              Slab ID
            </label>
            <input
              id="slabId"
              name="slabId"
              type="text"
              value={form.slabId}
              onChange={handleChange}
              placeholder="AWG-001"
              className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status"
              className="text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Dimensions
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="length"
              className="text-sm font-medium text-gray-700"
            >
              Length (feet)
            </label>
            <input
              id="length"
              name="length"
              type="number"
              min="0"
              step="0.1"
              value={form.length}
              onChange={handleChange}
              placeholder="0"
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="width"
              className="text-sm font-medium text-gray-700"
            >
              Width (feet)
            </label>
            <input
              id="width"
              name="width"
              type="number"
              min="0"
              step="0.1"
              value={form.width}
              onChange={handleChange}
              placeholder="0"
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-gray-700">
              Square Feet (auto)
            </p>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-700">
              {sqft}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="thickness"
              className="text-sm font-medium text-gray-700"
            >
              Thickness (mm)
            </label>
            <select
              id="thickness"
              name="thickness"
              value={form.thickness}
              onChange={handleChange}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {THICKNESSES.map((t) => (
                <option key={t} value={t}>
                  {t}mm
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Location
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="location"
              className="text-sm font-medium text-gray-700"
            >
              Warehouse
            </label>
            <select
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="rack"
              className="text-sm font-medium text-gray-700"
            >
              Rack Number
            </label>
            <input
              id="rack"
              name="rack"
              type="text"
              value={form.rack}
              onChange={handleChange}
              placeholder="A-12"
              className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Pricing (per sqft)
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceInput
            id="costPrice"
            label="Cost Price"
            name="costPrice"
            value={form.costPrice}
            onChange={handleChange}
          />
          <PriceInput
            id="sellPrice"
            label="Sell Price"
            name="sellPrice"
            value={form.sellPrice}
            onChange={handleChange}
          />
          <PriceInput
            id="dealerPrice"
            label="Dealer Price"
            name="dealerPrice"
            value={form.dealerPrice}
            onChange={handleChange}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
        <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
          Additional Notes
        </h3>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          value={form.notes}
          onChange={handleChange}
          placeholder="Any additional information about this slab..."
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg"
        >
          <Save className="h-4 w-4" />
          Save Stock
        </button>
        <button
          type="button"
          onClick={() => setForm(emptyForm)}
          className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
