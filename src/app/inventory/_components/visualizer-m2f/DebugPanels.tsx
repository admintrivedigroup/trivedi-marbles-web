"use client";

type Panel = {
  label:       string;
  url:         string | null;
  placeholder: string;
  loading?:    boolean;
};

type Props = {
  originalUrl:     string | null;
  overlayUrl:      string | null;
  maskHighlightUrl: string | null;
  depthUrl:        string | null;
  renderUrl:       string | null;
  segRunning:      boolean;
  depthRunning:    boolean;
  renderRunning:   boolean;
};

export function DebugPanels({
  originalUrl, overlayUrl, maskHighlightUrl, depthUrl, renderUrl,
  segRunning, depthRunning, renderRunning,
}: Props) {
  const panels: Panel[] = [
    {
      label:       "Original",
      url:         originalUrl,
      placeholder: "Select a room photo to begin.",
    },
    {
      label:       "Segmentation overlay",
      url:         overlayUrl,
      placeholder: "Run pipeline to see segments.",
      loading:     segRunning,
    },
    {
      label:       "Selected surface mask",
      url:         maskHighlightUrl,
      placeholder: "Select a surface type above.",
    },
    {
      label:       "Depth map",
      url:         depthUrl,
      placeholder: "Run pipeline to see depth.",
      loading:     depthRunning,
    },
    {
      label:       "Rendered result",
      url:         renderUrl,
      placeholder: "Select surface then apply texture.",
      loading:     renderRunning,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {panels.map(({ label, url, placeholder, loading }) => (
        <div key={label}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {label}
          </p>
          {loading ? (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <p className="text-[10px] text-indigo-500">Running…</p>
              </div>
            </div>
          ) : url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={label}
              className="w-full rounded-xl border border-gray-100 object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
              <p className="px-2 text-center text-[10px] text-gray-400">{placeholder}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
