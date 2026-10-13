// Types for the Mask2Former-based production visualizer pipeline.
// Keep self-contained.

export type SurfaceCategory =
  | "floor" | "wall" | "ceiling" | "stairs"
  | "opening" | "furniture" | "fixture" | "countertop" | "other";

export type PipelineSegment = {
  label:      string;
  score:      number | null;
  maskBase64: string; // grayscale PNG base64, no data: prefix
};

export type PipelineSegResult = {
  segments:    PipelineSegment[];
  inferenceMs: number;
  error:       string | null;
};

export type PipelineDepthResult = {
  depthBase64:      string | null;
  colorDepthBase64: string | null;
  inferenceMs:      number;
  error:            string | null;
};

export type PipelineSamResult = {
  masksBase64: string[]; // one grayscale PNG (base64, no data: prefix) per SAM 2 segment
  inferenceMs: number;
  error:       string | null;
};

export type TextureSettings = {
  scale:      number;   // tile size multiplier — 0.25 – 4
  rotation:   number;   // degrees
  brightness: number;   // 0.5 – 1.5
  opacity:    number;   // 0 – 1
  finish:     "matte" | "gloss";
};

export type SlabTexture = {
  id:           string;
  slabCode:     string | null;
  marbleName:   string | null;
  lotNumber:    string | null;
  thumbnailUrl: string;   // Cloudinary URL — for display only, not canvas
  length:       number | null; // feet — raw slab dimension, matches inventory's slab.length
  width:        number | null; // feet — raw slab dimension, matches inventory's slab.width
};

/** A slab's real dimensions in feet, as recorded in inventory. */
export type SlabSizeFt = { length: number; width: number };

// Used when a slab has no recorded dimensions.
export const DEFAULT_SLAB_SIZE_FT: SlabSizeFt = { length: 8, width: 5 };

// Formats raw slab dimensions the same way the inventory detail page does (`8' × 5'`).
export function formatSlabDimensions(length: number | null, width: number | null): string | null {
  if (!length || !width) return null;
  return `${length}' × ${width}'`;
}

export const DEFAULT_TEXTURE_SETTINGS: TextureSettings = {
  scale:      1.0,
  rotation:   0,
  brightness: 1.0,
  opacity:    1.0,
  finish:     "gloss",
};


// ── Slab layout ───────────────────────────────────────────────────────────────

export type RenderMode = "repeat" | "slab" | "sequential";

export type SlabLayout = "straight" | "herringbone";

export type SlabSettings = {
  slabWidth:  number;  // fallback only — fraction of a UV unit per slab when the floor's real scale is unknown
  slabHeight: number;  // fallback only — see slabWidth; normally the slab's real feet dimensions set its size
  jointSize:  number;  // total grout-line width in UV space  (0–0.015)
  jointColor: string;  // CSS hex color for grout, or "auto" = a darker shade of the slab itself
  randomize:  boolean; // per-slab offset / flip / brightness variation
  bookmatch:  boolean; // mirror alternating columns and rows so veins continue across every seam — forces offset/rotation/brightness jitter off, overrides randomize; only affects renderMode "slab"
  layout:     SlabLayout; // "straight" (default grid) | "herringbone" — only affects renderMode "slab"
};

export const DEFAULT_SLAB_SETTINGS: SlabSettings = {
  slabWidth:  0.25,
  slabHeight: 0.333,
  jointSize:  0.001,
  jointColor: "auto",
  randomize:  true,
  bookmatch:  true,
  layout:     "straight",
};
