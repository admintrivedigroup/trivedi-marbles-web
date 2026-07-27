"use server";

/**
 * Surface normal estimation — Phase 4 floor/wall orientation.
 *
 * Generates a surface normal map for the room photo.  The encoded normals are
 * decoded client-side and used to:
 *   • Confirm floor pixels face upward (horizontal normal)
 *   • Reject wall patches and stair risers (vertical normal)
 *   • Reject cabinet side panels (vertical normal)
 *
 * Normal map encoding (standard computer-graphics convention):
 *   R = (nx + 1) / 2 * 255   — left/right
 *   G = (ny + 1) / 2 * 255   — up/down
 *   B = (nz + 1) / 2 * 255   — depth
 *
 * Setup (optional — depth-derived normals are used as a fallback):
 *   When DEPTH_ANYTHING_VERSION is configured, the renderer automatically
 *   computes surface normals from the depth map (computeNormalsFromDepth).
 *   This is sufficient for most scenes.  Only configure this action if you
 *   need dedicated normal-estimation quality for difficult cases.
 *
 *   To add a dedicated normal estimator:
 *   1. Find a monocular normal estimator on Replicate that outputs an RGB
 *      normal map (standard nx→R, ny→G, nz→B encoding).
 *   2. Set SURFACE_NORMAL_VERSION=<version-hash> in .env.local.
 *   3. REPLICATE_API_TOKEN must already be set.
 *
 * Graceful degradation:
 *   Returns { skipped: true } when not configured or on any failure.
 *   The renderer continues with Phase 1–3 pipeline unchanged.
 */

const NORMAL_VERSION   = process.env.SURFACE_NORMAL_VERSION ?? "";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX         = 25;  // ~50 s

// ─── Types ────────────────────────────────────────────────────────────────────

export type SurfaceNormalResult = {
  /** Base64 PNG data URL of the RGB normal map at native model resolution. */
  normalDataUrl: string | null;
  error:         string | null;
  skipped:       boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Prediction = {
  id:      string;
  status:  "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?:  string | null;
};

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
    console.warn(`[getSurfaceNormals] 429 rate-limited — retrying in ${delay / 1000}s`);
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

/** Resolve the normal map URL from various output formats different model versions use. */
function resolveNormalUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0] as string;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    const v = o.normal_map ?? o.normals ?? o.output ?? o.image ?? o.normal ?? null;
    return v as string | null;
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getSurfaceNormals(formData: FormData): Promise<SurfaceNormalResult> {
  const photo = formData.get("photo") as File | null;

  if (!photo || !NORMAL_VERSION || !process.env.REPLICATE_API_TOKEN) {
    return { normalDataUrl: null, error: null, skipped: true };
  }

  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

    const createRes = await createPredictionWithRetry(
      process.env.REPLICATE_API_TOKEN!,
      JSON.stringify({ version: NORMAL_VERSION, input: { image: dataUrl } }),
    );

    if (!createRes.ok) return { normalDataUrl: null, error: null, skipped: true };

    const created = (await createRes.json()) as Prediction;
    const done    = await pollUntilDone(created.id);

    if (done.status !== "succeeded" || !done.output) {
      return { normalDataUrl: null, error: null, skipped: true };
    }

    const normalUrl = resolveNormalUrl(done.output);
    if (!normalUrl) return { normalDataUrl: null, error: null, skipped: true };

    // Fetch server-side to avoid CORS
    const normalRes = await fetch(normalUrl);
    if (!normalRes.ok) return { normalDataUrl: null, error: null, skipped: true };

    const buf2        = await normalRes.arrayBuffer();
    const b64normal   = Buffer.from(buf2).toString("base64");
    const contentType = normalRes.headers.get("content-type") ?? "image/png";

    return {
      normalDataUrl: `data:${contentType};base64,${b64normal}`,
      error:         null,
      skipped:       false,
    };
  } catch {
    return { normalDataUrl: null, error: null, skipped: true };
  }
}
