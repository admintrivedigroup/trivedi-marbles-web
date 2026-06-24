/**
 * Deterministic floor texture renderer.
 * Implements the full pipeline from the spec:
 *
 *   Room Photo
 *     → SAM-2 Mask (raw)
 *     → Floor Plane Estimation (linear regression on mask edges)
 *     → Final Floor Mask (SAM component ∩ estimated trapezoid)
 *     → Perspective Warp (homography: trapezoid → tiled top-down texture)
 *     → Lighting Blend (multiply 0.7 + soft-light 0.3)
 *     → Composite (feather 2px inside, original pixels outside)
 *
 * Auto mode: runs the full pipeline automatically.
 *   – If confidence is "low" (low floor-plane estimation quality) OR
 *     refined mask coverage > 45 %, throws "NEEDS_MANUAL_FLOOR:" so the UI
 *     can switch to manual 4-point mode.
 *
 * Manual mode (manualQuad provided): uses the staff-supplied 4 corners.
 *   – Still intersects with the refined SAM mask for furniture preservation
 *     if the intersection covers ≥ 40 % of the quad area.
 *
 * Tile size:
 *   Default 1200 × 2400 mm per slab.  Pass tileWidthMm / tileHeightMm to
 *   change format (e.g. 800 × 800 for square tiles).  Tile count is computed
 *   from assumed floor dimensions (3.6 m wide × 6.0 m deep — typical room).
 *
 * No AI calls.  Changing the slab re-runs steps 4–7 only (mask is cached).
 */

import {
  computeHomography,
  applyH,
  rasterizeQuad,
  type Quad,
} from "./perspective";
import {
  loadImageFromUrl,
  loadImageFromDataUrl,
  loadImageFromFile,
  buildTiledTexture,
} from "./bookmatch";
import {
  extractBinaryMask,
  refineFloorMask,
  maskCoverage,
  upperHalfCoverage,
  erode1px,
  createFeatherMask,
  extractFloorLuminance,
  meanFloorLuminance,
} from "./maskUtils";
import { estimateFloorTrapezoid } from "./floorPlane";

// ─── Constants ────────────────────────────────────────────────────────────────

// Assumed visible floor dimensions for tile count calculation.
// Adjust if the showroom typically photographs wider/narrower spaces.
const ASSUMED_FLOOR_WIDTH_MM = 3600;
const ASSUMED_FLOOR_DEPTH_MM = 6000;

const TEXTURE_W = 2048;
const TEXTURE_H = 2048;
const GROUT_PX  = 3;

// ─── Public API ───────────────────────────────────────────────────────────────

export type RenderFloorParams = {
  roomPhotoFile:    File;
  alphaMaskDataUrl: string;       // alpha=0=floor, from buildAlphaMask
  slabImageUrl:     string;       // Cloudinary URL
  bookmatch:        boolean;
  imgWidth:         number;
  imgHeight:        number;
  /** Staff-selected 4 floor corners [TL, TR, BR, BL] in natural-photo coordinates. */
  manualQuad?:      Quad;
  /** Slab width in mm — default 1200 (large-format slab). */
  tileWidthMm?:     number;
  /** Slab height in mm — default 2400 (large-format slab). */
  tileHeightMm?:    number;
};

export type RenderFloorOutput = {
  dataUrl:         string;   // JPEG result at imgWidth × imgHeight
  floorQuad:       Quad;     // quad used for homography (cache for slab swaps)
  refinedCoverage: number;   // fraction of image textured (for debug)
  usedManualQuad:  boolean;  // whether the result used manual corners
};

/**
 * Render the floor with exact slab texture projected in perspective.
 *
 * Throws with message starting "NEEDS_MANUAL_FLOOR:" when auto-detection
 * is unreliable — the caller should switch to manual 4-point mode.
 */
export async function renderFloorLocally(
  params: RenderFloorParams,
): Promise<RenderFloorOutput> {
  const {
    roomPhotoFile,
    alphaMaskDataUrl,
    slabImageUrl,
    bookmatch,
    imgWidth: W,
    imgHeight: H,
    manualQuad,
    tileWidthMm  = 1200,
    tileHeightMm = 2400,
  } = params;

  // ── 1. Load images in parallel ─────────────────────────────────────────────
  const [roomImg, maskImg, slabImg] = await Promise.all([
    loadImageFromFile(roomPhotoFile),
    loadImageFromDataUrl(alphaMaskDataUrl),
    loadImageFromUrl(slabImageUrl),
  ]);

  const origData = readPixels(roomImg, W, H);
  const maskData = readPixels(maskImg, W, H);

  // ── 2. Extract raw SAM binary mask ─────────────────────────────────────────
  const rawMask = extractBinaryMask(maskData);

  // ── 3. Refine: clip above 40% + BFS from bottom ────────────────────────────
  const refinedMask = refineFloorMask(rawMask, W, H);

  // ── 4–6. Build render mask and floor quad ──────────────────────────────────
  let renderMask: Uint8Array;
  let floorQuad:  Quad;
  let usedManualQuad = false;

  if (manualQuad) {
    // ── Manual mode: staff-supplied 4 corners ────────────────────────────────
    usedManualQuad = true;
    floorQuad = manualQuad;

    const quadMask = rasterizeQuad(manualQuad, W, H);

    // Intersect with refined SAM mask to preserve furniture legs.
    // Fall back to raw quad if SAM mask covers < 40% of the quad area.
    let quadArea = 0, intersectCount = 0;
    const intersection = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (quadMask[i] === 1) {
        quadArea++;
        if (refinedMask[i] === 1) { intersection[i] = 1; intersectCount++; }
      }
    }
    renderMask = quadArea > 0 && intersectCount / quadArea >= 0.40
      ? intersection
      : quadMask;

  } else {
    // ── Auto mode ────────────────────────────────────────────────────────────

    // Safety: upper-half coverage > 8% means SAM included walls/ceiling
    const upCoverage = upperHalfCoverage(rawMask, W, H);
    if (upCoverage > 0.08) {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: SAM mask included walls or ceiling " +
        `(${Math.round(upCoverage * 100)}% of upper half). ` +
        "Please tap 4 floor corners to define the floor plane.",
      );
    }

    // Estimate floor plane trapezoid via linear regression on mask edges
    const plane = estimateFloorTrapezoid(refinedMask, W, H);

    if (plane.confidence === "low") {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: Could not reliably estimate the floor plane. " +
        "Please tap 4 floor corners.",
      );
    }

    // Intersect: SAM floor component ∩ estimated floor trapezoid
    // This removes wall-adjacent noise that BFS might have included (e.g.
    // doorway walls that physically touch the floor).
    const trapMask = rasterizeQuad(plane.trapezoid, W, H);
    const intersected = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      intersected[i] = refinedMask[i] === 1 && trapMask[i] === 1 ? 1 : 0;
    }

    // Final coverage check on intersected mask
    const coverage = maskCoverage(intersected);
    if (coverage < 0.01) {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: Refined floor mask is empty after trapezoid intersection. " +
        "Please tap 4 floor corners.",
      );
    }
    if (coverage > 0.45) {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: Floor detection still covers too much " +
        `(${Math.round(coverage * 100)}% of image). ` +
        "Please tap 4 floor corners.",
      );
    }

    renderMask = intersected;
    floorQuad  = plane.trapezoid; // regression-fitted trapezoid drives homography
  }

  // ── 7. Erode 1px inward — marble must not touch the exact boundary ─────────
  const erodedMask = erode1px(renderMask, W, H);

  // Feather the remaining 2px for a soft, seamless boundary
  const feather = createFeatherMask(erodedMask, W, H, 2);

  const refinedCoverage = maskCoverage(erodedMask);

  // ── 8. Build tiled texture in top-down space (mm dimensions) ───────────────
  const tilesX = Math.max(2, Math.round(ASSUMED_FLOOR_WIDTH_MM / tileWidthMm));
  const tilesY = Math.max(2, Math.round(ASSUMED_FLOOR_DEPTH_MM / tileHeightMm));

  const texture = buildTiledTexture(slabImg, TEXTURE_W, TEXTURE_H, {
    tilesX,
    tilesY,
    groutPx: GROUT_PX,
    bookmatch,
  });

  // ── 9. Compute homography: floor-quad (screen) → texture rect (top-down) ──
  const texQuad: Quad = [
    { x: 0,         y: 0         },
    { x: TEXTURE_W, y: 0         },
    { x: TEXTURE_W, y: TEXTURE_H },
    { x: 0,         y: TEXTURE_H },
  ];

  const H_mat = computeHomography(floorQuad, texQuad);
  if (!H_mat) {
    throw new Error(
      "Floor perspective estimation failed — detected quad is degenerate. " +
      "Try tapping a different floor spot.",
    );
  }

  // ── 10. Extract luminance from original floor pixels ───────────────────────
  const lumMap  = extractFloorLuminance(origData, erodedMask);
  const meanLum = meanFloorLuminance(lumMap, erodedMask);

  // ── 11. Warp, blend, and composite ────────────────────────────────────────
  const output = new Uint8ClampedArray(origData.data);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (erodedMask[idx] !== 1) continue;

      const alpha = feather[idx]; // 0..1 blend weight (1 = fully interior)
      if (alpha <= 0) continue;

      // Room pixel → texture UV via homography
      const { x: u, y: v } = applyH(H_mat, x, y);

      // Bilinear sample with modulo wrap for seamless tiling
      const [mr, mg, mb] = sampleBilinear(texture, TEXTURE_W, TEXTURE_H, u, v);

      // Lighting blend — preserve original floor shadows/gradients
      const pixelLum = lumMap[idx];
      const norm     = meanLum > 0 ? pixelLum / meanLum : 1;

      // Multiply component (0.7 weight) — preserves hard cast shadows
      const mFactor  = Math.max(0.20, 0.70 * norm + 0.30);

      // Soft-light component (0.3 weight) — lifts mid-tones, avoids crushed blacks
      const softR = softLight(mr / 255, origData.data[idx * 4]     / 255) * 255;
      const softG = softLight(mg / 255, origData.data[idx * 4 + 1] / 255) * 255;
      const softB = softLight(mb / 255, origData.data[idx * 4 + 2] / 255) * 255;

      const lr = Math.max(0, Math.min(255, Math.round(mr * mFactor * 0.7 + softR * 0.3)));
      const lg = Math.max(0, Math.min(255, Math.round(mg * mFactor * 0.7 + softG * 0.3)));
      const lb = Math.max(0, Math.min(255, Math.round(mb * mFactor * 0.7 + softB * 0.3)));

      const oi = idx * 4;
      if (alpha >= 1) {
        output[oi]     = lr;
        output[oi + 1] = lg;
        output[oi + 2] = lb;
        output[oi + 3] = 255;
      } else {
        // Blend with original at the feathered boundary
        output[oi]     = Math.round(origData.data[oi]     * (1 - alpha) + lr * alpha);
        output[oi + 1] = Math.round(origData.data[oi + 1] * (1 - alpha) + lg * alpha);
        output[oi + 2] = Math.round(origData.data[oi + 2] * (1 - alpha) + lb * alpha);
        output[oi + 3] = 255;
      }
    }
  }

  // ── 12. Write to canvas → JPEG data URL ───────────────────────────────────
  const outCanvas = makeCanvas(W, H);
  outCanvas.getContext("2d")!.putImageData(new ImageData(output, W, H), 0, 0);

  return {
    dataUrl: outCanvas.toDataURL("image/jpeg", 0.92),
    floorQuad,
    refinedCoverage,
    usedManualQuad,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function readPixels(img: HTMLImageElement, w: number, h: number): ImageData {
  const c = makeCanvas(w, h);
  c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, w, h);
  return c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
}

/** Bilinear sample with modulo wrap for seamless tiling. Returns [r, g, b]. */
function sampleBilinear(
  tex: ImageData,
  TW: number,
  TH: number,
  u: number,
  v: number,
): [number, number, number] {
  u = ((u % TW) + TW) % TW;
  v = ((v % TH) + TH) % TH;

  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = (x0 + 1) % TW, y1 = (y0 + 1) % TH;
  const fx  = u - x0, fy = v - y0;

  const p00 = (y0 * TW + x0) * 4;
  const p10 = (y0 * TW + x1) * 4;
  const p01 = (y1 * TW + x0) * 4;
  const p11 = (y1 * TW + x1) * 4;

  return [
    Math.round(blerp(tex.data[p00],   tex.data[p10],   tex.data[p01],   tex.data[p11],   fx, fy)),
    Math.round(blerp(tex.data[p00+1], tex.data[p10+1], tex.data[p01+1], tex.data[p11+1], fx, fy)),
    Math.round(blerp(tex.data[p00+2], tex.data[p10+2], tex.data[p01+2], tex.data[p11+2], fx, fy)),
  ];
}

function blerp(a: number, b: number, c: number, d: number, fx: number, fy: number): number {
  return a * (1-fx)*(1-fy) + b * fx*(1-fy) + c * (1-fx)*fy + d * fx*fy;
}

/**
 * Photoshop-style soft-light blend in linear 0..1 space.
 * `src` = marble colour, `dst` = original floor pixel colour.
 * Used to lift mid-tones and preserve color temperature without adding fake reflections.
 */
function softLight(src: number, dst: number): number {
  if (src <= 0.5) {
    return dst - (1 - 2 * src) * dst * (1 - dst);
  } else {
    const d = dst <= 0.25
      ? ((16 * dst - 12) * dst + 4) * dst
      : Math.sqrt(dst);
    return dst + (2 * src - 1) * (d - dst);
  }
}
