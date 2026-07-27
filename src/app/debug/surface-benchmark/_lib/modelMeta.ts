// Client-safe model metadata — no server-only imports.
// Server-side model definitions (with parseOutput) live in _models/index.ts.

import type { ModelKey } from "./types";

export type ModelMeta = {
  key: ModelKey;
  name: string;
  description: string;
  dataset: string;
  task: "semantic" | "panoptic" | "instance";
  versionEnvKey: string;
  timeoutMs: number;
};

export const MODEL_META: Record<ModelKey, ModelMeta> = {
  "mask2former": {
    key:          "mask2former",
    name:         "Mask2Former",
    description:  "Panoptic segmentation — Swin-Large backbone, highest accuracy",
    dataset:      "ADE20K",
    task:         "panoptic",
    versionEnvKey:"MASK2FORMER_VERSION",
    timeoutMs:    300_000,
  },
  "segformer-b5": {
    key:          "segformer-b5",
    name:         "SegFormer B5",
    description:  "Semantic segmentation — Mix-Transformer encoder, fast inference",
    dataset:      "ADE20K",
    task:         "semantic",
    versionEnvKey:"SEGFORMER_B5_VERSION",
    timeoutMs:    120_000,
  },
  "oneformer": {
    key:          "oneformer",
    name:         "OneFormer",
    description:  "Universal segmentation (semantic + instance + panoptic)",
    dataset:      "ADE20K",
    task:         "panoptic",
    versionEnvKey:"ONEFORMER_VERSION",
    timeoutMs:    120_000,
  },
};

export const MODEL_KEYS = Object.keys(MODEL_META) as ModelKey[];
