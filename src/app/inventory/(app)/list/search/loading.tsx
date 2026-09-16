import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function AdvancedSlabSearchLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-32 rounded-xl" />
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-xl" />
      </div>

      <Skeleton className="mb-6 h-24 w-full rounded-2xl md:mb-8" />

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
