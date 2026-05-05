"use client";

import { useState } from "react";
import { Download, Plus, Share2, X } from "lucide-react";

import { slabs } from "@/data/inventory";

type QuotationItem = {
  name: string;
  pricePerSqft: number;
  slabId: string;
  sqft: number;
};

export function InventoryQuotation() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedSlabId, setSelectedSlabId] = useState("");
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);

  const availableSlabs = slabs.filter((slab) => slab.status === "Available");

  const addItem = () => {
    if (!selectedSlabId) {
      return;
    }

    const slab = slabs.find((entry) => entry.id === selectedSlabId);

    if (!slab) {
      return;
    }

    const nextItem: QuotationItem = {
      slabId: slab.slabId,
      name: slab.name,
      sqft: slab.sqft,
      pricePerSqft: slab.sellPrice,
    };

    setQuotationItems([...quotationItems, nextItem]);
    setSelectedSlabId("");
  };

  const removeItem = (index: number) => {
    setQuotationItems(quotationItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const total = quotationItems.reduce(
    (sum, item) => sum + item.sqft * item.pricePerSqft,
    0,
  );

  const handleGeneratePdf = () => {
    window.alert("Generating PDF quotation...");
  };

  const handleWhatsApp = () => {
    window.alert("Sending via WhatsApp...");
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
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
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
                  onChange={(event) => setCustomerName(event.target.value)}
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
                  onChange={(event) => setCustomerPhone(event.target.value)}
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
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
            <h2 className="mb-4 text-lg font-bold text-gray-900 md:mb-6 md:text-xl">
              Add Slabs
            </h2>
            <div className="mb-4 flex flex-col gap-3 md:mb-6 md:gap-4 sm:flex-row">
              <select
                value={selectedSlabId}
                onChange={(event) => setSelectedSlabId(event.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              >
                <option value="">Select a slab...</option>
                {availableSlabs.map((slab) => (
                  <option key={slab.id} value={slab.id}>
                    {slab.slabId} - {slab.name} ({slab.sqft} sqft @ Rs.{" "}
                    {slab.sellPrice}/sqft)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addItem}
                disabled={!selectedSlabId}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
              >
                <Plus className="h-5 w-5" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {quotationItems.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No items added yet</p>
              ) : (
                quotationItems.map((item, index) => (
                  <div
                    key={`${item.slabId}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-gray-50 p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="font-mono text-sm text-gray-500">{item.slabId}</p>
                    </div>
                    <div className="mr-4 text-right">
                      <p className="text-sm text-gray-500">
                        {item.sqft} sqft x Rs. {item.pricePerSqft}
                      </p>
                      <p className="font-bold text-gray-900">
                        Rs. {(item.sqft * item.pricePerSqft).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg p-2 transition-colors hover:bg-red-100"
                    >
                      <X className="h-5 w-5 text-red-600" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4 md:space-y-6">
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
            <h2 className="mb-4 text-lg font-bold text-gray-900 md:mb-6 md:text-xl">
              Summary
            </h2>
            <div className="mb-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-semibold text-gray-900">
                  {quotationItems.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sqft:</span>
                <span className="font-semibold text-gray-900">
                  {quotationItems.reduce((sum, item) => sum + item.sqft, 0)} sqft
                </span>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    Total Amount:
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    Rs. {total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={quotationItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:scale-100"
              >
                <Download className="h-5 w-5" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                disabled={quotationItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:scale-100"
              >
                <Share2 className="h-5 w-5" />
                Send via WhatsApp
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-[linear-gradient(135deg,#f9fafb_0%,#f3f4f6_100%)] p-4 md:rounded-2xl md:p-6">
            <h3 className="mb-3 font-semibold text-gray-900">Quick Tips</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>- Add customer details for personalized quotes</li>
              <li>- Select multiple slabs for package deals</li>
              <li>- PDF includes all slab details and images</li>
              <li>- WhatsApp sends direct to customer</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
