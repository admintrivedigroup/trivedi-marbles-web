/**
 * Floor plane estimation for perspective-correct marble projection.
 *
 * Instead of full Hough Transform + Canny edges (complex, slow in browser),
 * we use the already-refined SAM floor mask and apply linear regression to
 * its left/right boundary rows.  For hallway / corridor / living-room shots
 * this gives accurate perspective lines without OpenCV.
 *
 * The output trapezoid is then:
 *   1. Rasterized and intersected with the SAM mask (removes wall noise).
 *   2. Used as the homography source quad for perspective tile projection.
 *   3. Checked for confidence — low-confidence triggers manual 4-point mode.
 */

import type { Pt, Quad } from "./perspective";

export type FloorPlaneResult = {
  trapezoid:      Quad;              // [TL, TR, BR, BL] in image coordinates
  vanishingPoint: Pt;                // where the left/right perspective lines meet
  horizonY:       number;            // y-coordinate of estimated horizon line
  confidence:     "high" | "low";   // "low" triggers manual 4-point fallback
};

/**
 * Estimate the floor plane from a refined binary floor mask (1 = floor).
 *
 * Prerequisites:
 *   – Mask must already be clipped above 40% height (no ceiling).
 *   – Mask must already be BFS-connected to the bottom edge.
 *
 * Returns confidence="low" when:
 *   – Regression lines are nearly parallel (no clear vanishing point).
 *   – Estimated vanishing point falls below the floor top (backwards perspective).
 *   – Fitted trapezoid is too narrow or too wide to be a real floor.
 */
export function estimateFloorTrapezoid(
  floorMask: Uint8Array,
  W: number,
  H: number,
): FloorPlaneResult {
  // ── 1. Build per-row left/right extents ───────────────────────────────────
  const rowLeft  = new Int32Array(H).fill(W);
  const rowRight = new Int32Array(H).fill(-1);
  let topRow = H, bottomRow = -1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (floorMask[y * W + x] === 1) {
        if (x < rowLeft[y])  rowLeft[y]  = x;
        if (x > rowRight[y]) rowRight[y] = x;
        if (y < topRow)   topRow    = y;
        bottomRow = y;
      }
    }
  }

  const FALLBACK: FloorPlaneResult = {
    trapezoid:      [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
    vanishingPoint: { x: W / 2, y: H / 2 },
    horizonY:       H / 2,
    confidence:     "low",
  };

  if (bottomRow < 0 || topRow >= bottomRow) return FALLBACK;

  const floorSpan = bottomRow - topRow;
  if (floorSpan < 20) return FALLBACK; // too thin to be meaningful

  // ── 2. Sample the middle band for regression (15%–80% of floor height) ───
  //   Skip the very top/bottom of the mask which are noisier.
  const fitStartY = Math.round(topRow  + floorSpan * 0.15);
  const fitEndY   = Math.round(topRow  + floorSpan * 0.80);

  const leftPts:  Array<[number, number]> = []; // [y, x] — fit x = a*y + b
  const rightPts: Array<[number, number]> = [];

  for (let y = fitStartY; y <= fitEndY; y++) {
    if (rowLeft[y]  < W)  leftPts.push([y, rowLeft[y]]);
    if (rowRight[y] >= 0) rightPts.push([y, rowRight[y]]);
  }

  if (leftPts.length < 5 || rightPts.length < 5) return FALLBACK;

  // ── 3. Linear regression: x = a*y + b ────────────────────────────────────
  const fitL = fitXofY(leftPts);
  const fitR = fitXofY(rightPts);

  // ── 4. Vanishing point = intersection of the two lines ───────────────────
  // fitL.a * y + fitL.b = fitR.a * y + fitR.b
  const dA = fitL.a - fitR.a;
  let vpY: number, vpX: number, confidence: "high" | "low";

  if (Math.abs(dA) < 0.005) {
    // Nearly parallel — no clear vanishing point (e.g., top-down view or huge flat room)
    vpY        = topRow - floorSpan * 0.5;
    vpX        = W / 2;
    confidence = "low";
  } else {
    vpY = (fitR.b - fitL.b) / dA;
    vpX = fitL.a * vpY + fitL.b;

    // Quality checks: VP should be above the floor top and roughly centered
    const vpAbove    = vpY < topRow;
    const vpCentered = vpX > W * 0.05 && vpX < W * 0.95;
    // Perspective ratio: far edge width vs near edge width should be < 80%
    const farW  = Math.abs((fitR.a * topRow    + fitR.b) - (fitL.a * topRow    + fitL.b));
    const nearW = Math.abs((fitR.a * bottomRow + fitR.b) - (fitL.a * bottomRow + fitL.b));
    const hasConvergence = nearW > 0 && farW / nearW < 0.85;

    confidence = vpAbove && vpCentered && hasConvergence ? "high" : "low";
  }

  // ── 5. Evaluate fitted lines at the top/bottom rows to get trapezoid ─────
  const tlX = clampX(Math.round(fitL.a * topRow    + fitL.b), W);
  const trX = clampX(Math.round(fitR.a * topRow    + fitR.b), W);
  const blX = clampX(Math.round(fitL.a * bottomRow + fitL.b), W);
  const brX = clampX(Math.round(fitR.a * bottomRow + fitR.b), W);

  // Ensure left < right at both ends
  const trapezoid: Quad = [
    { x: Math.min(tlX, trX), y: topRow    }, // TL
    { x: Math.max(tlX, trX), y: topRow    }, // TR
    { x: Math.max(blX, brX), y: bottomRow }, // BR
    { x: Math.min(blX, brX), y: bottomRow }, // BL
  ];

  // ── 6. Sanity-check the trapezoid dimensions ──────────────────────────────
  const trapW = trapezoid[3].x === trapezoid[2].x ? 0 :
    trapezoid[2].x - trapezoid[3].x;
  const trapWFrac = trapW / W;

  if (trapWFrac < 0.05 || trapWFrac > 0.99) {
    // Too narrow or nearly full-width
    return { ...FALLBACK, vanishingPoint: { x: vpX, y: vpY }, horizonY: vpY };
  }

  return {
    trapezoid,
    vanishingPoint: { x: vpX, y: vpY },
    horizonY: Math.max(0, Math.min(H, vpY)),
    confidence,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Least-squares fit of x = a * y + b from [y, x] point pairs. */
function fitXofY(points: Array<[number, number]>): { a: number; b: number } {
  const n = points.length;
  if (n < 2) return { a: 0, b: points[0]?.[1] ?? 0 };

  let sumY = 0, sumX = 0, sumYX = 0, sumY2 = 0;
  for (const [y, x] of points) {
    sumY += y; sumX += x; sumYX += y * x; sumY2 += y * y;
  }
  const denom = n * sumY2 - sumY * sumY;
  if (Math.abs(denom) < 1e-10) return { a: 0, b: sumX / n };
  const a = (n * sumYX - sumY * sumX) / denom;
  const b = (sumX - a * sumY) / n;
  return { a, b };
}

function clampX(x: number, W: number): number {
  return Math.max(0, Math.min(W - 1, x));
}
