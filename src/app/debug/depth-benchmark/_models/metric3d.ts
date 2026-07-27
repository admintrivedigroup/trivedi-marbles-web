// Metric3D v2 — zero-shot metric depth estimation
//
// Replicate setup:
//   1. Search replicate.com for "metric3d"
//      Recommended: "niqif/metric3d" or similar
//   2. Copy the version hash
//   3. Add METRIC3D_VERSION=<hash> to .env.local
//
// Expected input:  { image: "<data URL>" }
// Expected output (varies by Replicate variant):
//   a) String URL to depth map PNG
//   b) Object: { depth_map: url, ... }
//   c) Object: { output: url, ... }
//   d) Array of URLs

import { fetchAsBase64 } from "../_providers/replicate";
import type { DepthModelDefinition } from "./index";

export const metric3d: DepthModelDefinition = {
  key:           "metric3d",
  versionEnvKey: "METRIC3D_VERSION",
  replicateHint: "Search replicate.com for 'metric3d' — use a v2 variant",
  timeoutMs:     600_000,

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  async parseOutput(raw: unknown): Promise<string | null> {
    // Format A: single URL
    if (typeof raw === "string" && raw.startsWith("http")) {
      return fetchAsBase64(raw);
    }

    // Format B/C: object with well-known depth keys
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      for (const key of ["depth_map", "depth", "depth_image", "output", "result", "image"]) {
        if (typeof o[key] === "string") {
          const url = o[key] as string;
          return url.startsWith("http") ? fetchAsBase64(url) : (url.split(",")[1] ?? null);
        }
      }
    }

    // Format D: array — take the first URL
    if (Array.isArray(raw)) {
      const first = raw.find((v) => typeof v === "string");
      if (typeof first === "string") {
        return first.startsWith("http") ? fetchAsBase64(first) : (first.split(",")[1] ?? null);
      }
    }

    console.warn("[metric3d] Unrecognised output:", JSON.stringify(raw).slice(0, 200));
    return null;
  },
};
