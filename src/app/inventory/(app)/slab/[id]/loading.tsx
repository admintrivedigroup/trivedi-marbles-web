import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function SlabDetailLoading() {
  return (
    <div>
      <div className="px-4 py-4 md:px-8">
        <Skeleton className="h-5 w-36 rounded-lg" />
      </div>

      <div className="px-4 pb-10 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Photo skeleton */}
          <div className="space-y-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="flex gap-2">
              <Skeleton className="h-20 w-20 rounded-xl" />
            </div>
          </div>

          {/* Detail card skeleton */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="p-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-4 w-28 rounded-lg" />
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 flex-shrink-0 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-14 rounded" />
                      <Skeleton className="h-4 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <Skeleton className="mb-4 h-5 w-16 rounded" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-7 w-20 rounded" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <Skeleton className="h-4 w-36 rounded" />
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <Skeleton className="mb-2 h-5 w-12 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="mt-1.5 h-4 w-3/4 rounded" />
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <Skeleton className="mb-4 h-5 w-16 rounded" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
