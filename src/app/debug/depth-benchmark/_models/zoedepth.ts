// ZoeDepth — zero-shot relative depth
//
// Replicate setup:
//   1. Search replicate.com for "zoedepth"
//      Recommended: "adirik/zoedepth" or "ktisha/zoedepth"
//   2. Copy the version hash
//   3. Add ZOEDEPTH_VERSION=<hash> to .env.local
//
// Expected input:  { image: "<data URL>" }
// Expected output:
//   a) String URL to depth PNG
//   b) Array with single URL
//   c) Object with depth key

import { fetchAsBase64 } from "../_providers/replicate";
import type { DepthModelDefinition } from "./index";

export const zoedepth: DepthModelDefinition = {
  key:           "zoedepth",
  versionEnvKey: "ZOEDEPTH_VERSION",
  replicateHint: "Search replicate.com for 'zoedepth'",
  timeoutMs:     180_000,

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  async parseOutput(raw: unknown): Promise<string | null> {
    // Format A: single URL
    if (typeof raw === "string" && raw.startsWith("http")) {
      return fetchAsBase64(raw);
    }

    // Format B: array
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
      const url = raw[0] as string;
      return url.startsWith("http") ? fetchAsBase64(url) : (url.split(",")[1] ?? null);
    }

    // Format C: object with depth key
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      for (const key of ["depth_map", "depth", "output", "image"]) {
        if (typeof o[key] === "string") {
          const url = o[key] as string;
          return url.startsWith("http") ? fetchAsBase64(url) : (url.split(",")[1] ?? null);
        }
      }
    }

    console.warn("[zoedepth] Unrecognised output:", JSON.stringify(raw).slice(0, 200));
    return null;
  },
};
