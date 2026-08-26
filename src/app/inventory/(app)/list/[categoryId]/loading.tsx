import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function CategoryLotGridLoading() {
  return (
    <div className="p-4 md:p-8">
      <Skeleton className="mb-4 h-5 w-28 rounded" />

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm md:mb-8 md:rounded-2xl md:p-6">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-5 md:gap-4">
          <Skeleton className="h-12 rounded-xl md:col-span-2" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
