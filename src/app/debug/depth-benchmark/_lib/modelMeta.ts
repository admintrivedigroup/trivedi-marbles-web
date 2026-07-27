// Client-safe model metadata — no server-only imports.
// Server-side model definitions (with buildInput/parseOutput) live in _models/index.ts.

import type { ModelId } from "./types";

export type ModelMeta = {
  key:           ModelId;
  name:          string;
  description:   string;
  paper:         string;
  versionEnvKey: string;
  timeoutMs:     number;
};

export const MODEL_META: Record<ModelId, ModelMeta> = {
  "depth-anything-v2": {
    key:           "depth-anything-v2",
    name:          "Depth Anything V2 Large",
    description:   "Foundation model for monocular depth — strong indoor/outdoor generalisation",
    paper:         "Depth Anything V2 (Yang et al. 2024)",
    versionEnvKey: "DEPTH_ANYTHING_V2_VERSION",
    timeoutMs:     180_000,
  },
  "metric3d": {
    key:           "metric3d",
    name:          "Metric3D v2",
    description:   "Zero-shot metric depth estimation; outputs real-world scale in metres",
    paper:         "Metric3D (Yin et al. 2023 / 2024)",
    versionEnvKey: "METRIC3D_VERSION",
    timeoutMs:     240_000,
  },
  "zoedepth": {
    key:           "zoedepth",
    name:          "ZoeDepth",
    description:   "Zero-shot relative depth; fine-tuned for indoor↔outdoor transfer",
    paper:         "ZoeDepth (Bhat et al. 2023)",
    versionEnvKey: "ZOEDEPTH_VERSION",
    timeoutMs:     180_000,
  },
};

export const MODEL_IDS = Object.keys(MODEL_META) as ModelId[];
