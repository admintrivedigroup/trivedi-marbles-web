/**
 * Client-side surface candidate classifier.
 *
 * Takes raw SAM-2 masks from discoverSurfaces and produces classified,
 * deduplicated SurfaceCandidate objects with preview images for the UI.
 */

import type { BoundingBox } from "@/app/inventory/_actions/detectObjects";
import type { SurfaceType } from "@/app/inventory/_actions/visualize";
import type { RawSurfaceMask } from "@/app/inventory/_actions/discoverSurfaces";

export type SurfaceCandidateType =
  | "floor"
  | "wall_back"
  | "wall_left"
  | "wall_right"
  | "staircase"
  | "countertop"
  | "other";

export type SurfaceCandidate = {
  id:             string;
  type:           SurfaceCandidateType;
  label:          string;
  confidence:     number;   // 0–100
  coveragePct:    number;   // % of total image area
  previewDataUrl: string;   // small JPEG composite for the card UI
  rawMaskBase64:  string;
  tapPixelX:      number;
  tapPixelY:      number;
};

/** Maps candidate type to the SurfaceType expected by the renderer. */
export function toRenderSurfaceType(t: SurfaceCandidateType): SurfaceType {
  if (t === "floor")      return "floor";
  if (t === "countertop") return "countertop";
  return "wall";
}

// Colour tints used to highlight each surface type in card previews
const TYPE_COLORS: Record<SurfaceCandidateType, [number, number, number]> = {
  floor:     [ 79,  70, 229],  // indigo
  wall_back: [ 59, 130, 246],  // blue
  wall_left: [234,  88,  12],  // orange
  wall_right:[ 22, 163,  74],  // green
  staircase: [202, 138,   4],  // amber
  countertop:[219,  39, 119],  // pink
  other:     [107, 114, 128],  // gray
};

// ─── Mask decoding ────────────────────────────────────────────────────────────

async function parseMask(raw: string, W: number, H: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      const mask = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        mask[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 > 128 ? 1 : 0;
      }
      resolve(mask);
    };
    img.onerror = reject;
    img.src = raw;
  });
}

// ─── Geometric features ───────────────────────────────────────────────────────

type Features = {
  coverageFrac: number;
  centroidX:    number;  // 0–1
  centroidY:    number;  // 0–1
  minX: number; maxX: number;
  minY: number; maxY: number;
  widthSpan:    number;  // (maxX - minX) / W
  heightSpan:   number;  // (maxY - minY) / H
  bottomFrac:   number;  // fraction of mask pixels in the bottom 35% of image
  topFrac:      number;  // fraction of mask pixels in the top 35% of image
};

function computeFeatures(mask: Uint8Array, W: number, H: number): Features {
  let sumX = 0, sumY = 0, count = 0;
  let minX = W, maxX = 0, minY = H, maxY = 0;
  let bottomCount = 0, topCount = 0;
  const bottomY = Math.floor(H * 0.65);
  const topY    = Math.floor(H * 0.35);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      count++;
      sumX += x; sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (y >= bottomY) bottomCount++;
      if (y <= topY)    topCount++;
    }
  }

  if (count === 0) {
    return {
      coverageFrac: 0, centroidX: 0.5, centroidY: 0.5,
      minX: 0, maxX: 0, minY: 0, maxY: 0,
      widthSpan: 0, heightSpan: 0, bottomFrac: 0, topFrac: 0,
    };
  }

  return {
    coverageFrac: count / (W * H),
    centroidX:    sumX / count / W,
    centroidY:    sumY / count / H,
    minX, maxX, minY, maxY,
    widthSpan:    (maxX - minX) / W,
    heightSpan:   (maxY - minY) / H,
    bottomFrac:   bottomCount / count,
    topFrac:      topCount    / count,
  };
}

// ─── Classification ───────────────────────────────────────────────────────────

function classifyFromFeatures(
  feat:      Features,
  tapPctX:   number,
  tapPctY:   number,
  dinoBoxes: BoundingBox[],
): { type: SurfaceCandidateType; label: string; confidence: number } {
  if (feat.coverageFrac < 0.005) {
    return { type: "other", label: "Surface", confidence: 15 };
  }

  // Staircase: DINO detected stair elements overlapping this mask's bounding box
  const hasStair = dinoBoxes.some((b) => {
    if (b.category !== "stair") return false;
    const ox = Math.max(0, Math.min(b.x2, feat.maxX) - Math.max(b.x1, feat.minX));
    const oy = Math.max(0, Math.min(b.y2, feat.maxY) - Math.max(b.y1, feat.minY));
    const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
    return bArea > 0 && (ox * oy) / bArea > 0.25;
  });

  if (hasStair && feat.centroidY > 0.35) {
    return { type: "staircase", label: "Staircase", confidence: 75 };
  }

  // Floor signal: tap below 75% of image height, mask concentrated at bottom
  const floorScore =
    (tapPctY > 0.75 ? 50 : tapPctY > 0.60 ? 25 : 5) +
    (feat.bottomFrac > 0.45 ? 25 : feat.bottomFrac > 0.25 ? 12 : 0) +
    (feat.widthSpan  > 0.45 ? 15 : feat.widthSpan  > 0.25 ? 7  : 0) +
    (feat.centroidY  > 0.60 ? 10 : 0) +
    (feat.heightSpan < 0.55 ? 8  : 0);  // floor rarely fills full height

  // Wall signal: tap in upper half of image or on image sides
  const wallScore =
    (tapPctY < 0.45 ? 40 : tapPctY < 0.65 ? 20 : 5) +
    (tapPctX < 0.20 || tapPctX > 0.80 ? 20 : 10) +
    (feat.heightSpan > 0.50 ? 20 : feat.heightSpan > 0.30 ? 10 : 0) +
    (feat.topFrac    > 0.30 ? 15 : 0) +
    (feat.centroidY  < 0.55 ? 10 : 0);

  if (floorScore > wallScore) {
    return {
      type:       "floor",
      label:      "Floor",
      confidence: Math.min(95, Math.round(35 + floorScore * 0.55)),
    };
  }

  const wallType: SurfaceCandidateType =
    tapPctX < 0.30 ? "wall_left" :
    tapPctX > 0.70 ? "wall_right" :
    "wall_back";

  const wallLabel =
    tapPctX < 0.30 ? "Left Wall" :
    tapPctX > 0.70 ? "Right Wall" :
    "Back Wall";

  return {
    type:       wallType,
    label:      wallLabel,
    confidence: Math.min(90, Math.round(35 + wallScore * 0.50)),
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function iouOverlap(a: Uint8Array, b: Uint8Array, N: number): number {
  let inter = 0, ua = 0, ub = 0;
  for (let i = 0; i < N; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i])         ua++;
    if (b[i])         ub++;
  }
  const union = ua + ub - inter;
  return union > 0 ? inter / union : 0;
}

// ─── Preview image ────────────────────────────────────────────────────────────

async function makePreview(
  roomUrl:      string,
  rawMask:      string,
  W: number, H: number,
  color: [number, number, number],
): Promise<string> {
  const PW = 280;
  const PH = Math.round(H * PW / W);
  return new Promise((resolve) => {
    const room = new Image();
    const mask = new Image();
    let loaded = 0;
    const onLoad = () => {
      if (++loaded < 2) return;
      const c = document.createElement("canvas");
      c.width = PW; c.height = PH;
      const ctx = c.getContext("2d")!;

      ctx.drawImage(room, 0, 0, PW, PH);
      const roomPx = ctx.getImageData(0, 0, PW, PH);

      ctx.clearRect(0, 0, PW, PH);
      ctx.drawImage(mask, 0, 0, PW, PH);
      const maskPx = ctx.getImageData(0, 0, PW, PH);

      const out = ctx.createImageData(PW, PH);
      for (let i = 0; i < PW * PH; i++) {
        const on =
          (maskPx.data[i * 4] + maskPx.data[i * 4 + 1] + maskPx.data[i * 4 + 2]) / 3 > 128;
        if (on) {
          out.data[i * 4]     = Math.round(roomPx.data[i * 4]     * 0.50 + color[0] * 0.50);
          out.data[i * 4 + 1] = Math.round(roomPx.data[i * 4 + 1] * 0.50 + color[1] * 0.50);
          out.data[i * 4 + 2] = Math.round(roomPx.data[i * 4 + 2] * 0.50 + color[2] * 0.50);
        } else {
          out.data[i * 4]     = roomPx.data[i * 4];
          out.data[i * 4 + 1] = roomPx.data[i * 4 + 1];
          out.data[i * 4 + 2] = roomPx.data[i * 4 + 2];
        }
        out.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    const onError = () => resolve(roomUrl);
    room.onload = mask.onload = onLoad;
    room.onerror = mask.onerror = onError;
    room.src = roomUrl;
    mask.src = rawMask;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

const TYPE_ORDER: SurfaceCandidateType[] = [
  "floor", "wall_back", "wall_left", "wall_right", "staircase", "countertop", "other",
];

export async function buildSurfaceCandidates(
  rawMasks:  RawSurfaceMask[],
  roomUrl:   string,
  W: number, H: number,
  _depth:    Float32Array | null,  // reserved for future depth-based classification
  dinoBoxes: BoundingBox[],
): Promise<SurfaceCandidate[]> {
  // Parse all valid masks in parallel
  const parsed = await Promise.all(
    rawMasks.map((m) =>
      m.rawMaskBase64
        ? parseMask(m.rawMaskBase64, W, H).catch(() => null)
        : Promise.resolve(null)
    )
  );

  // Classify
  const candidates: (SurfaceCandidate & { mask: Uint8Array })[] = [];
  for (let i = 0; i < rawMasks.length; i++) {
    const m    = rawMasks[i];
    const mask = parsed[i];
    if (!mask || !m.rawMaskBase64) continue;

    const feat = computeFeatures(mask, W, H);
    if (feat.coverageFrac < 0.005) continue;   // < 0.5% of image — skip noise

    const { type, label, confidence } = classifyFromFeatures(feat, m.tapPctX, m.tapPctY, dinoBoxes);
    candidates.push({
      id:             m.id,
      type,
      label,
      confidence,
      coveragePct:    Math.round(feat.coverageFrac * 100),
      previewDataUrl: "",  // filled in below
      rawMaskBase64:  m.rawMaskBase64,
      tapPixelX:      Math.round(m.tapPctX * W),
      tapPixelY:      Math.round(m.tapPctY * H),
      mask,
    });
  }

  // Deduplicate: if two masks have IoU > 0.55, keep the higher confidence one
  const kept: typeof candidates = [];
  for (const c of candidates) {
    const dup = kept.find((k) => iouOverlap(k.mask, c.mask, W * H) > 0.55);
    if (dup) {
      if (c.confidence > dup.confidence) kept.splice(kept.indexOf(dup), 1, c);
    } else {
      kept.push(c);
    }
  }

  // Sort: floor first, then walls left→right, then others; ties by confidence desc
  kept.sort((a, b) => {
    const oa = TYPE_ORDER.indexOf(a.type);
    const ob = TYPE_ORDER.indexOf(b.type);
    return oa !== ob ? oa - ob : b.confidence - a.confidence;
  });

  // Build card previews in parallel
  const previews = await Promise.all(
    kept.map((c) => makePreview(roomUrl, c.rawMaskBase64, W, H, TYPE_COLORS[c.type]))
  );

  // Strip the internal mask buffer before returning
  return kept.map((c, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mask: _mask, ...rest } = c;
    return { ...rest, previewDataUrl: previews[i] };
  });
}
