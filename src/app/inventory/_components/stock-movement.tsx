"use client";

import { useState } from "react";
import { ArrowLeftRight, MapPin } from "lucide-react";

import type { InventoryLocation } from "@/data/inventory";

const LOCATIONS: InventoryLocation[] = ["Ahmedabad", "Ambaji"];

type TransferForm = {
  fromLocation: string;
  notes: string;
  slabId: string;
  toLocation: string;
};

const emptyForm: TransferForm = {
  fromLocation: "",
  notes: "",
  slabId: "",
  toLocation: "",
};

export function StockMovement() {
  const [form, setForm] = useState<TransferForm>(emptyForm);

  function handleChange(
    event: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // TODO: Supabase insert
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Stock Movement
        </h2>
        <p className="mt-1 text-gray-500">Transfer slabs between locations</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit}>
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <h3 className="mb-5 text-base font-bold text-gray-900 md:text-lg">
              Transfer Stock
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="slabId"
                  className="text-sm font-medium text-gray-700"
                >
                  Select Slab
                </label>
                <select
                  id="slabId"
                  name="slabId"
                  value={form.slabId}
                  onChange={handleChange}
                  className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                >
                  <option value="">Choose a slab...</option>
                  {/* TODO: populate from Supabase */}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="fromLocation"
                    className="text-sm font-medium text-gray-700"
                  >
                    From Location
                  </label>
                  <select
                    id="fromLocation"
                    name="fromLocation"
                    value={form.fromLocation}
                    onChange={handleChange}
                    className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  >
                    <option value="">Select...</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="toLocation"
                    className="text-sm font-medium text-gray-700"
                  >
                    To Location
                  </label>
                  <select
                    id="toLocation"
                    name="toLocation"
                    value={form.toLocation}
                    onChange={handleChange}
                    className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  >
                    <option value="">Select...</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="notes"
                  className="text-sm font-medium text-gray-700"
                >
                  Transfer Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Reason for transfer, special instructions..."
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 font-medium text-white transition-all hover:scale-[1.01] hover:shadow-lg"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Transfer Stock
              </button>
            </div>
          </section>
        </form>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-5 text-base font-bold text-gray-900 md:text-lg">
            Recent Movements
          </h3>
          <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
            <MapPin className="h-8 w-8" />
            <p className="text-sm">No movements recorded yet</p>
          </div>
        </section>
      </div>
    </div>
  );
}
