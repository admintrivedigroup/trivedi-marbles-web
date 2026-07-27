// SegFormer B5 — ADE20K semantic segmentation (640×640)
//
// Replicate setup:
//   1. Find the model at replicate.com (search "segformer b5 ade20k")
//      Recommended: nvidia/segformer-b5-finetuned-ade-640-640
//   2. Copy the version hash
//   3. Add SEGFORMER_B5_VERSION=<hash> to .env.local
//
// Expected input:  { image: "<data URL or CDN URL>" }
// Expected output: one of:
//   a) Array of { label, score, mask }  — same format as HuggingFace inference API
//   b) String URL to a colorised segmentation image
//   c) Object with { segments: [...] }

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

export const segformerB5: ModelDefinition = {
  key:           "segformer-b5",
  versionEnvKey: "SEGFORMER_B5_VERSION",
  replicateHint: "Search replicate.com for 'segformer b5' — use the ADE20K 640×640 variant",
  timeoutMs:     120_000, // 2 min

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  async parseOutput(raw: unknown): Promise<Segment[]> {
    if (!raw) return [];

    // Format A: [{ label, score, mask }]
    if (Array.isArray(raw)) {
      return parseSegmentArray(
        raw as Array<{ label?: string; score?: number | null; mask?: string }>,
      );
    }

    // Format B: { segments: [...] }
    if (typeof raw === "object" && "segments" in (raw as object)) {
      const obj = raw as { segments: Array<{ label?: string; score?: number | null; mask?: string }> };
      return parseSegmentArray(obj.segments ?? []);
    }

    // Format C: URL to colorised image
    if (typeof raw === "string" && raw.startsWith("http")) {
      const maskBase64 = await fetchAsBase64(raw);
      return [{ label: "segmentation map", score: null, maskBase64 }];
    }

    console.warn("[SegFormer B5] Unrecognised output format:", typeof raw, JSON.stringify(raw).slice(0, 300));
    return [];
  },
};
