/**
 * Perspective / homography utilities for floor texture projection.
 *
 * A 3×3 homography maps one quadrilateral to another, giving true
 * perspective-correct tiling (grout lines converge to the vanishing point).
 * All math runs in the browser — no external dependencies.
 */

export type Pt = { x: number; y: number };
/** [topLeft, topRight, bottomRight, bottomLeft] */
export type Quad = [Pt, Pt, Pt, Pt];

// ─── Gaussian elimination (8×8) ──────────────────────────────────────────────

function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let c = 0; c < n; c++) {
    let maxRow = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(M[r][c]) > Math.abs(M[maxRow][c])) maxRow = r;
    }
    [M[c], M[maxRow]] = [M[maxRow], M[c]];
    if (Math.abs(M[c][c]) < 1e-10) return null;

    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }

  return M.map((row, i) => row[n] / row[i]);
}

// ─── Homography ───────────────────────────────────────────────────────────────

/**
 * Compute the 3×3 homography H (returned as flat 9-element row-major array)
 * that maps each src[i] → dst[i] exactly.
 *
 * H[8] is normalised to 1.  Returns null if the system is degenerate.
 */
export function computeHomography(src: Quad, dst: Quad): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y;
    const dx = dst[i].x, dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = gaussSolve(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Apply homography H to point (x, y) → returns destination (u, v).
 */
export function applyH(H: number[], x: number, y: number): Pt {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-10) return { x: 0, y: 0 };
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

// ─── Floor quad detection ────────────────────────────────────────────────────

/**
 * Given a REFINED binary floor mask (1 = floor, 0 = preserve), find the
 * four corner points of the floor quadrilateral:
 *   [topLeft, topRight, bottomRight, bottomLeft]
 *
 * "Top" = far end (small in perspective). "Bottom" = near camera (large).
 */
export function detectFloorQuad(mask: Uint8Array, W: number, H: number): Quad {
  const rowLeft  = new Int32Array(H).fill(W);
  const rowRight = new Int32Array(H).fill(-1);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] === 1) {
        if (x < rowLeft[y])  rowLeft[y]  = x;
        if (x > rowRight[y]) rowRight[y] = x;
      }
    }
  }

  let topRow = H, bottomRow = -1;
  for (let y = 0; y < H; y++) {
    if (rowRight[y] >= 0) {
      if (y < topRow)   topRow    = y;
      bottomRow = y;
    }
  }

  if (bottomRow < 0 || topRow >= bottomRow) {
    return [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  }

  const floorSpan = bottomRow - topRow;
  const btmBand   = Math.max(4, Math.round(floorSpan * 0.12));
  const topBand   = Math.max(4, Math.round(floorSpan * 0.18));

  let bl_x = W, bl_y = bottomRow, br_x = 0, br_y = bottomRow;
  for (let y = Math.max(topRow, bottomRow - btmBand); y <= bottomRow; y++) {
    if (rowRight[y] < 0) continue;
    if (rowLeft[y]  < bl_x) { bl_x = rowLeft[y];  bl_y = y; }
    if (rowRight[y] > br_x) { br_x = rowRight[y]; br_y = y; }
  }

  let tl_x = W, tl_y = topRow, tr_x = 0, tr_y = topRow;
  const topBandEnd = Math.min(bottomRow, topRow + topBand);
  for (let y = topRow; y <= topBandEnd; y++) {
    if (rowRight[y] < 0) continue;
    if (rowLeft[y]  < tl_x) { tl_x = rowLeft[y];  tl_y = y; }
    if (rowRight[y] > tr_x) { tr_x = rowRight[y]; tr_y = y; }
  }

  if (tl_x >= tr_x) { tl_x = Math.min(bl_x, W / 4 | 0); tr_x = Math.max(br_x, (W * 3 / 4) | 0); }
  if (bl_x >= br_x) { bl_x = 0; br_x = W; }

  return [
    { x: tl_x, y: tl_y },
    { x: tr_x, y: tr_y },
    { x: br_x, y: br_y },
    { x: bl_x, y: bl_y },
  ];
}

// ─── Quad rasterizer ──────────────────────────────────────────────────────────

/**
 * Scanline-fill the interior of a quadrilateral into a binary Uint8Array
 * (1 = inside, 0 = outside).  Used to convert a manually-selected 4-point
 * floor outline into a pixel mask.
 */
export function rasterizeQuad(quad: Quad, W: number, H: number): Uint8Array {
  const mask = new Uint8Array(W * H);
  const edges: [Pt, Pt][] = [
    [quad[0], quad[1]],
    [quad[1], quad[2]],
    [quad[2], quad[3]],
    [quad[3], quad[0]],
  ];

  const yMin = Math.max(0,     Math.floor(Math.min(...quad.map(p => p.y))));
  const yMax = Math.min(H - 1, Math.ceil (Math.max(...quad.map(p => p.y))));

  for (let y = yMin; y <= yMax; y++) {
    const xs: number[] = [];
    for (const [a, b] of edges) {
      const eMin = Math.min(a.y, b.y), eMax = Math.max(a.y, b.y);
      if (y < eMin || y > eMax || eMin === eMax) continue;
      const t = (y - a.y) / (b.y - a.y);
      xs.push(a.x + t * (b.x - a.x));
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const x0 = Math.max(0,     Math.ceil (xs[0]));
    const x1 = Math.min(W - 1, Math.floor(xs[xs.length - 1]));
    for (let x = x0; x <= x1; x++) mask[y * W + x] = 1;
  }

  return mask;
}
