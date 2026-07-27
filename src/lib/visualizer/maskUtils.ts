/**
 * Mask preprocessing and luminance utilities for floor compositing.
 *
 * The SAM mask uses alpha=0 for the editable (floor) region and
 * alpha=255 for pixels to preserve.  All processing here is browser-only
 * Canvas 2D — no external libraries.
 */

// ─── Raw mask extraction ──────────────────────────────────────────────────────

/**
 * Convert raw mask ImageData (alpha=0=floor) to a binary Uint8Array
 * where 1 = floor pixel, 0 = preserve.
 */
export function extractBinaryMask(maskData: ImageData): Uint8Array {
  const n = maskData.width * maskData.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = maskData.data[i * 4 + 3] < 128 ? 1 : 0;
  }
  return out;
}

// ─── Floor mask refinement ────────────────────────────────────────────────────

/**
 * BFS from all floor pixels touching the bottom 5% of the image.
 * Discards wall/ceiling areas that are disconnected from the true floor.
 */
export function keepBottomConnectedFloor(
  mask: Uint8Array,
  W: number,
  H: number,
): Uint8Array {
  const visited = new Uint8Array(W * H);
  const queue: number[] = [];

  // Seed: all floor pixels in the bottom 5% of rows
  const seedY = Math.max(0, H - Math.ceil(H * 0.05));
  for (let y = seedY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] === 1 && !visited[i]) {
        visited[i] = 1;
        queue.push(i);
      }
    }
  }

  // 4-connected BFS
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % W;
    const y = (idx / W) | 0;
    const neighbors: number[] = [];
    if (y > 0)     neighbors.push(idx - W);
    if (y < H - 1) neighbors.push(idx + W);
    if (x > 0)     neighbors.push(idx - 1);
    if (x < W - 1) neighbors.push(idx + 1);
    for (const n of neighbors) {
      if (mask[n] === 1 && !visited[n]) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  return visited;
}

/**
 * Refine a raw SAM floor mask into a safe, floor-only region:
 *
 *   1. Fill interior holes via blur + threshold (so furniture openings in the
 *      floor mask don't create raw-floor patches showing through the marble).
 *   2. Zero out everything above 40% image height (eliminates ceiling / upper walls).
 *   3. BFS from the bottom edge — keeps only the connected floor region,
 *      discarding any wall/ceiling islands that SAM accidentally included.
 *
 * This is the primary fix for the "wallpaper" bug where marble covers the
 * whole image: the BFS ensures only pixels reachable from the actual floor
 * (near the camera at the bottom) are textured.
 */
export function refineFloorMask(
  rawBinary: Uint8Array,
  W: number,
  H: number,
): Uint8Array {
  // Step 1: fill interior holes via canvas blur + threshold
  const filled = fillHolesInMask(rawBinary, W, H);

  // Step 2: clip everything above 40% image height
  const horizonY = Math.round(H * 0.40);
  const clipped = new Uint8Array(filled.length);
  for (let y = horizonY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      clipped[y * W + x] = filled[y * W + x];
    }
  }

  // Step 3: keep only the bottom-connected component
  return keepBottomConnectedFloor(clipped, W, H);
}

/**
 * Blur + threshold to fill small interior holes in a binary mask.
 * Runs inside the browser using Canvas 2D filter.
 */
function fillHolesInMask(binary: Uint8Array, W: number, H: number): Uint8Array {
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tCtx = tmp.getContext("2d")!;

  // Write mask as alpha channel (floor pixel = alpha 0 = transparent)
  const imgData = tCtx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    imgData.data[i * 4 + 3] = binary[i] === 1 ? 0 : 255;
  }
  tCtx.putImageData(imgData, 0, 0);

  const blurred = document.createElement("canvas");
  blurred.width = W; blurred.height = H;
  const bCtx = blurred.getContext("2d")!;
  bCtx.filter = "blur(4px)";
  bCtx.drawImage(tmp, 0, 0);
  bCtx.filter = "none";

  const bData = bCtx.getImageData(0, 0, W, H);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    out[i] = bData.data[i * 4 + 3] < 80 ? 1 : 0;
  }
  return out;
}

// ─── Multi-pixel erosion ──────────────────────────────────────────────────────

/**
 * Erode a binary mask by `n` pixels (repeated 1px erosion).
 * Used for pre-connectivity erosion to sever thin baseboard connections between
 * the floor and adjacent vertical surfaces (stair panels, lower wall patches).
 *
 * Each pass is O(W*H).  n=8 runs in ~5 ms on a 1500×1000 mask.
 */
export function erodeNpx(mask: Uint8Array, W: number, H: number, n: number): Uint8Array {
  if (n <= 0) return mask;
  let current = mask;
  for (let i = 0; i < n; i++) current = erode1px(current, W, H);
  return current;
}

// ─── Connectivity filters ─────────────────────────────────────────────────────

/**
 * Return the subset of `mask` that is 4-connected to (seedX, seedY).
 * If the seed pixel is not in the mask, returns an empty mask.
 *
 * Used as the final anti-leakage step: since the user tapped a true floor pixel,
 * anything disconnected from that pixel is noise (wall patch, stair, etc.).
 */
export function floodFillFromPoint(
  mask:  Uint8Array,
  W:     number,
  H:     number,
  seedX: number,
  seedY: number,
): Uint8Array {
  const out = new Uint8Array(W * H);
  const si  = seedY * W + seedX;
  if (si < 0 || si >= W * H || mask[si] !== 1) return out;

  const visited = new Uint8Array(W * H);
  const queue: number[] = [si];
  visited[si] = 1;
  out[si]     = 1;

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x   = idx % W;
    const y   = (idx / W) | 0;

    if (y > 0)     { const n = idx - W; if (!visited[n] && mask[n] === 1) { visited[n] = 1; out[n] = 1; queue.push(n); } }
    if (y < H - 1) { const n = idx + W; if (!visited[n] && mask[n] === 1) { visited[n] = 1; out[n] = 1; queue.push(n); } }
    if (x > 0)     { const n = idx - 1; if (!visited[n] && mask[n] === 1) { visited[n] = 1; out[n] = 1; queue.push(n); } }
    if (x < W - 1) { const n = idx + 1; if (!visited[n] && mask[n] === 1) { visited[n] = 1; out[n] = 1; queue.push(n); } }
  }

  return out;
}

/**
 * Return only the largest 4-connected component of `mask`.
 * Used as a fallback when the tap pixel falls outside the filtered mask
 * (e.g. depth/normals removed the exact tap location).
 */
export function largestConnectedComponent(
  mask: Uint8Array,
  W:    number,
  H:    number,
): Uint8Array {
  const labels   = new Int32Array(W * H).fill(-1);
  const sizes:    number[]   = [];
  const starts:   number[]   = [];  // one seed index per component
  let   nextLabel = 0;

  for (let i = 0; i < W * H; i++) {
    if (mask[i] !== 1 || labels[i] >= 0) continue;

    const label = nextLabel++;
    sizes.push(0);
    starts.push(i);

    const queue: number[] = [i];
    labels[i] = label;
    let head   = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      sizes[label]++;
      const x   = idx % W;
      const y   = (idx / W) | 0;

      if (y > 0)     { const n = idx - W; if (mask[n] === 1 && labels[n] < 0) { labels[n] = label; queue.push(n); } }
      if (y < H - 1) { const n = idx + W; if (mask[n] === 1 && labels[n] < 0) { labels[n] = label; queue.push(n); } }
      if (x > 0)     { const n = idx - 1; if (mask[n] === 1 && labels[n] < 0) { labels[n] = label; queue.push(n); } }
      if (x < W - 1) { const n = idx + 1; if (mask[n] === 1 && labels[n] < 0) { labels[n] = label; queue.push(n); } }
    }
  }

  if (nextLabel === 0) return new Uint8Array(W * H); // empty mask

  let bestLabel = 0;
  for (let l = 1; l < nextLabel; l++) {
    if (sizes[l] > sizes[bestLabel]) bestLabel = l;
  }

  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (labels[i] === bestLabel) out[i] = 1;
  }
  return out;
}

// ─── Safety checks ────────────────────────────────────────────────────────────

/** Fraction of all pixels that are floor (0–1). */
export function maskCoverage(mask: Uint8Array): number {
  if (mask.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < mask.length; i++) sum += mask[i];
  return sum / mask.length;
}

/** Fraction of upper-half pixels that are floor.  > 8% suggests walls/ceiling contamination. */
export function upperHalfCoverage(mask: Uint8Array, W: number, H: number): number {
  const halfH = (H / 2) | 0;
  if (halfH === 0) return 0;
  let sum = 0;
  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < W; x++) sum += mask[y * W + x];
  }
  return sum / (W * halfH);
}

// ─── Edge erosion ─────────────────────────────────────────────────────────────

/**
 * Erode the binary mask by 1 pixel so marble never lands on the exact
 * boundary between floor and wall/furniture.
 */
export function erode1px(mask: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (
        mask[i]     === 1 &&
        mask[i - 1] === 1 &&
        mask[i + 1] === 1 &&
        mask[i - W] === 1 &&
        mask[i + W] === 1
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

// ─── Luminance extraction ─────────────────────────────────────────────────────

/**
 * Extract per-pixel luminance from the ORIGINAL room photo in the floor area.
 * Returns a Float32Array[W*H] with 0 for non-floor pixels.
 */
export function extractFloorLuminance(
  origData: ImageData,
  floorMask: Uint8Array,
): Float32Array {
  const lum = new Float32Array(origData.width * origData.height);
  for (let i = 0; i < lum.length; i++) {
    if (floorMask[i] !== 1) continue;
    const r = origData.data[i * 4];
    const g = origData.data[i * 4 + 1];
    const b = origData.data[i * 4 + 2];
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return lum;
}

/**
 * Compute mean luminance over the floor mask area.
 * Used to normalise the multiply-blend so the marble's overall brightness
 * matches the original floor's overall brightness.
 */
export function meanFloorLuminance(lum: Float32Array, mask: Uint8Array): number {
  let sum = 0, count = 0;
  for (let i = 0; i < lum.length; i++) {
    if (mask[i] === 1) { sum += lum[i]; count++; }
  }
  return count > 0 ? sum / count : 128;
}

/**
 * Apply room luminance to marble pixel data using a weighted multiply blend.
 * Preserves cast shadows from furniture and lighting gradients without
 * inventing reflections.
 *
 * formula:
 *   factor = lumBlend * (pixelLum / meanLum) + (1 - lumBlend)
 *   result = clamp(marble * factor, 0, 255)
 */
export function applyLuminanceBlend(
  marbleR: number,
  marbleG: number,
  marbleB: number,
  pixelLum: number,
  meanLum: number,
  lumBlend = 0.65,
): [number, number, number] {
  const norm   = meanLum > 0 ? pixelLum / meanLum : 1;
  // Clamp factor so extreme darks (deep shadows) don't turn marble black
  const factor = Math.max(0.25, lumBlend * norm + (1 - lumBlend));
  return [
    Math.max(0, Math.min(255, Math.round(marbleR * factor))),
    Math.max(0, Math.min(255, Math.round(marbleG * factor))),
    Math.max(0, Math.min(255, Math.round(marbleB * factor))),
  ];
}

// ─── Inner feathering ────────────────────────────────────────────────────────

/**
 * For each floor pixel, compute a blend weight based on distance to the nearest
 * non-floor pixel.  Returns a Float32Array where:
 *   - 1.0 → fully interior (use marble pixel)
 *   - 0.0 → outside floor mask
 *   - 0…1 → within `featherPx` of the boundary (blend marble with original)
 *
 * Feathering is INWARD ONLY: it never moves marble pixels outside the mask.
 * `featherPx = 2` is the recommended default per the spec.
 */
export function createFeatherMask(
  mask: Uint8Array,
  W: number,
  H: number,
  featherPx = 2,
): Float32Array {
  const feather = new Float32Array(mask.length);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] !== 1) continue;

      // Find minimum Euclidean distance to any non-floor pixel within range
      let minDist = featherPx + 1;
      const r = featherPx;
      outer:
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= H || nx < 0 || nx >= W) {
            // Image boundary counts as non-floor
            const d = Math.sqrt(dy * dy + dx * dx);
            if (d < minDist) minDist = d;
            if (minDist <= 1) break outer;
            continue;
          }
          if (mask[ny * W + nx] !== 1) {
            const d = Math.sqrt(dy * dy + dx * dx);
            if (d < minDist) minDist = d;
            if (minDist <= 1) break outer;
          }
        }
      }

      feather[i] = minDist >= featherPx ? 1.0 : minDist / featherPx;
    }
  }

  return feather;
}

// ─── Legacy export (used by compositeResult in wall/countertop path) ──────────

/**
 * @deprecated Use refineFloorMask for the floor path.
 * Kept for the compositeResult wall/countertop blur-mask compositing.
 */
export function preprocessMask(maskData: ImageData, W: number, H: number): Uint8Array {
  const tmp    = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  tmp.getContext("2d")!.putImageData(maskData, 0, 0);

  const blur   = document.createElement("canvas");
  blur.width = W; blur.height = H;
  const bCtx   = blur.getContext("2d")!;
  bCtx.filter  = "blur(6px)";
  bCtx.drawImage(tmp, 0, 0);
  bCtx.filter  = "none";

  const blurred = bCtx.getImageData(0, 0, W, H);
  const binary  = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    binary[i] = blurred.data[i * 4 + 3] < 80 ? 1 : 0;
  }
  return erode1px(binary, W, H);
}
