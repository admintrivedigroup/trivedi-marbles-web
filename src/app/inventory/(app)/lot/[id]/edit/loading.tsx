import { Skeleton } from "@/app/inventory/_components/ui/skeleton";

export default function EditLotLoading() {
  return (
    <div className="p-4 md:p-8">
      <Skeleton className="mb-6 h-5 w-32 rounded-lg" />
      <Skeleton className="mb-6 h-8 w-40 rounded-xl" />

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-12 w-32 rounded-xl" />
          <Skeleton className="h-12 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
