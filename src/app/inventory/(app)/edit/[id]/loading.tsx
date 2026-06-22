import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function EditSlabLoading() {
  return (
    <div className="p-4 md:p-8">
      <Skeleton className="mb-6 h-5 w-32 rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Image upload area */}
        <div className="space-y-3">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        </div>

        {/* Form fields */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <Skeleton className="mb-5 h-5 w-28 rounded" />
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
            <Skeleton className="mt-2 h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
