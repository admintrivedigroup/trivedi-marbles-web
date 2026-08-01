"use client";

import type { TextureSettings } from "@/lib/visualizerM2F/types";

type Props = {
  settings:  TextureSettings;
  onChange:  (s: TextureSettings) => void;
  onApply:   () => void;
  rendering: boolean;
};

export function TextureControls({ settings, onChange, onApply, rendering }: Props) {
  function set<K extends keyof TextureSettings>(key: K, value: TextureSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="space-y-3">
      <SliderRow
        label="Scale" min={0.25} max={4} step={0.05} value={settings.scale}
        display={`${settings.scale.toFixed(2)}×`}
        onChange={(v) => set("scale", v)}
      />
      <SliderRow
        label="Rotation" min={0} max={360} step={1} value={settings.rotation}
        display={`${settings.rotation}°`}
        onChange={(v) => set("rotation", v)}
      />
      <SliderRow
        label="Brightness" min={0.5} max={1.5} step={0.01} value={settings.brightness}
        display={settings.brightness.toFixed(2)}
        onChange={(v) => set("brightness", v)}
      />
      <SliderRow
        label="Opacity" min={0} max={1} step={0.01} value={settings.opacity}
        display={`${Math.round(settings.opacity * 100)}%`}
        onChange={(v) => set("opacity", v)}
      />

      {/* Finish toggle */}
      <div className="flex items-center justify-between">
        <span className="w-24 shrink-0 text-xs font-medium text-gray-600">Finish</span>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          {(["matte", "gloss"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("finish", f)}
              className={`px-3 py-1 font-medium capitalize transition-colors ${
                settings.finish === f
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <button
        type="button"
        disabled={rendering}
        onClick={onApply}
        className="mt-1 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {rendering ? "Rendering…" : "Apply Texture"}
      </button>
    </div>
  );
}

function SliderRow({
  label, min, max, step, value, display, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-medium text-gray-600">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-indigo-600"
      />
      <span className="w-12 text-right text-xs tabular-nums text-gray-700">{display}</span>
    </div>
  );
}
