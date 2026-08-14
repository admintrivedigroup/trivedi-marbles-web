"use server";

import { requireUser } from "@/app/inventory/_lib/action-auth";

// SAM-2 version must match the one in visualize.ts
const SAM_VERSION =
  "cbd95fb76192174268b6b303aeeb7a736e8dab0cbc38177f09db79b2299da30b";
const POLL_INTERVAL_MS = 3500;
const POLL_MAX = 36; // ~2.1 min max per prediction

type StrategicPoint = {
  id: string;
  label: string;
  pctX: number;  // normalised [0,1]
  pctY: number;
};

// Four positions that cover typical room surfaces.
// Each maps to a SAM-2 point-prompt prediction running in parallel.
const STRATEGIC_POINTS: readonly StrategicPoint[] = [
  { id: "floor",      label: "Floor",      pctX: 0.50, pctY: 0.88 },
  { id: "back_wall",  label: "Back Wall",  pctX: 0.50, pctY: 0.28 },
  { id: "left_wall",  label: "Left Wall",  pctX: 0.10, pctY: 0.50 },
  { id: "right_wall", label: "Right Wall", pctX: 0.90, pctY: 0.50 },
];

export type RawSurfaceMask = {
  id:            string;
  label:         string;
  tapPctX:       number;
  tapPctY:       number;
  rawMaskBase64: string | null;
  error:         string | null;
};

export type DiscoveryResult = {
  masks: RawSurfaceMask[];
  error: string | null;
};

type RepPred = {
  id:      string;
  status:  "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: { combined_mask?: string; individual_masks?: string[] } | string | null;
  error?:  string | null;
};

async function queueSam2(
  token: string, dataUrl: string, px: number, py: number,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: SAM_VERSION,
        input: {
          image:        dataUrl,
          point_coords: `[${px},${py}]`,
          point_labels: "1",
        },
      }),
    });
    if (!res.ok) return null;
    const pred = (await res.json()) as RepPred;
    return pred.id ?? null;
  } catch {
    return null;
  }
}

async function fetchMask(predId: string, token: string): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(
        `https://api.replicate.com/v1/predictions/${predId}`,
        { headers },
      );
      if (!res.ok) return null;
      const pred = (await res.json()) as RepPred;
      if (pred.status === "failed" || pred.status === "canceled") return null;
      if (pred.status !== "succeeded") continue;

      const out = pred.output;
      let maskUrl: string | null = null;
      if (typeof out === "string") {
        maskUrl = out;
      } else if (out && typeof out === "object") {
        const o = out as { combined_mask?: string; individual_masks?: string[] };
        maskUrl = o.combined_mask ?? o.individual_masks?.[0] ?? null;
      }
      if (!maskUrl) return null;

      const maskRes = await fetch(maskUrl);
      if (!maskRes.ok) return null;
      const buf = await maskRes.arrayBuffer();
      return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      return null;
    }
  }
  return null;
}

export async function discoverSurfaces(formData: FormData): Promise<DiscoveryResult> {
  const auth = await requireUser();
  if (!auth.ok) return { masks: [], error: auth.error };

  const photo         = formData.get("photo") as File | null;
  const naturalWidth  = Number(formData.get("naturalWidth"))  || 1024;
  const naturalHeight = Number(formData.get("naturalHeight")) || 768;
  const token         = process.env.REPLICATE_API_TOKEN ?? "";

  if (!photo) return { masks: [], error: "No photo provided." };
  if (!token) return { masks: [], error: "REPLICATE_API_TOKEN not configured." };

  const buf     = await photo.arrayBuffer();
  const b64     = Buffer.from(buf).toString("base64");
  const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

  // Queue all four SAM-2 predictions simultaneously
  const predIds = await Promise.all(
    STRATEGIC_POINTS.map((pt) =>
      queueSam2(
        token, dataUrl,
        Math.round(pt.pctX * naturalWidth),
        Math.round(pt.pctY * naturalHeight),
      )
    )
  );

  // Poll all in parallel — each resolves independently (non-fatal failures)
  const masks = await Promise.all(
    STRATEGIC_POINTS.map(async (pt, i): Promise<RawSurfaceMask> => {
      const predId = predIds[i];
      if (!predId) {
        return {
          id: pt.id, label: pt.label,
          tapPctX: pt.pctX, tapPctY: pt.pctY,
          rawMaskBase64: null,
          error: "Failed to start detection.",
        };
      }
      const mask = await fetchMask(predId, token);
      return {
        id:            pt.id,
        label:         pt.label,
        tapPctX:       pt.pctX,
        tapPctY:       pt.pctY,
        rawMaskBase64: mask,
        error:         mask ? null : "Surface not detected at this position.",
      };
    })
  );

  return { masks, error: null };
}
