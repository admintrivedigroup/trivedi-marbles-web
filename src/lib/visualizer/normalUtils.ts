/**
 * Surface normal utilities — Phase 4 floor/wall orientation.
 *
 * All functions run client-side (Canvas 2D API).
 *
 * Normal convention (standard RGB normal map encoding):
 *   R = (nx + 1) / 2 * 255 → nx = R/127.5 - 1
 *   G = (ny + 1) / 2 * 255 → ny = G/127.5 - 1
 *   B = (nz + 1) / 2 * 255 → nz = B/127.5 - 1
 *
 * Floor vs wall classification:
 *   Floor pixels in a typical room photo have normals pointing UP in world space.
 *   Wall and stair-riser pixels have normals pointing sideways or toward camera.
 *
 *   `buildHorizontalMask` (used in the renderer) is ADAPTIVE:
 *     1. Derives the floor normal reference from the SAM floor mask region
 *     2. Classifies all pixels by similarity to that reference (dot product)
 *     3. Falls back to no-op when fewer than 30% of SAM floor pixels pass
 *
 *   `buildHorizontalMaskFixed` (used for debug display only) applies a fixed
 *   absolute-value threshold on the ny channel — convention-agnostic for visual
 *   inspection without requiring a SAM mask.
 */

import { loadImageFromDataUrl } from "./bookmatch";

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Decode a standard RGB normal map PNG into a Float32Array.
 * Layout: interleaved [nx0, ny0, nz0, nx1, ny1, nz1, …], values -1 to +1.
 * The image is bilinearly resampled to W×H via Canvas 2D drawImage.
 */
export async function parseNormalMap(
  dataUrl: string,
  W:       number,
  H:       number,
): Promise<Float32Array> {
  const img    = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx    = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const px      = ctx.getImageData(0, 0, W, H).data;
  const normals = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    normals[i * 3]     = px[i * 4]     / 127.5 - 1; // nx
    normals[i * 3 + 1] = px[i * 4 + 1] / 127.5 - 1; // ny
    normals[i * 3 + 2] = px[i * 4 + 2] / 127.5 - 1; // nz
  }
  return normals;
}

// ─── Adaptive classifier (renderer-facing) ────────────────────────────────────

/**
 * Build a horizontal-surface mask that filters the `samFloorMask` by normal
 * orientation.  The floor normal reference is derived from the SAM floor region
 * itself so the classification adapts to the model's coordinate convention and
 * any camera tilt.
 *
 * Algorithm:
 *   1. Compute the mean unit normal across all SAM floor pixels.
 *   2. Accept pixels whose normal dot-products with that reference ≥ dotThreshold.
 *   3. Safety: if fewer than 30% of SAM floor pixels survive, return all-1s
 *      (disables normal filtering for this image — preserves Phase 1–3 results).
 */
export function buildHorizontalMask(
  normals:      Float32Array,
  samFloorMask: Uint8Array,
  W:            number,
  H:            number,
  dotThreshold: number = 0.50,
): { horizontalMask: Uint8Array; verticalMask: Uint8Array } {
  // Step 1: mean normal in SAM floor region
  let refNx = 0, refNy = 1, refNz = 0;
  let count  = 0;
  for (let i = 0; i < W * H; i++) {
    if (samFloorMask[i] !== 1) continue;
    refNx += normals[i * 3];
    refNy += normals[i * 3 + 1];
    refNz += normals[i * 3 + 2];
    count++;
  }
  if (count >= 20) {
    refNx /= count; refNy /= count; refNz /= count;
    const len = Math.sqrt(refNx * refNx + refNy * refNy + refNz * refNz);
    if (len > 0.01) { refNx /= len; refNy /= len; refNz /= len; }
    else             { refNx = 0;   refNy = 1;    refNz = 0;    }
  }
  // else: fewer than 20 SAM floor pixels — use Y-up default (0,1,0)

  // Step 2: classify
  const horizontalMask = new Uint8Array(W * H);
  const verticalMask   = new Uint8Array(W * H);

  for (let i = 0; i < W * H; i++) {
    const dot =
      normals[i * 3]     * refNx +
      normals[i * 3 + 1] * refNy +
      normals[i * 3 + 2] * refNz;
    if (dot >= dotThreshold) horizontalMask[i] = 1;
    else if (dot < 0.15)     verticalMask[i]   = 1;
  }

  // Step 3: safety fallback — revert if too aggressive
  if (count >= 20) {
    let kept = 0;
    for (let i = 0; i < W * H; i++) {
      if (samFloorMask[i] === 1 && horizontalMask[i] === 1) kept++;
    }
    if (kept < count * 0.30) {
      // Normal filtering removed too much — disable it for this render
      horizontalMask.fill(1);
      verticalMask.fill(0);
    }
  }

  return { horizontalMask, verticalMask };
}

// ─── Fixed classifier (debug display only) ───────────────────────────────────

/**
 * Classify pixels using a fixed |ny| threshold, without needing a SAM mask.
 * Used in the debug panel where the SAM floor mask isn't available as a
 * Uint8Array, and convention-agnostic (handles both Y-up and Y-down normals
 * because we threshold on the absolute value).
 */
export function buildHorizontalMaskFixed(
  normals: Float32Array,
  W:       number,
  H:       number,
): { horizontalMask: Uint8Array; verticalMask: Uint8Array } {
  const horizontalMask = new Uint8Array(W * H);
  const verticalMask   = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const absNy = Math.abs(normals[i * 3 + 1]);
    if (absNy > 0.50) horizontalMask[i] = 1;  // floor OR ceiling
    else if (absNy < 0.20) verticalMask[i] = 1; // wall, cabinet, stair riser
  }
  return { horizontalMask, verticalMask };
}

// ─── Debug visualizations ─────────────────────────────────────────────────────

/**
 * Render the normal map as a standard RGB-encoded PNG (nx→R, ny→G, nz→B).
 * In the debug panel, horizontal surfaces appear green-ish, walls appear red/blue.
 */
export function normalToColorDataUrl(
  normals: Float32Array,
  W:       number,
  H:       number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    data.data[i * 4]     = Math.round((normals[i * 3]     + 1) * 127.5); // R = nx
    data.data[i * 4 + 1] = Math.round((normals[i * 3 + 1] + 1) * 127.5); // G = ny
    data.data[i * 4 + 2] = Math.round((normals[i * 3 + 2] + 1) * 127.5); // B = nz
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Render a binary normal-classification mask as a coloured semi-transparent PNG.
 *   Green [0,200,80,160]  → horizontal (floor candidates)
 *   Red   [255,50,50,160] → vertical (walls, risers, cabinet sides)
 */
export function normalMaskToDataUrl(
  mask: Uint8Array,
  W:    number,
  H:    number,
  rgba: [number, number, number, number],
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i] !== 1) continue;
    data.data[i * 4]     = rgba[0];
    data.data[i * 4 + 1] = rgba[1];
    data.data[i * 4 + 2] = rgba[2];
    data.data[i * 4 + 3] = rgba[3];
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
