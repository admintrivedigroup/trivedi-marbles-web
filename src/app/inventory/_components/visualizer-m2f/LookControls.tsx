"use client";

import type { RenderMode, SlabSettings, TextureSettings } from "@/lib/visualizerM2F/types";

// Showroom-facing settings: a few named choices instead of the renderer's raw
// modes and UV sliders. Each choice maps onto the underlying settings here.

type Look = { renderMode: RenderMode; slabSettings: SlabSettings; settings: TextureSettings };

type Props = Look & {
  /** Floor uses the perspective slab renderer; other surfaces only have finish + texture tuning. */
  isFloor:   boolean;
  /** e.g. `8' × 5'` from inventory, or null when the slab has no recorded size. */
  sizeLabel: string | null;
  onChange:  (next: Look) => void;
};

type Pattern = "bookmatch" | "natural" | "flow";

const PATTERNS: Array<{ id: Pattern; name: string; hint: string }> = [
  { id: "bookmatch", name: "Bookmatch",   hint: "Mirrored — veins meet at every joint" },
  { id: "natural",   name: "Natural",     hint: "Each slab laid differently" },
  { id: "flow",      name: "Single flow", hint: "Pattern repeats in one direction" },
];

const JOINTS: Array<{ name: string; size: number }> = [
  { name: "None",    size: 0 },
  { name: "Thin",    size: 0.001 },
  { name: "Visible", size: 0.003 },
];

function patternOf(renderMode: RenderMode, slab: SlabSettings): Pattern {
  if (renderMode === "sequential") return "flow";
  return slab.bookmatch ? "bookmatch" : "natural";
}

export function LookControls({ isFloor, sizeLabel, renderMode, slabSettings, settings, onChange }: Props) {
  const pattern = patternOf(renderMode, slabSettings);
  // Nearest preset, so a value set elsewhere still highlights something sensible.
  const joint = JOINTS.reduce((best, j) =>
    Math.abs(j.size - slabSettings.jointSize) < Math.abs(best.size - slabSettings.jointSize) ? j : best);

  function setPattern(p: Pattern) {
    onChange({
      settings,
      renderMode:   p === "flow" ? "sequential" : "slab",
      slabSettings: { ...slabSettings, bookmatch: p === "bookmatch", randomize: true },
    });
  }
  const setSlab    = (patch: Partial<SlabSettings>)    => onChange({ renderMode, settings, slabSettings: { ...slabSettings, ...patch } });
  const setTexture = (patch: Partial<TextureSettings>) => onChange({ renderMode, slabSettings, settings: { ...settings, ...patch } });

  return (
    <div className="max-h-[55vh] space-y-5 overflow-y-auto text-left">
      {isFloor && (
        <Section title="Pattern">
          <div className="grid grid-cols-3 gap-2">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPattern(p.id)}
                className={`rounded-lg border p-2 text-left transition-colors ${
                  pattern === p.id ? "border-[#c8a96a] bg-[#c8a96a]/10" : "border-stone-200 bg-white hover:border-[#c8a96a]/50"
                }`}
              >
                <PatternThumb pattern={p.id} />
                <p className="mt-1.5 text-xs font-semibold text-stone-900">{p.name}</p>
                <p className="text-[10px] leading-snug text-stone-500">{p.hint}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {isFloor && (
        <Section title="Joint">
          <Segmented
            options={JOINTS.map((j) => j.name)}
            value={joint.name}
            onChange={(name) => setSlab({ jointSize: JOINTS.find((j) => j.name === name)!.size })}
          />
        </Section>
      )}

      <Section title="Finish">
        <Segmented
          options={["Matte", "Polished"]}
          value={settings.finish === "gloss" ? "Polished" : "Matte"}
          onChange={(name) => setTexture({ finish: name === "Polished" ? "gloss" : "matte" })}
        />
      </Section>

      {isFloor && (
        <p className="text-[11px] text-stone-500">
          Slab size: <span className="font-semibold text-stone-800">{sizeLabel ?? "8' × 5' (not recorded for this slab)"}</span>
          {sizeLabel && " — from inventory"}
        </p>
      )}

      <details className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-stone-400">Advanced</summary>
        <div className="mt-3 space-y-3">
          {!isFloor && (
            <>
              <SliderRow label="Scale" min={0.25} max={4} step={0.05} value={settings.scale}
                display={`${settings.scale.toFixed(2)}×`} onChange={(v) => setTexture({ scale: v })} />
              <SliderRow label="Rotation" min={0} max={360} step={1} value={settings.rotation}
                display={`${settings.rotation}°`} onChange={(v) => setTexture({ rotation: v })} />
            </>
          )}
          <SliderRow label="Brightness" min={0.5} max={1.5} step={0.01} value={settings.brightness}
            display={settings.brightness.toFixed(2)} onChange={(v) => setTexture({ brightness: v })} />
          <SliderRow label="Opacity" min={0} max={1} step={0.01} value={settings.opacity}
            display={`${Math.round(settings.opacity * 100)}%`} onChange={(v) => setTexture({ opacity: v })} />
          {isFloor && (
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-medium text-stone-600">Joint colour</span>
              <button
                type="button"
                onClick={() => setSlab({ jointColor: "auto" })}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  slabSettings.jointColor === "auto" ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-600"
                }`}
              >
                Match slab
              </button>
              <input
                type="color"
                aria-label="Custom joint colour"
                value={slabSettings.jointColor === "auto" ? "#8c867c" : slabSettings.jointColor}
                onChange={(e) => setSlab({ jointColor: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-stone-200 p-0.5"
              />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400">{title}</p>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-xs">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-4 py-1.5 font-medium transition-colors ${
            value === o ? "bg-stone-900 text-stone-50" : "bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          {o}
        </button>
      ))}
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
      <span className="w-24 shrink-0 text-xs font-medium text-stone-600">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#9c7c42]"
      />
      <span className="w-12 text-right text-xs tabular-nums text-stone-700">{display}</span>
    </div>
  );
}

// Four slabs with one vein each: mirrored for bookmatch, scattered for natural, parallel for single flow.
function PatternThumb({ pattern }: { pattern: Pattern }) {
  const veins: Record<Pattern, string[]> = {
    bookmatch: ["M4 22 L22 4", "M44 22 L26 4", "M4 26 L22 44", "M44 26 L26 44"],
    natural:   ["M4 18 L22 6", "M28 4 L42 22", "M6 28 L20 44", "M26 40 L44 30"],
    flow:      ["M4 22 L22 4", "M26 22 L44 4", "M4 44 L22 26", "M26 44 L44 26"],
  };
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-full rounded bg-stone-200" aria-hidden="true">
      <path d="M24 0 V48 M0 24 H48" stroke="#faf8f5" strokeWidth="1.5" />
      {veins[pattern].map((d) => <path key={d} d={d} stroke="#57534e" strokeWidth="2.5" strokeLinecap="round" fill="none" />)}
    </svg>
  );
}
