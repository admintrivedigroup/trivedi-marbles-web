/**
 * Depth Anything V2 utilities — Phase 3 floor geometry.
 *
 * All functions run client-side (Canvas 2D API).
 * Accepts a depth map PNG (base64 data URL) returned by getDepthMap.ts
 * and converts it into a Uint8Array mask that is intersected with the SAM
 * floor mask inside renderFloorTexture.ts.
 *
 * Final floor mask formula (Phase 3):
 *   finalFloor = refinedSAMFloor ∩ trapezoidPlane ∩ depthConsistentRegion − occlusion
 *
 * Depth convention (Depth Anything V2):
 *   Bright (high value) = far from camera
 *   Dark  (low value)   = close to camera
 *   We only use gradient magnitudes, so the convention does not affect results.
 */

import { loadImageFromDataUrl } from "./bookmatch";

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Decode a grayscale depth PNG into a normalised Float32Array (0–1).
 * The depth image is bilinearly resampled to W×H via a Canvas 2D drawImage call.
 */
export async function parseDepthMap(
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
  const px    = ctx.getImageData(0, 0, W, H).data;
  const depth = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    // Depth map is grayscale: R, G, B are identical.  Use R channel.
    depth[i] = px[i * 4] / 255;
  }
  return depth;
}

// ─── Gradient computation ─────────────────────────────────────────────────────

/**
 * Compute Sobel gradient magnitude for each pixel.
 * Border pixels are left at 0.
 */
export function computeDepthGradient(
  depth: Float32Array,
  W:     number,
  H:     number,
): Float32Array {
  const grad = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx = depth[y * W + (x + 1)] - depth[y * W + (x - 1)];
      const gy = depth[(y + 1) * W + x] - depth[(y - 1) * W + x];
      grad[y * W + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return grad;
}

// ─── Floor validation ─────────────────────────────────────────────────────────

/**
 * Extract the depth-consistent subset of the SAM floor mask.
 *
 * Floor surface rules:
 *  1. Smooth depth gradient (low gradient = flat surface).
 *  2. High gradient pixels = furniture edges / stair risers → remove.
 *  3. Wall patches (same uniform depth across rows) are also cleaned
 *     by the SAM ∩ trapezoid step; depth helps at staircase tops.
 *
 * Adaptive threshold: pixels whose gradient is above
 *   min(peakFloorGrad * 0.65, meanFloorGrad * 2.5, 0.07)
 * are removed.  If depth filtering removes > 60% of the SAM floor pixels
 * (over-aggressive), the original mask is returned unchanged.
 */
export function extractDepthConsistentFloor(
  depth:       Float32Array,
  samFloorMask: Uint8Array,
  W:           number,
  H:           number,
): Uint8Array {
  const grad = computeDepthGradient(depth, W, H);

  // Collect gradient stats within the SAM floor region
  let sum = 0, count = 0, peak = 0;
  for (let i = 0; i < W * H; i++) {
    if (samFloorMask[i] !== 1) continue;
    sum   += grad[i];
    count++;
    if (grad[i] > peak) peak = grad[i];
  }

  // No floor pixels → nothing to filter
  if (count === 0) return new Uint8Array(samFloorMask);

  const mean      = sum / count;
  const threshold = Math.min(peak * 0.65, mean * 2.5, 0.07);

  const result = new Uint8Array(W * H);
  let kept = 0;
  for (let i = 0; i < W * H; i++) {
    if (samFloorMask[i] === 1 && grad[i] <= threshold) {
      result[i] = 1;
      kept++;
    }
  }

  // Safety fallback: if depth filtering removed too much, use original SAM mask
  if (kept < count * 0.4) return new Uint8Array(samFloorMask);

  return result;
}

// ─── Debug visualizations ─────────────────────────────────────────────────────

/**
 * Render the depth map as a false-colour PNG (viridis-like gradient).
 * Dark = close, light/green = mid, yellow = far.
 */
export function depthToColorDataUrl(
  depth: Float32Array,
  W:     number,
  H:     number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v  = depth[i]; // 0 = close/dark, 1 = far/bright
    // Simple viridis approximation: purple → blue → teal → green → yellow
    const r  = Math.round(Math.max(0, Math.min(255, 255 * (1.8 * v - 0.8))));
    const g  = Math.round(Math.max(0, Math.min(255, 255 * (1.6 * v - 0.1))));
    const b  = Math.round(Math.max(0, Math.min(255, 255 * (0.9 - 1.1 * v))));
    data.data[i * 4]     = r;
    data.data[i * 4 + 1] = g;
    data.data[i * 4 + 2] = b;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Render depth edges (pixels with gradient above threshold) as a white mask.
 * Useful for seeing where furniture/object boundaries are in the depth map.
 */
export function depthEdgesToDataUrl(
  depth:     Float32Array,
  W:         number,
  H:         number,
  threshold: number = 0.04,
): string {
  const grad   = computeDepthGradient(depth, W, H);
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const isEdge = grad[i] > threshold;
    data.data[i * 4]     = isEdge ? 255 : 0;
    data.data[i * 4 + 1] = isEdge ? 80  : 0;
    data.data[i * 4 + 2] = isEdge ? 0   : 0;
    data.data[i * 4 + 3] = isEdge ? 200 : 0;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Render the depth-consistent floor mask as a cyan semi-transparent PNG.
 */
export function depthFloorMaskToDataUrl(
  mask: Uint8Array,
  W:    number,
  H:    number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i] !== 1) continue;
    data.data[i * 4]     = 0;
    data.data[i * 4 + 1] = 220;
    data.data[i * 4 + 2] = 200;
    data.data[i * 4 + 3] = 160;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── Derived surface normals ──────────────────────────────────────────────────

/**
 * Compute per-pixel surface normals from a depth map using finite differences.
 *
 * This is a fallback for when SURFACE_NORMAL_VERSION is not configured.
 * Accuracy is lower than DSINE but sufficient to distinguish floor (large
 * vertical depth gradient) from walls/stair panels (near-zero vertical gradient).
 *
 * Output: Float32Array of length W*H*3 — (nx, ny, nz) per pixel, unit vectors.
 * Convention matches normalUtils.ts: ny < 0 means surface faces "upward" in
 * image space (i.e. is approximately horizontal — a floor).
 */
export function computeNormalsFromDepth(
  depth: Float32Array,
  W:     number,
  H:     number,
): Float32Array {
  const normals = new Float32Array(W * H * 3);

  // Scale derivatives so that a depth change of 1/(image-height) per pixel
  // produces a ~45° surface tilt. Without real camera intrinsics this is
  // approximate, but the adaptive classifier in buildHorizontalMask learns the
  // floor reference normal from SAM pixels, so absolute scale cancels out.
  const scaleX = W * 0.5;
  const scaleY = H * 0.5;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i  = y * W + x;
      const dx = (depth[i + 1] - depth[i - 1]) * scaleX;
      const dy = (depth[i + W] - depth[i - W]) * scaleY;
      // Surface tangent in x: (1, 0, dx); tangent in y: (0, 1, dy)
      // Normal = cross(tx, ty) = (-dx, -dy, 1)
      const nx  = -dx;
      const ny  = -dy;
      const nz  = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals[i * 3]     = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    }
  }

  return normals;
}
