// Mask2Former — ADE20K panoptic segmentation
//
// Replicate setup:
//   1. Find the model at replicate.com (search "mask2former ade20k")
//      Recommended: hassamdevsy/mask2former  (or facebook/mask2former-swin-large-ade-panoptic)
//   2. Copy the version hash
//   3. Add MASK2FORMER_VERSION=<hash> to .env.local
//
// Expected input:  { image: "<data URL or CDN URL>" }
// Expected output: one of:
//   a) Color-map format: { objects: [{color:[r,g,b], label}], segment: url }  ← hassamdevsy variant
//   b) Array of { label, score, mask }
//   c) Object with { segments: [...] }
//   d) String URL to a colorised segmentation image

import type { Segment } from "../_lib/types";
import { fetchAsBase64 } from "../_providers/replicate";
import { extractMasksFromColorMap, type ColorMapObject } from "../_lib/colorMapToMasks";
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

export const mask2former: ModelDefinition = {
  key:           "mask2former",
  versionEnvKey: "MASK2FORMER_VERSION",
  replicateHint: "Search replicate.com for 'mask2former' — use the ADE20K panoptic variant",
  timeoutMs:     300_000, // 5 min — Mask2Former cold-starts are slow

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  async parseOutput(raw: unknown): Promise<Segment[]> {
    if (!raw) return [];

    // Format A: color-map — { objects: [{color:[r,g,b], label}], segment: url }
    // Returned by hassamdevsy/mask2former on Replicate.
    if (
      typeof raw === "object" &&
      raw !== null &&
      "objects" in raw &&
      "segment" in raw &&
      typeof (raw as Record<string, unknown>).segment === "string"
    ) {
      const m = raw as {
        objects: Array<{ color: number[]; label: string }>;
        segment: string;
      };

      console.log("[Mask2Former] Detected color-map format");
      console.log(`  Objects : ${m.objects.length}`);
      console.log(`  Labels  : ${m.objects.map((o) => o.label).join(", ")}`);

      // Download the colorised segmentation PNG
      const segB64  = await fetchAsBase64(m.segment);
      const pngBuf  = Buffer.from(segB64, "base64");
      console.log(`  Segment image: ${pngBuf.length.toLocaleString()} bytes`);

      const colorObjects: ColorMapObject[] = m.objects.map((o) => ({
        label: o.label,
        color: [(o.color[0] ?? 0), (o.color[1] ?? 0), (o.color[2] ?? 0)] as [number, number, number],
      }));

      const masks = extractMasksFromColorMap(pngBuf, colorObjects);

      for (const mk of masks) {
        console.log(`  ${mk.label}: ${mk.coveragePct}% coverage`);
      }

      // Drop segments with zero coverage (color not found in image)
      return masks
        .filter((mk) => mk.coveragePct > 0)
        .map((mk) => ({
          label:      mk.label,
          score:      1,
          maskBase64: mk.maskBase64,
        }));
    }

    // Format B: [{ label, score, mask }]
    if (Array.isArray(raw)) {
      return parseSegmentArray(
        raw as Array<{ label?: string; score?: number | null; mask?: string }>,
      );
    }

    // Format C: { segments: [...] }
    if (typeof raw === "object" && "segments" in (raw as object)) {
      const obj = raw as { segments: Array<{ label?: string; score?: number | null; mask?: string }> };
      return parseSegmentArray(obj.segments ?? []);
    }

    // Format D: URL to colorised image — returned as a single "segmentation map" segment
    if (typeof raw === "string" && raw.startsWith("http")) {
      const maskBase64 = await fetchAsBase64(raw);
      return [{ label: "segmentation map", score: null, maskBase64 }];
    }

    console.warn("[Mask2Former] Unrecognised output format:", typeof raw, JSON.stringify(raw).slice(0, 300));
    return [];
  },
};
