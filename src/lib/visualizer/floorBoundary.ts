/**
 * Floor-wall boundary detection — Phase 4.5 anti-leakage.
 *
 * Uses depth-derived surface normals to compute a per-column upper boundary
 * of the floor zone.  Floor pixels face upward (large |ny|); walls and stair
 * panels are vertical (|ny| ≈ 0).
 *
 * Algorithm per column x:
 *   1. Scan from the bottom row (y = H-1) toward the top (y = 0).
 *   2. While |ny| > NY_THRESHOLD the pixel is floor-like → advance the boundary.
 *   3. Allow small gaps (≤ GAP_TOLERANCE rows) within the run to tolerate noise.
 *   4. Stop when a sustained non-floor zone longer than GAP_TOLERANCE is found.
 *   5. Record the topmost floor-like row reached before that stop as the boundary.
 *
 * The raw per-column boundary is smoothed with a sliding-window median to
 * remove single-column noise, then a small upward pad is added so the very
 * edge of the floor is included in the valid zone.
 *
 * The returned belowBoundaryMask is 1 for every pixel at or below the smoothed
 * boundary (the valid floor zone) and 0 above it.  Intersect this mask with the
 * depth/normal-filtered floor candidate before the trapezoid step.
 *
 * Safety: if the boundary filter would remove > 70 % of current floor pixels,
 * the caller should skip applying it (too aggressive).  The caller decides — this
 * module only produces the mask.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FloorBoundaryResult = {
  /** Per-column floor-wall boundary row (0 = top of image).  -1 = no floor found. */
  boundaryY: Int32Array;
  /** 1 = below or at the boundary (valid floor zone), 0 = above the boundary. */
  belowBoundaryMask: Uint8Array;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

/** |ny| above this → floor-like (horizontal surface). Floor ~0.99, walls ~0.0. */
const NY_THRESHOLD = 0.35;
/** Max consecutive non-floor rows allowed before treating as a genuine boundary. */
const GAP_FRACTION = 0.025; // 2.5 % of H
/** Half-width of the sliding-median smoothing window as fraction of W. */
const SMOOTH_WIN_FRACTION = 0.06;
/** Rows above the detected boundary to include in the valid zone (edge safety). */
const BOUNDARY_PAD_FRACTION = 0.010; // 1 % of H

// ─── Main export ───────────────────────────────────────────────────────────────

export function detectFloorWallBoundary(
  normals: Float32Array,
  W:       number,
  H:       number,
): FloorBoundaryResult {
  const gapTol  = Math.max(3, Math.round(H * GAP_FRACTION));
  const rawBound = new Int32Array(W).fill(H - 1);

  for (let x = 0; x < W; x++) {
    let topFloor = H - 1; // topmost floor-like row found while scanning upward
    let gap      = 0;     // consecutive non-floor rows since last floor pixel

    for (let y = H - 1; y >= 0; y--) {
      const absNy = Math.abs(normals[(y * W + x) * 3 + 1]);
      if (absNy > NY_THRESHOLD) {
        topFloor = y; // extend the floor zone upward
        gap      = 0;
      } else {
        gap++;
        if (gap > gapTol) break; // sustained non-floor zone → stop here
      }
    }

    rawBound[x] = topFloor;
  }

  // Sliding-median smoothing over ±half columns
  const half     = Math.max(5, Math.round(W * SMOOTH_WIN_FRACTION));
  const smoothed = new Int32Array(W);
  const buf: number[] = [];
  for (let x = 0; x < W; x++) {
    buf.length = 0;
    for (let dx = -half; dx <= half; dx++) {
      buf.push(rawBound[Math.max(0, Math.min(W - 1, x + dx))]);
    }
    buf.sort((a, b) => a - b);
    smoothed[x] = buf[buf.length >> 1];
  }

  // Build below-boundary mask with upward pad
  const pad               = Math.max(4, Math.round(H * BOUNDARY_PAD_FRACTION));
  const belowBoundaryMask = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const limit = Math.max(0, smoothed[x] - pad);
    for (let y = limit; y < H; y++) {
      belowBoundaryMask[y * W + x] = 1;
    }
  }

  return { boundaryY: smoothed, belowBoundaryMask };
}

// ─── Debug visualization ───────────────────────────────────────────────────────

/**
 * Render the floor-wall boundary as a yellow polyline on a transparent canvas.
 * Overlay on the room photo to see where the floor zone ends per column.
 */
export function boundaryToDataUrl(
  boundaryY: Int32Array,
  W:         number,
  H:         number,
): string {
  const canvas    = document.createElement("canvas");
  canvas.width    = W;
  canvas.height   = H;
  const ctx       = canvas.getContext("2d")!;

  ctx.strokeStyle = "rgba(255, 220, 0, 0.95)";
  ctx.lineWidth   = Math.max(2, Math.round(W / 350));
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur  = 3;

  ctx.beginPath();
  let started = false;
  for (let x = 0; x < W; x++) {
    const y = boundaryY[x];
    if (y < 0 || y >= H) { started = false; continue; }
    if (!started) { ctx.moveTo(x, y); started = true; }
    else            ctx.lineTo(x, y);
  }
  ctx.stroke();

  return canvas.toDataURL("image/png");
}
