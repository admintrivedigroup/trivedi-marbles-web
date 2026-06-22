import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function AddStockLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 space-y-2 md:mb-8">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-4 w-52 rounded-xl" />
      </div>

      {/* Lot details card */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-5 h-5 w-28 rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Slab rows */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-5 h-5 w-20 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
