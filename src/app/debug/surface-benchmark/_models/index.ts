// Server-side model registry.
// Client components must import from _lib/modelMeta.ts instead.

import type { Segment, ModelKey } from "../_lib/types";
import { mask2former }  from "./mask2former";
import { segformerB5 } from "./segformer-b5";
import { oneformer }   from "./oneformer";

export type ModelDefinition = {
  key:           ModelKey;
  versionEnvKey: string;
  replicateHint: string;
  timeoutMs:     number;
  buildInput:    (imageDataUrl: string) => Record<string, unknown>;
  parseOutput:   (raw: unknown) => Promise<Segment[]>;
};

export const MODEL_REGISTRY: Record<ModelKey, ModelDefinition> = {
  "mask2former":  mask2former,
  "segformer-b5": segformerB5,
  "oneformer":    oneformer,
};
