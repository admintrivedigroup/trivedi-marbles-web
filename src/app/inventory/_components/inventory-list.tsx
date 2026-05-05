"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, Eye, Filter, Package, Search } from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { slabs } from "@/data/inventory";

const locationOptions = [
  { label: "All Locations", value: "All" },
  { label: "Ahmedabad", value: "Ahmedabad" },
  { label: "Ambaji", value: "Ambaji" },
] as const;

const statusOptions = [
  { label: "All Status", value: "All" },
  { label: "Available", value: "Available" },
  { label: "Reserved", value: "Reserved" },
  { label: "Sold", value: "Sold" },
] as const;

function getStatusColor(status: string) {
  switch (status) {
    case "Available":
      return "bg-green-100 text-green-700";
    case "Reserved":
      return "bg-orange-100 text-orange-700";
    case "Sold":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function InventoryList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredSlabs = slabs.filter((slab) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      slab.name.toLowerCase().includes(normalizedSearch) ||
      slab.slabId.toLowerCase().includes(normalizedSearch);
    const matchesLocation =
      locationFilter === "All" || slab.location === locationFilter;
    const matchesStatus = statusFilter === "All" || slab.status === statusFilter;

    return matchesSearch && matchesLocation && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
            Inventory
          </h1>
          <p className="text-gray-500">{filteredSlabs.length} slabs found</p>
        </div>
        <Link
          href="/inventory/add"
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg"
        >
          <Package className="h-5 w-5" />
          Add New Slab
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:mb-6 md:rounded-2xl md:p-6">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-4 md:gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or slab ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Photo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Slab ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Size
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Sqft
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Thickness
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Location
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Rack
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSlabs.map((slab) => (
                <tr key={slab.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <ImageWithFallback
                      src={slab.images[0]}
                      alt={slab.name}
                      className="h-16 w-16 rounded-lg object-cover shadow-sm"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{slab.name}</p>
                    <p className="text-sm text-gray-500">{slab.category}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">
                    {slab.slabId}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {slab.length}&apos; × {slab.width}&apos;
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-700">
                    {slab.sqft}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{slab.thickness}mm</td>
                  <td className="px-6 py-4 text-gray-700">{slab.location}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">
                    {slab.rack}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(slab.status)}`}
                    >
                      {slab.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    Rs. {slab.sellPrice}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/inventory/slab/${slab.id}`}
                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </Link>
                      <Link
                        href={`/inventory/edit/${slab.id}`}
                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {filteredSlabs.map((slab) => (
          <div
            key={slab.id}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex gap-3">
              <ImageWithFallback
                src={slab.images[0]}
                alt={slab.name}
                className="h-20 w-20 flex-shrink-0 rounded-lg object-cover shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 font-medium text-gray-900">{slab.name}</h3>
                <p className="mb-2 text-sm text-gray-500">{slab.category}</p>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(slab.status)}`}
                >
                  {slab.status}
                </span>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Slab ID</p>
                <p className="font-mono text-gray-900">{slab.slabId}</p>
              </div>
              <div>
                <p className="text-gray-500">Size</p>
                <p className="text-gray-900">
                  {slab.length}&apos; × {slab.width}&apos;
                </p>
              </div>
              <div>
                <p className="text-gray-500">Sqft</p>
                <p className="font-semibold text-gray-900">{slab.sqft}</p>
              </div>
              <div>
                <p className="text-gray-500">Thickness</p>
                <p className="text-gray-900">{slab.thickness}mm</p>
              </div>
              <div>
                <p className="text-gray-500">Location</p>
                <p className="text-gray-900">{slab.location}</p>
              </div>
              <div>
                <p className="text-gray-500">Rack</p>
                <p className="font-mono text-gray-900">{slab.rack}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
              <div>
                <p className="text-sm text-gray-500">Price</p>
                <p className="font-semibold text-gray-900">
                  Rs. {slab.sellPrice}/sqft
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/inventory/slab/${slab.id}`}
                  className="rounded-lg p-2.5 transition-colors hover:bg-gray-100"
                  title="View Details"
                >
                  <Eye className="h-5 w-5 text-gray-600" />
                </Link>
                <Link
                  href={`/inventory/edit/${slab.id}`}
                  className="rounded-lg p-2.5 transition-colors hover:bg-gray-100"
                  title="Edit"
                >
                  <Edit className="h-5 w-5 text-gray-600" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
