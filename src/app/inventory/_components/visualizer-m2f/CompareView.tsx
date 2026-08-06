"use client";

type ComparisonSlab = {
  id: string;
  slabCode: string;
  marbleName: string | null;
  thumbnailUrl: string | null;
};

type Props = {
  onClose: () => void;
  leftUrl: string;
  leftLabel: string;
  comparisons: ComparisonSlab[];
  rightSlabId: string | null;
  onSelectRight: (slab: ComparisonSlab) => void;
  rightUrl: string | null;
  rightLabel: string | null;
  rightRendering: boolean;
};

export function CompareView({
  onClose, leftUrl, leftLabel, comparisons, rightSlabId, onSelectRight, rightUrl, rightLabel, rightRendering,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f0d0b]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <h2 className="font-serif text-lg font-medium text-[#faf8f5]">Compare slabs</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#cfc6b8] hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
          Close
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-[#c8a96a]">{leftLabel}</p>
          <div className="flex-1 overflow-hidden rounded-lg border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leftUrl} alt={leftLabel} className="h-full w-full object-contain" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-[#c8a96a]">
            {rightLabel ?? "Choose a slab to compare"}
          </p>
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {rightRendering ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c8a96a] border-t-transparent" />
            ) : rightUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={rightUrl} alt={rightLabel ?? "Comparison render"} className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-xs text-stone-500">Pick a slab below to render it on the same room.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
        {comparisons.map((slab) => (
          <button
            key={slab.id}
            type="button"
            onClick={() => onSelectRight(slab)}
            title={slab.marbleName ?? slab.slabCode}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
              rightSlabId === slab.id ? "border-[#c8a96a]" : "border-transparent hover:border-white/30"
            }`}
          >
            {slab.thumbnailUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={slab.thumbnailUrl} alt={slab.marbleName ?? slab.slabCode} className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
