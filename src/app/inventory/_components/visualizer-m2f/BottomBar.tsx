"use client";

import { useState } from "react";

type CurrentSlabInfo = { thumbnailUrl: string; name: string; size: string | null };

type Props = {
  slab: CurrentSlabInfo | null;
  rendering: boolean;
  onReset: () => void;
  /** The LookControls panel, toggled open from the Settings button. */
  settingsPanel?: React.ReactNode;
};

export function BottomBar({ slab, rendering, onReset, settingsPanel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute inset-x-4 bottom-4 z-20 flex flex-col gap-2">
      {open && settingsPanel && (
        <div className="relative w-full max-w-md self-end rounded-xl border border-stone-200 bg-white p-4 shadow-2xl">
          <button type="button" aria-label="Close settings" onClick={() => setOpen(false)} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          {settingsPanel}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-[#faf8f5] px-4 py-2.5 shadow-2xl">
        <div className="flex min-w-0 items-center gap-2.5">
          {slab ? (
            <>
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slab.thumbnailUrl} alt={slab.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-[13px] font-semibold leading-tight text-stone-900">{slab.name}</p>
                <p className="text-[10px] text-stone-500">{slab.size ?? "Size not recorded"}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-stone-400">No slab selected</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <BarButton onClick={onReset} icon={<ResetIcon />}>Reset</BarButton>
          {settingsPanel && (
            <BarButton onClick={() => setOpen((o) => !o)} active={open} icon={<SettingsIcon />}>
              {rendering ? "Rendering…" : "Settings"}
            </BarButton>
          )}
        </div>
      </div>
    </div>
  );
}

function BarButton({ children, onClick, icon, active }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11.5px] font-semibold transition-colors ${
        active ? "border-[#c8a96a] bg-[#c8a96a]/10 text-stone-900" : "border-stone-200 bg-white text-stone-500 hover:border-[#c8a96a]/50 hover:text-stone-800"
      }`}
    >
      <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">{icon}</span>
      {children}
    </button>
  );
}

function ResetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v6h6M20 20v-6h-6" /><path d="M5 15a8 8 0 0014 3M19 9a8 8 0 00-14-3" /></svg>;
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
}
