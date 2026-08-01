// Depth Anything V2 Large — monocular depth estimation
//
// Replicate setup:
//   1. Search replicate.com for "depth-anything-v2"
//      Recommended: "cbh123/depth-anything" or "adirik/depth-anything-v2-large"
//   2. Copy the version hash
//   3. Add DEPTH_ANYTHING_V2_VERSION=<hash> to .env.local
//
// Confirmed Replicate output format (object with two keys):
//   { "color_depth": "https://…/color.png", "grey_depth": "https://…/grey.png" }
//
// Fallback formats also handled:
//   a) String URL
//   b) Array of URL strings

import { fetchAsBase64 } from "../replicate";

// Returns a URL string from the raw output for the requested key or fallback.
function extractUrl(raw: unknown, preferred: string, fallbacks: string[] = []): string | null {
  if (typeof raw === "string" && (raw.startsWith("http") || raw.startsWith("data:"))) {
    return raw;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    return raw[0] as string;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const key of [preferred, ...fallbacks]) {
      if (typeof o[key] === "string") return o[key] as string;
    }
  }
  return null;
}

async function urlToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url.split(",")[1] ?? null;
  try { return await fetchAsBase64(url); }
  catch (e) { console.warn("[depthAnythingV2] fetchAsBase64 failed:", e); return null; }
}

export const depthAnythingV2 = {
  key:           "depth-anything-v2",
  versionEnvKey: "DEPTH_ANYTHING_V2_VERSION",
  replicateHint: "Search replicate.com for 'depth-anything-v2-large'",
  timeoutMs:     180_000,

  buildInput(imageDataUrl: string): Record<string, unknown> {
    return { image: imageDataUrl };
  },

  // Grey/raw depth — used for metrics computation and grayscale display.
  async parseOutput(raw: unknown): Promise<string | null> {
    const url = extractUrl(raw, "grey_depth", ["depth", "output"]);
    if (!url) {
      console.warn("[depthAnythingV2] parseOutput: no grey_depth in output:", JSON.stringify(raw).slice(0, 200));
      return null;
    }
    console.log("[depthAnythingV2] grey_depth URL:", url.slice(0, 80));
    return urlToBase64(url);
  },

  // Pre-rendered colour depth from Replicate — used for colour mode display.
  async parseColorOutput(raw: unknown): Promise<string | null> {
    const url = extractUrl(raw, "color_depth");
    if (!url) return null;
    console.log("[depthAnythingV2] color_depth URL:", url.slice(0, 80));
    return urlToBase64(url);
  },
};
