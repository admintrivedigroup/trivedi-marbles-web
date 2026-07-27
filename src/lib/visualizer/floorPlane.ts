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
 *
 * Three-pass detection in renderFloorTexture:
 *   Pass 1 — standard band (fitStartFrac=0.15, fitEndFrac=0.80)
 *   Pass 2 — wider band  (fitStartFrac=0.05, fitEndFrac=0.95)
 *   Pass 3 — floorBoundingBox fallback (always high-confidence, less accurate VP)
 */

import type { Pt, Quad } from "./perspective";

export type FloorPlaneResult = {
  trapezoid:      Quad;              // [TL, TR, BR, BL] in image coordinates
  vanishingPoint: Pt;                // where the left/right perspective lines meet
  horizonY:       number;            // y-coordinate of estimated horizon line
  confidence:     "high" | "low";   // "low" triggers the next pass
};

/**
 * Estimate the floor plane from a refined binary floor mask (1 = floor).
 *
 * Prerequisites:
 *   – Mask must already be clipped above 40% height (no ceiling).
 *   – Mask must already be BFS-connected to the bottom edge.
 *
 * @param fitStartFrac  Fraction from top of floor span to start regression (default 0.15).
 * @param fitEndFrac    Fraction from top of floor span to end regression   (default 0.80).
 *
 * Returns confidence="low" when:
 *   – Regression lines are nearly parallel AND row extents are degenerate.
 *   – Estimated vanishing point falls below the floor top (backwards perspective).
 *   – Fitted trapezoid is too narrow or too wide to be a real floor.
 */
export function estimateFloorTrapezoid(
  floorMask:   Uint8Array,
  W:           number,
  H:           number,
  fitStartFrac = 0.15,
  fitEndFrac   = 0.80,
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
  if (floorSpan < 20) return FALLBACK;

  // ── 2. Sample the fitting band ────────────────────────────────────────────
  const fitStartY = Math.round(topRow + floorSpan * fitStartFrac);
  const fitEndY   = Math.round(topRow + floorSpan * fitEndFrac);

  const leftPts:  Array<[number, number]> = [];
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
  const dA = fitL.a - fitR.a;
  let vpY: number, vpX: number, confidence: "high" | "low";

  if (Math.abs(dA) < 0.005) {
    // Nearly parallel — head-on or low-angle camera.
    // Use the actual row extents at the far and near edges — this IS the correct
    // geometry for a near-orthographic view; no regression fitting needed.
    const tlX = clampX(rowLeft[topRow],     W);
    const trX = clampX(rowRight[topRow],    W);
    const blX = clampX(rowLeft[bottomRow],  W);
    const brX = clampX(rowRight[bottomRow], W);

    const nearW = Math.abs(brX - blX);
    const farW  = Math.abs(trX - tlX);

    if (nearW > W * 0.04 && farW > W * 0.04) {
      return {
        trapezoid: [
          { x: Math.min(tlX, trX), y: topRow    },
          { x: Math.max(tlX, trX), y: topRow    },
          { x: Math.max(blX, brX), y: bottomRow },
          { x: Math.min(blX, brX), y: bottomRow },
        ],
        vanishingPoint: { x: W / 2, y: topRow - floorSpan },
        horizonY:       topRow,
        confidence:     "high",
      };
    }
    return { ...FALLBACK, vanishingPoint: { x: W / 2, y: topRow }, horizonY: topRow };
  }

  vpY = (fitR.b - fitL.b) / dA;
  vpX = fitL.a * vpY + fitL.b;

  const vpAbove    = vpY < topRow;
  const vpCentered = vpX > W * 0.05 && vpX < W * 0.95;
  const farW  = Math.abs((fitR.a * topRow    + fitR.b) - (fitL.a * topRow    + fitL.b));
  const nearW = Math.abs((fitR.a * bottomRow + fitR.b) - (fitL.a * bottomRow + fitL.b));
  // Relaxed from 0.85 → 0.98: handles wide shallow rooms and gentle perspective
  const hasConvergence = nearW > 0 && farW / nearW < 0.98;

  confidence = vpAbove && vpCentered && hasConvergence ? "high" : "low";

  // ── 5. Evaluate fitted lines at the top/bottom rows ──────────────────────
  const tlX = clampX(Math.round(fitL.a * topRow    + fitL.b), W);
  const trX = clampX(Math.round(fitR.a * topRow    + fitR.b), W);
  const blX = clampX(Math.round(fitL.a * bottomRow + fitL.b), W);
  const brX = clampX(Math.round(fitR.a * bottomRow + fitR.b), W);

  const trapezoid: Quad = [
    { x: Math.min(tlX, trX), y: topRow    },
    { x: Math.max(tlX, trX), y: topRow    },
    { x: Math.max(blX, brX), y: bottomRow },
    { x: Math.min(blX, brX), y: bottomRow },
  ];

  // ── 6. Sanity-check trapezoid width ───────────────────────────────────────
  const trapW     = trapezoid[2].x - trapezoid[3].x;
  const trapWFrac = trapW / W;
  if (trapWFrac < 0.05 || trapWFrac > 0.99) {
    return { ...FALLBACK, vanishingPoint: { x: vpX, y: vpY }, horizonY: vpY };
  }

  return {
    trapezoid,
    vanishingPoint: { x: vpX, y: vpY },
    horizonY: Math.max(0, Math.min(H, vpY)),
    confidence,
  };
}

/**
 * Bounding-box fallback: return the per-row extents at the top and bottom of
 * the floor mask as a trapezoid.  Used as Pass 3 when both regression passes
 * return low confidence.  Geometry is always valid; perspective accuracy is
 * lower than regression-fitted lines but the render will never be blank.
 */
export function floorBoundingBox(
  floorMask: Uint8Array,
  W: number,
  H: number,
): FloorPlaneResult {
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

  if (bottomRow < 0) {
    return {
      trapezoid:      [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
      vanishingPoint: { x: W / 2, y: H / 2 },
      horizonY:       H / 2,
      confidence:     "low",
    };
  }

  const tlX = rowLeft[topRow]     < W  ? rowLeft[topRow]     : 0;
  const trX = rowRight[topRow]    >= 0 ? rowRight[topRow]    : W;
  const blX = rowLeft[bottomRow]  < W  ? rowLeft[bottomRow]  : 0;
  const brX = rowRight[bottomRow] >= 0 ? rowRight[bottomRow] : W;

  return {
    trapezoid: [
      { x: Math.min(tlX, trX), y: topRow    },
      { x: Math.max(tlX, trX), y: topRow    },
      { x: Math.max(blX, brX), y: bottomRow },
      { x: Math.min(blX, brX), y: bottomRow },
    ],
    vanishingPoint: { x: W / 2, y: topRow },
    horizonY:       topRow,
    confidence:     "high",
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
