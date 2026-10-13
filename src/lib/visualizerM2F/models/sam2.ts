// SAM 2 — automatic mask generation (class-agnostic, edge-accurate segments)
//
// Mask2Former knows WHAT each region is but draws loose, wavy boundaries; SAM 2 has no
// labels but its segment edges follow the photo's real edges. The floor mask is snapped
// to SAM's segments in segmentVote.ts.
//
// Replicate setup:
//   1. Open replicate.com/meta/sam-2
//   2. Copy the version hash
//   3. Add SAM2_VERSION=<hash> to .env.local
//
// Output: { combined_mask: url, individual_masks: url[] } — one 8-bit grayscale PNG per segment.

import { fetchAsBase64 } from "../replicate";

export const sam2 = {
  key:           "sam-2",
  versionEnvKey: "SAM2_VERSION",
  replicateHint: "Copy the version hash from replicate.com/meta/sam-2",
  timeoutMs:     300_000,

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl, points_per_side: 32 };
  },

  /** Base64 PNG (no data: prefix) per segment. */
  async parseOutput(raw: unknown): Promise<string[]> {
    const urls = raw && typeof raw === "object" && Array.isArray((raw as { individual_masks?: unknown }).individual_masks)
      ? (raw as { individual_masks: unknown[] }).individual_masks.filter((u): u is string => typeof u === "string")
      : [];
    if (urls.length === 0) {
      console.warn("[sam2] parseOutput: no individual_masks in output:", JSON.stringify(raw).slice(0, 200));
    }
    return Promise.all(urls.map((u) => fetchAsBase64(u)));
  },
};
