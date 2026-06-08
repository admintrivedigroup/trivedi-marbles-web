export default function LotDetailLoading() {
  return (
    <div className="animate-pulse p-4 md:p-8">
      {/* Back link */}
      <div className="mb-6 h-5 w-32 rounded bg-gray-200" />

      {/* Header */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 rounded bg-gray-200" />
          <div className="h-6 w-16 rounded-full bg-gray-200" />
          <div className="h-6 w-14 rounded-full bg-gray-200" />
        </div>
        <div className="h-6 w-44 rounded bg-gray-200" />
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
        {/* Gallery skeleton */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex gap-2">
            {[80, 96, 88, 72].map((w) => (
              <div key={w} className={`h-9 w-${w / 4} rounded-lg bg-gray-200`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="aspect-4/3 bg-gray-200" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="h-3 w-28 rounded bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-200" />
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                  <div className="h-4 w-16 rounded bg-gray-200" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-6 w-6 rounded bg-gray-200" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary skeleton */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl bg-gray-50 p-3">
                  <div className="h-3 w-16 rounded bg-gray-200" />
                  <div className="mt-1.5 h-6 w-10 rounded bg-gray-200" />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="h-4 w-4 rounded bg-gray-200" />
                  <div className="space-y-1">
                    <div className="h-3 w-12 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
            <div className="h-9 w-24 rounded bg-gray-200" />
            <div className="mt-1 h-3 w-16 rounded bg-gray-200" />
            <div className="mt-3 h-14 rounded-xl bg-gray-100" />
          </div>

          <div className="space-y-2">
            <div className="h-12 rounded-xl bg-gray-200" />
            <div className="h-12 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
