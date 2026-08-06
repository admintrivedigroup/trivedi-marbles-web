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

// Formats raw slab dimensions the same way the inventory detail page does (`8' × 5'`).
export function formatSlabDimensions(length: number | null, width: number | null): string | null {
  if (!length || !width) return null;
  return `${length}' × ${width}'`;
}

export const DEFAULT_TEXTURE_SETTINGS: TextureSettings = {
  scale:      1.0,
  rotation:   0,
  brightness: 1.0,
  opacity:    0.88,
  finish:     "matte",
};

// ── Slab layout ───────────────────────────────────────────────────────────────

export type RenderMode = "repeat" | "slab" | "sequential";

export type SlabLayout = "straight" | "herringbone";

export type SlabSettings = {
  slabWidth:  number;  // fraction of floor UV width occupied by one slab  (0.10–0.50)
  slabHeight: number;  // fraction of floor UV height occupied by one slab (0.10–0.50)
  jointSize:  number;  // total grout-line width in UV space  (0–0.015)
  jointColor: string;  // CSS hex color for grout
  randomize:  boolean; // per-slab offset / flip / brightness variation
  layout:     SlabLayout; // "straight" (default grid) | "herringbone" — only affects renderMode "slab"
};

export const DEFAULT_SLAB_SETTINGS: SlabSettings = {
  slabWidth:  0.25,
  slabHeight: 0.333,
  jointSize:  0.004,
  jointColor: "#c8c0b0",
  randomize:  true,
  layout:     "straight",
};
