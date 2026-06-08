import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function InventoryListLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-4 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:mb-6 md:rounded-2xl md:p-6">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-4 md:gap-4">
          <Skeleton className="h-12 rounded-xl md:col-span-2" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
        <div className="space-y-4 p-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[80px_1.4fr_1fr_1fr_0.8fr_0.8fr_1fr_0.9fr_0.9fr_1fr_0.9fr] gap-4">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex gap-3">
              <Skeleton className="h-20 w-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36 rounded-lg" />
                <Skeleton className="h-4 w-28 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, nestedIndex) => (
                <Skeleton key={nestedIndex} className="h-12 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
