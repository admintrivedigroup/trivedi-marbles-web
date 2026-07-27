// Server-side depth model registry.
// Client components must import from _lib/modelMeta.ts instead.

import type { ModelId } from "../_lib/types";
import { depthAnythingV2 } from "./depthAnythingV2";
import { metric3d }        from "./metric3d";
import { zoedepth }        from "./zoedepth";

export type DepthModelDefinition = {
  key:              ModelId;
  versionEnvKey:    string;
  replicateHint:    string;
  timeoutMs:        number;
  buildInput:       (imageDataUrl: string) => Record<string, unknown>;
  parseOutput:      (raw: unknown) => Promise<string | null>; // grey/raw depth, base64 no prefix
  parseColorOutput?: (raw: unknown) => Promise<string | null>; // optional pre-rendered colour depth
};

export const MODEL_REGISTRY: Record<ModelId, DepthModelDefinition> = {
  "depth-anything-v2": depthAnythingV2,
  "metric3d":          metric3d,
  "zoedepth":          zoedepth,
};
