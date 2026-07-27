// OneFormer — universal segmentation (semantic + instance + panoptic)
//
// Replicate setup:
//   1. Find the model at replicate.com (search "oneformer ade20k")
//      Recommended: shi-labs/oneformer_ade20k_dinat_large
//   2. Copy the version hash
//   3. Add ONEFORMER_VERSION=<hash> to .env.local
//
// Status: placeholder — parser mirrors Mask2Former format.
// Update parseOutput once you verify the actual Replicate output schema.

import type { Segment } from "../_lib/types";
import { fetchAsBase64 } from "../_providers/replicate";
import type { ModelDefinition } from "./index";

async function parseSegmentArray(
  items: Array<{ label?: string; score?: number | null; mask?: string }>,
): Promise<Segment[]> {
  const segments: Segment[] = [];
  for (const item of items) {
    if (!item.label || !item.mask) continue;
    const src = item.mask;
    const maskBase64 = src.startsWith("http") ? await fetchAsBase64(src) : src;
    segments.push({
      label:      item.label.toLowerCase().trim(),
      score:      typeof item.score === "number" ? item.score : null,
      maskBase64,
    });
  }
  return segments;
}

export const oneformer: ModelDefinition = {
  key:           "oneformer",
  versionEnvKey: "ONEFORMER_VERSION",
  replicateHint: "Search replicate.com for 'oneformer' — use the ADE20K DiNAT-Large variant",
  timeoutMs:     120_000, // 2 min

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  async parseOutput(raw: unknown): Promise<Segment[]> {
    if (!raw) return [];

    if (Array.isArray(raw)) {
      return parseSegmentArray(
        raw as Array<{ label?: string; score?: number | null; mask?: string }>,
      );
    }

    if (typeof raw === "object" && "segments" in (raw as object)) {
      const obj = raw as { segments: Array<{ label?: string; score?: number | null; mask?: string }> };
      return parseSegmentArray(obj.segments ?? []);
    }

    if (typeof raw === "string" && raw.startsWith("http")) {
      const maskBase64 = await fetchAsBase64(raw);
      return [{ label: "segmentation map", score: null, maskBase64 }];
    }

    console.warn("[OneFormer] Unrecognised output format:", typeof raw, JSON.stringify(raw).slice(0, 300));
    return [];
  },
};
