"use server";

/**
 * Depth Anything V2 — Phase 3 floor geometry.
 *
 * Generates a monocular depth map for the room photo.  The depth values are
 * used client-side to:
 *   • Validate that SAM floor pixels have a smooth depth gradient (floor = flat)
 *   • Reject wall patches (uniform depth, wrong vertical gradient)
 *   • Identify object boundaries (high depth gradient = furniture edge)
 *
 * Setup:
 *   1. Find the current version at replicate.com/depth-anything/depth-anything-v2
 *   2. Set DEPTH_ANYTHING_VERSION=<hash> in .env.local
 *   3. REPLICATE_API_TOKEN must already be set (used by SAM-2 and GDINO)
 *
 * Graceful degradation:
 *   If the env var is missing or the call fails, the result is { skipped: true }.
 *   The renderer falls back to the Phase 1+2 pipeline with no depth input.
 */

const DEPTH_VERSION    = process.env.DEPTH_ANYTHING_VERSION ?? "";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX         = 25;   // ~50 s — depth maps are faster than SAM

// ─── Types ────────────────────────────────────────────────────────────────────

export type DepthMapResult = {
  /** Base64 PNG data URL of the depth map at native model resolution. */
  depthDataUrl: string | null;
  error:        string | null;
  skipped:      boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type Prediction = {
  id:      string;
  status:  "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?:  string | null;
};

// Replicate free-tier rate limit is 6 req/min (~1 per 10 s). When 3 models
// fire simultaneously (SAM + DINO + Depth) we can get a 429 on depth.
// Retry twice: 15 s clears a 10-s window; 30 s handles a still-busy window.
const RATE_LIMIT_RETRY_DELAYS_MS = [15_000, 30_000];

async function createPredictionWithRetry(
  token:   string,
  payload: string,
): Promise<Response> {
  const init: RequestInit = {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    payload,
  };
  let res = await fetch("https://api.replicate.com/v1/predictions", init);
  for (const delay of RATE_LIMIT_RETRY_DELAYS_MS) {
    if (res.status !== 429) break;
    console.warn(`[getDepthMap] 429 rate-limited — retrying in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch("https://api.replicate.com/v1/predictions", init);
  }
  return res;
}

async function pollUntilDone(id: string): Promise<Prediction> {
  const headers = {
    Authorization:  `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers });
    if (!res.ok) continue;
    const p = (await res.json()) as Prediction;
    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") return p;
  }
  return { id, status: "failed", error: "timeout" };
}

/** Resolve the depth map URL from various output formats different model versions use.
 *  chenxwh/depth-anything-v2: { grey_depth, color_depth }
 *  Other models: string | string[] | { depth_map | depth | output | image }
 */
function resolveDepthUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0] as string;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    return (o.grey_depth ?? o.depth_map ?? o.depth ?? o.output ?? o.image ?? null) as string | null;
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getDepthMap(formData: FormData): Promise<DepthMapResult> {
  const photo = formData.get("photo") as File | null;

  if (!photo || !DEPTH_VERSION || !process.env.REPLICATE_API_TOKEN) {
    return { depthDataUrl: null, error: null, skipped: true };
  }

  try {
    const buf    = await photo.arrayBuffer();
    const b64    = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

    const createRes = await createPredictionWithRetry(
      process.env.REPLICATE_API_TOKEN!,
      JSON.stringify({
        version: DEPTH_VERSION,
        input:   { image: dataUrl, model_size: "Small" },
      }),
    );

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => createRes.statusText);
      console.error("[getDepthMap] create failed:", createRes.status, errText.slice(0, 300));
      return { depthDataUrl: null, error: `create ${createRes.status}: ${errText.slice(0, 120)}`, skipped: true };
    }

    const created = (await createRes.json()) as Prediction;
    console.log("[getDepthMap] prediction created:", created.id);
    const done    = await pollUntilDone(created.id);

    if (done.status !== "succeeded" || !done.output) {
      console.error("[getDepthMap] prediction failed:", done.status, done.error);
      return { depthDataUrl: null, error: `prediction ${done.status}: ${done.error ?? "no output"}`, skipped: true };
    }

    const depthUrl = resolveDepthUrl(done.output);
    if (!depthUrl) {
      console.error("[getDepthMap] unrecognised output format:", JSON.stringify(done.output).slice(0, 200));
      return { depthDataUrl: null, error: `unrecognised output: ${JSON.stringify(done.output).slice(0, 80)}`, skipped: true };
    }

    // Fetch the depth map server-side (avoids CORS on Replicate CDN URLs)
    const depthRes = await fetch(depthUrl);
    if (!depthRes.ok) return { depthDataUrl: null, error: `fetch depth ${depthRes.status}`, skipped: true };

    const buf2         = await depthRes.arrayBuffer();
    const b64depth     = Buffer.from(buf2).toString("base64");
    const contentType  = depthRes.headers.get("content-type") ?? "image/png";

    console.log("[getDepthMap] success, depth map size:", buf2.byteLength);
    return {
      depthDataUrl: `data:${contentType};base64,${b64depth}`,
      error:        null,
      skipped:      false,
    };
  } catch (e) {
    console.error("[getDepthMap] exception:", e);
    return { depthDataUrl: null, error: String(e), skipped: true };
  }
}
