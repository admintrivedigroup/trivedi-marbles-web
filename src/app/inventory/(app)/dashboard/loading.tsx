import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 space-y-2 md:mb-8">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-4 w-32 rounded-xl" />
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-4 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <Skeleton className="h-10 w-10 rounded-lg md:h-12 md:w-12 md:rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-7 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-32 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-32 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
