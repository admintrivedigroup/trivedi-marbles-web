"use client";

import type { SlabSettings } from "@/lib/visualizerM2F/types";

type Props = {
  settings: SlabSettings;
  onChange: (s: SlabSettings) => void;
};

export function SlabControls({ settings, onChange }: Props) {
  const set = <K extends keyof SlabSettings>(k: K, v: SlabSettings[K]) =>
    onChange({ ...settings, [k]: v });

  const approxAcross = Math.round(1 / settings.slabWidth);
  const approxDeep   = Math.round(1 / settings.slabHeight);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">

        {/* Slab width */}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Slab width — ≈{approxAcross} across
          </label>
          <input
            type="range"
            min={0.10} max={0.50} step={0.025}
            value={settings.slabWidth}
            onChange={(e) => set("slabWidth", Number(e.target.value))}
            className="w-full accent-[#9c7c42]"
          />
          <div className="flex justify-between text-[9px] text-stone-300 mt-0.5">
            <span>narrow</span><span>wide</span>
          </div>
        </div>

        {/* Slab height */}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Slab height — ≈{approxDeep} rows
          </label>
          <input
            type="range"
            min={0.10} max={0.50} step={0.025}
            value={settings.slabHeight}
            onChange={(e) => set("slabHeight", Number(e.target.value))}
            className="w-full accent-[#9c7c42]"
          />
          <div className="flex justify-between text-[9px] text-stone-300 mt-0.5">
            <span>short</span><span>tall</span>
          </div>
        </div>

        {/* Joint size */}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Grout thickness — {settings.jointSize === 0 ? "none" : settings.jointSize.toFixed(3)}
          </label>
          <input
            type="range"
            min={0} max={0.015} step={0.001}
            value={settings.jointSize}
            onChange={(e) => set("jointSize", Number(e.target.value))}
            className="w-full accent-[#9c7c42]"
          />
          <div className="flex justify-between text-[9px] text-stone-300 mt-0.5">
            <span>none</span><span>wide</span>
          </div>
        </div>

        {/* Joint color */}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Grout color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.jointColor}
              onChange={(e) => set("jointColor", e.target.value)}
              className="h-8 w-16 cursor-pointer rounded-lg border border-stone-200 p-0.5"
            />
            <span className="text-[10px] text-stone-400">{settings.jointColor}</span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-5 pt-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-stone-600">
          <input
            type="checkbox"
            checked={settings.randomize}
            onChange={(e) => set("randomize", e.target.checked)}
            className="h-3 w-3 rounded accent-[#9c7c42]"
          />
          Randomize offset / flip / brightness per slab
        </label>
        <label className="flex cursor-not-allowed items-center gap-1.5 text-[10px] text-stone-300">
          <input type="checkbox" disabled className="h-3 w-3 rounded" />
          Bookmatch (coming soon)
        </label>
      </div>
    </div>
  );
}
