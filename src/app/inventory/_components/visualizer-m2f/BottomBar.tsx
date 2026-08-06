"use client";

import { useState } from "react";
import type { TextureSettings, SlabSettings, SlabLayout } from "@/lib/visualizerM2F/types";

type CurrentSlabInfo = { thumbnailUrl: string; name: string; size: string | null };

type Props = {
  slab: CurrentSlabInfo | null;
  settings: TextureSettings;
  onSettingsChange: (s: TextureSettings) => void;
  slabSettings: SlabSettings;
  onSlabSettingsChange: (s: SlabSettings) => void;
  onApply: () => void;
  rendering: boolean;
  onReset: () => void;
  moreSettings?: React.ReactNode; // full TextureControls/SlabControls panel, toggled open here
  floorControlsDisabled?: boolean; // Pattern/Grout only affect the perspective floor renderer
};

export function BottomBar({
  slab, settings, onSettingsChange, slabSettings, onSlabSettingsChange, onApply, rendering, onReset, moreSettings,
  floorControlsDisabled,
}: Props) {
  const [openPopover, setOpenPopover] = useState<"rotate" | "grout" | "more" | null>(null);

  function togglePopover(name: "rotate" | "grout" | "more") {
    setOpenPopover((cur) => (cur === name ? null : name));
  }

  return (
    <div className="absolute inset-x-4 bottom-4 z-20 flex flex-col gap-2">
      {openPopover === "rotate" && (
        <Popover onClose={() => setOpenPopover(null)}>
          <PopoverLabel>Rotation — {settings.rotation}°</PopoverLabel>
          <input
            type="range" min={0} max={360} step={1} value={settings.rotation}
            onChange={(e) => { onSettingsChange({ ...settings, rotation: Number(e.target.value) }); onApply(); }}
            className="w-full accent-[#9c7c42]"
          />
        </Popover>
      )}

      {openPopover === "grout" && (
        <Popover onClose={() => setOpenPopover(null)}>
          <PopoverLabel>Grout thickness — {slabSettings.jointSize === 0 ? "none" : slabSettings.jointSize.toFixed(3)}</PopoverLabel>
          <input
            type="range" min={0} max={0.015} step={0.001} value={slabSettings.jointSize}
            onChange={(e) => { onSlabSettingsChange({ ...slabSettings, jointSize: Number(e.target.value) }); onApply(); }}
            className="w-full accent-[#9c7c42]"
          />
          <div className="mt-2 flex items-center gap-2">
            <PopoverLabel>Grout color</PopoverLabel>
            <input
              type="color" value={slabSettings.jointColor}
              onChange={(e) => { onSlabSettingsChange({ ...slabSettings, jointColor: e.target.value }); onApply(); }}
              className="h-6 w-10 cursor-pointer rounded border border-stone-200 p-0.5"
            />
          </div>
        </Popover>
      )}

      {openPopover === "more" && moreSettings && (
        <Popover onClose={() => setOpenPopover(null)} wide>
          {moreSettings}
        </Popover>
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
          <BarButton onClick={() => togglePopover("rotate")} active={openPopover === "rotate"} icon={<RotateIcon />}>Rotate</BarButton>

          <div className={`flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 ${floorControlsDisabled ? "opacity-40" : ""}`}>
            <PatternButton active={slabSettings.layout === "straight"} disabled={floorControlsDisabled} onClick={() => { onSlabSettingsChange({ ...slabSettings, layout: "straight" as SlabLayout }); onApply(); }}>
              Straight
            </PatternButton>
            <span title="Coming soon — plank geometry for true 90° herringbone is still in progress." className="relative">
              <PatternButton active={false} disabled>Herringbone</PatternButton>
              <span className="pointer-events-none absolute -right-1 -top-1.5 rounded bg-[#c8a96a] px-1 text-[7px] font-extrabold uppercase tracking-wide text-[#17130f]">Soon</span>
            </span>
          </div>

          <BarButton onClick={() => togglePopover("grout")} active={openPopover === "grout"} disabled={floorControlsDisabled} icon={<GroutIcon color={slabSettings.jointColor} />}>Grout</BarButton>

          {moreSettings && (
            <BarButton onClick={() => togglePopover("more")} active={openPopover === "more"} icon={<MoreIcon />}>
              {rendering ? "Rendering…" : "More"}
            </BarButton>
          )}
        </div>
      </div>
    </div>
  );
}

function Popover({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className={`relative self-end rounded-xl border border-stone-200 bg-white p-4 shadow-2xl ${wide ? "w-full max-w-md" : "w-64"}`}>
      <button type="button" onClick={onClose} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {children}
    </div>
  );
}

function PopoverLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">{children}</p>;
}

function BarButton({ children, onClick, icon, active, disabled }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-[#c8a96a] bg-[#c8a96a]/10 text-stone-900" : "border-stone-200 bg-white text-stone-500 hover:border-[#c8a96a]/50 hover:text-stone-800"
      }`}
    >
      <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">{icon}</span>
      {children}
    </button>
  );
}

function PatternButton({ children, active, onClick, disabled }: { children: React.ReactNode; active: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[#17130f] text-[#faf8f5]" : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

function ResetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v6h6M20 20v-6h-6" /><path d="M5 15a8 8 0 0014 3M19 9a8 8 0 00-14-3" /></svg>;
}
function RotateIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 4v5h-5" /></svg>;
}
function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
}
function GroutIcon({ color }: { color: string }) {
  return (
    <span className="block h-full w-full rounded-sm border border-black/10" style={{ background: color }} />
  );
}
