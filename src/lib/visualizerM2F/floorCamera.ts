// Pure math — no Canvas/DOM, so it runs in the browser and under Vitest.
//
// Recovers the floor's perspective from the room photo's straight lines instead of from
// the floor mask's outline. The mask outline is shaped by furniture and the photo border,
// not by perspective, so a quad fitted to it skews the homography (texture smears into
// streaks). Here the mask only decides the UV scale/origin; the camera decides the angle.
//
// Algorithm:
//   1. Sobel edges on a downscaled grayscale copy
//   2. Grow straight line segments from edge pixels that share a gradient direction
//   3. Vote for up to two vanishing points of horizontal scene lines (near-vertical
//      segments are dropped — they belong to the vertical vanishing point)
//   4. Camera: focal length from the two vanishing points when they are orthogonal-sane,
//      else a default; floor normal from both, else from a zero-roll assumption
//   5. Homography image → floor plane, then scale so the visible floor's lateral extent
//      is one UV unit (square in real floor space, so slabs keep their aspect ratio)

export type Pt = { x: number; y: number };
export type Quad = { tl: Pt; tr: Pt; br: Pt; bl: Pt };

export type FloorCameraResult = {
  /** Image px → UV, 8 values with the bottom-right fixed at 1 (same layout computeH returns). */
  h:      number[];
  /** Image-space outline of the UV unit square — debug overlay only. */
  quad:   Quad | null;
  source: "vanishing-points" | "fallback";
  /** Vanishing points found, image px. Empty for the fallback. */
  vanishingPoints: Pt[];
  focalPx: number;
  /** Real-world length of one UV unit, in multiples of the camera's height above the floor. */
  unitCameraHeights: number;
};

type Segment = { mx: number; my: number; tx: number; ty: number; len: number };
type Vec3 = [number, number, number];

const WORK_MAX_DIM      = 640;
const EDGE_THRESHOLD    = 40;                    // Sobel magnitude, 0..~1020
const GROW_TOLERANCE    = (22.5 * Math.PI) / 180;
const MIN_SEGMENT_FRAC  = 0.05;                  // of the working max dimension
const MAX_SEGMENT_WIDTH = 1.5;                   // px std-dev across the segment
const VERTICAL_CUTOFF   = Math.cos((15 * Math.PI) / 180);
const INLIER_SIN        = Math.sin((2 * Math.PI) / 180);
const MAX_PAIR_SEGMENTS = 120;
const DEFAULT_FOCAL     = 0.75;                  // × max(W, H)
const MIN_RAY_DOT       = 0.02;                  // ray·down below this is too close to the horizon

// ── Step 1+2: line segments ──────────────────────────────────────────────────

function toGray(px: Uint8ClampedArray, W: number, H: number, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  const sx = W / w, sy = H / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let sum = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < H; yy++) {
        for (let xx = x0; xx < x1 && xx < W; xx++) {
          const i = (yy * W + xx) * 4;
          sum += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
          n++;
        }
      }
      gray[y * w + x] = n ? sum / n : 0;
    }
  }
  return gray;
}

/** Straight segments in working-resolution pixel coordinates. */
function detectSegments(gray: Float32Array, w: number, h: number): Segment[] {
  const mag = new Float32Array(w * h);
  const ang = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = gray[i - w + 1]! + 2 * gray[i + 1]! + gray[i + w + 1]!
               - gray[i - w - 1]! - 2 * gray[i - 1]! - gray[i + w - 1]!;
      const gy = gray[i + w - 1]! + 2 * gray[i + w]! + gray[i + w + 1]!
               - gray[i - w - 1]! - 2 * gray[i - w]! - gray[i - w + 1]!;
      mag[i] = Math.hypot(gx, gy);
      ang[i] = Math.atan2(gy, gx);
    }
  }

  const minLen  = MIN_SEGMENT_FRAC * Math.max(w, h);
  const visited = new Uint8Array(w * h);
  const stack   = new Int32Array(w * h);
  const segments: Segment[] = [];

  for (let start = 0; start < w * h; start++) {
    if (visited[start] || mag[start]! < EDGE_THRESHOLD) continue;

    // Region grow: neighbours whose gradient direction matches the region's running mean.
    let sp = 0, n = 0;
    let sumCos = 0, sumSin = 0;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    stack[sp++] = start;
    visited[start] = 1;

    while (sp > 0) {
      const i = stack[--sp]!;
      const x = i % w, y = (i / w) | 0;
      n++;
      sumCos += Math.cos(ang[i]!); sumSin += Math.sin(ang[i]!);
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      const mean = Math.atan2(sumSin, sumCos);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
          const ni = ny * w + nx;
          if (visited[ni] || mag[ni]! < EDGE_THRESHOLD) continue;
          let d = Math.abs(ang[ni]! - mean);
          if (d > Math.PI) d = 2 * Math.PI - d;
          if (d > GROW_TOLERANCE) continue;
          visited[ni] = 1;
          stack[sp++] = ni;
        }
      }
    }

    if (n < minLen) continue;

    // PCA line fit: major axis = direction, minor eigenvalue = thickness.
    const mx = sx / n, my = sy / n;
    const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
    const tr = cxx + cyy;
    const disc = Math.sqrt(Math.max(0, (cxx - cyy) * (cxx - cyy) / 4 + cxy * cxy));
    const lMajor = tr / 2 + disc, lMinor = tr / 2 - disc;
    if (Math.sqrt(Math.max(0, lMinor)) > MAX_SEGMENT_WIDTH) continue;

    const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    // A uniform line of length L has variance L²/12 along its axis.
    const len = Math.sqrt(12 * Math.max(0, lMajor));
    if (len < minLen) continue;

    segments.push({ mx, my, tx: Math.cos(theta), ty: Math.sin(theta), len });
  }

  return segments;
}

// ── Step 3: vanishing points ─────────────────────────────────────────────────

/** Homogeneous line through a segment. */
function lineOf(s: Segment): Vec3 {
  // normal (−ty, tx), offset so that n·p + c = 0 at the midpoint
  return [-s.ty, s.tx, s.ty * s.mx - s.tx * s.my];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a: Vec3): Vec3 {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n > 1e-12 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0];
}

/** True when the segment points at the (possibly infinite) vanishing point. */
function pointsAt(s: Segment, vp: Vec3): boolean {
  const dx = vp[0] - s.mx * vp[2], dy = vp[1] - s.my * vp[2];
  const dn = Math.hypot(dx, dy);
  if (dn < 1e-9) return false;
  return Math.abs(s.tx * dy - s.ty * dx) / dn < INLIER_SIN;
}

function findVanishingPoint(segments: Segment[]): { vp: Vec3; inliers: Segment[]; score: number } | null {
  if (segments.length < 2) return null;
  const longest = [...segments].sort((a, b) => b.len - a.len).slice(0, MAX_PAIR_SEGMENTS);

  let best: Vec3 | null = null, bestScore = 0;
  for (let i = 0; i < longest.length; i++) {
    for (let j = i + 1; j < longest.length; j++) {
      const a = longest[i]!, b = longest[j]!;
      // Near-parallel, near-collinear pairs give an unstable intersection.
      if (Math.abs(a.tx * b.ty - a.ty * b.tx) < 0.02 && pointsAt(b, [a.mx, a.my, 1])) continue;
      const vp = cross(lineOf(a), lineOf(b));
      const scale = Math.hypot(vp[0], vp[1], vp[2]);
      if (scale < 1e-12) continue;
      const cand: Vec3 = [vp[0] / scale, vp[1] / scale, vp[2] / scale];

      let score = 0;
      for (const s of segments) if (pointsAt(s, cand)) score += s.len;
      if (score > bestScore) { bestScore = score; best = cand; }
    }
  }
  if (!best) return null;

  let inliers = segments.filter((s) => pointsAt(s, best!));

  // Least-squares refine for a finite point: minimise Σ len·(n·v + c)².
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const s of inliers) {
    const [nx, ny, c] = lineOf(s);
    a11 += s.len * nx * nx; a12 += s.len * nx * ny; a22 += s.len * ny * ny;
    b1  -= s.len * nx * c;  b2  -= s.len * ny * c;
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) > 1e-6 * (a11 + a22) * (a11 + a22)) {
    const refined: Vec3 = [(b1 * a22 - b2 * a12) / det, (a11 * b2 - a12 * b1) / det, 1];
    const refinedInliers = segments.filter((s) => pointsAt(s, refined));
    const refinedScore = refinedInliers.reduce((t, s) => t + s.len, 0);
    if (refinedScore >= bestScore) { best = refined; inliers = refinedInliers; bestScore = refinedScore; }
  }

  return { vp: best, inliers, score: bestScore };
}

// ── Step 4+5: camera → homography ────────────────────────────────────────────

function mul3(a: number[], b: number[]): number[] {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
}

/**
 * Builds the image → UV homography for a floor plane given its "down" normal and one
 * in-plane direction, both in camera coordinates (x right, y down, z forward).
 */
function homographyFromCamera(
  down: Vec3, inPlane: Vec3, f: number, cx: number, cy: number,
  mask: Uint8Array, W: number, H: number,
): { h: number[]; quad: Quad | null; unitCameraHeights: number } | null {
  // Orthonormal floor axes: `depth` is the in-plane axis facing most away from the camera.
  const e1 = normalize([
    inPlane[0] - dot(inPlane, down) * down[0],
    inPlane[1] - dot(inPlane, down) * down[1],
    inPlane[2] - dot(inPlane, down) * down[2],
  ]);
  if (Math.hypot(e1[0], e1[1], e1[2]) < 0.5) return null;
  const e2 = cross(down, e1);
  let depth: Vec3 = Math.abs(e1[2]) >= Math.abs(e2[2]) ? e1 : e2;
  if (depth[2] < 0) depth = [-depth[0], -depth[1], -depth[2]];
  const right = cross(down, depth);

  // Floor coordinates (a = right, b = depth) in units of camera height.
  const rayHit = (x: number, y: number): { a: number; b: number } | null => {
    const d: Vec3 = [(x - cx) / f, (y - cy) / f, 1];
    const dn = dot(d, down);
    if (dn < MIN_RAY_DOT * Math.hypot(d[0], d[1], 1)) return null;
    return { a: dot(d, right) / dn, b: dot(d, depth) / dn };
  };

  const stride = Math.max(1, Math.floor(Math.sqrt((W * H) / 20000)));
  const as: number[] = [], bs: number[] = [];
  let onMask = 0;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if ((mask[y * W + x] ?? 0) <= 128) continue;
      onMask++;
      const hit = rayHit(x, y);
      if (hit) { as.push(hit.a); bs.push(hit.b); }
    }
  }
  // The horizon must sit above the floor: nearly every floor pixel should hit the plane.
  if (onMask < 8 || as.length < 0.9 * onMask) return null;

  as.sort((p, q) => p - q);
  bs.sort((p, q) => p - q);
  const aMin = percentile(as, 0.05), aMax = percentile(as, 0.95);
  const bNear = percentile(bs, 0.02);
  const side = aMax - aMin;
  if (!(side > 1e-6)) return null;

  // Image → (a, b, w): rows of [right depth down]ᵀ · K⁻¹.
  const kInv = [1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1];
  const rot  = [...right, ...depth, ...down];
  const imgToFloor = mul3(rot, kInv);
  // (a, b) → UV: u grows right, v grows toward the camera, far edge of the unit square at v = 0.
  const floorToUv = [1 / side, 0, -aMin / side, 0, -1 / side, 1 + bNear / side, 0, 0, 1];
  const full = mul3(floorToUv, imgToFloor);
  if (Math.abs(full[8]!) < 1e-12) return null;
  const h = full.slice(0, 8).map((v) => v / full[8]!);

  const project = (u: number, v: number): Pt | null => {
    const a = aMin + u * side, b = bNear + (1 - v) * side;
    const p: Vec3 = [
      a * right[0] + b * depth[0] + down[0],
      a * right[1] + b * depth[1] + down[1],
      a * right[2] + b * depth[2] + down[2],
    ];
    if (p[2] < 1e-6) return null;
    return { x: cx + (f * p[0]) / p[2], y: cy + (f * p[1]) / p[2] };
  };
  const tl = project(0, 0), tr = project(1, 0), br = project(1, 1), bl = project(0, 1);
  const quad = tl && tr && br && bl ? { tl, tr, br, bl } : null;

  return { h, quad, unitCameraHeights: side };
}

/** Unit direction in camera coordinates for a vanishing point (image px, homogeneous). */
function vpDirection(vp: Vec3, f: number, cx: number, cy: number): Vec3 {
  return normalize([vp[0] - cx * vp[2], vp[1] - cy * vp[2], f * vp[2]]);
}

/** Floor "down" for a level (zero-roll) camera whose horizon passes through `dir`. */
function zeroRollDown(dir: Vec3): Vec3 {
  const down = normalize([0, dir[2], -dir[1]]);
  if (Math.hypot(down[0], down[1], down[2]) < 0.5) return [0, 1, 0];
  return down[1] < 0 ? [-down[0], -down[1], -down[2]] : down;
}

/**
 * @param px       RGBA pixels of the room photo, W×H
 * @param mask     floor mask, >128 = floor, W×H
 * @param occluder furniture mask, >128 = furniture, W×H. Lines on furniture are ignored:
 *                 a sofa or table set at an angle would otherwise pull the floor grid
 *                 toward its own edges instead of the room's walls.
 */
export function estimateFloorHomography(
  px: Uint8ClampedArray, mask: Uint8Array, W: number, H: number, occluder?: Uint8Array,
): FloorCameraResult | null {
  const cx = W / 2, cy = H / 2;
  const maxDim = Math.max(W, H);
  const defaultF = DEFAULT_FOCAL * maxDim;

  const scale = Math.min(1, WORK_MAX_DIM / maxDim);
  const w = Math.max(8, Math.round(W * scale)), h = Math.max(8, Math.round(H * scale));
  const toImg = W / w;
  const segments = detectSegments(toGray(px, W, H, w, h), w, h)
    .map((s) => ({ ...s, mx: s.mx * toImg, my: s.my * (H / h), len: s.len * toImg }))
    .filter((s) => Math.abs(s.ty) < VERTICAL_CUTOFF)
    .filter((s) => !occluder || (occluder[Math.round(s.my) * W + Math.round(s.mx)] ?? 0) <= 128);

  const first = findVanishingPoint(segments);
  if (first && first.inliers.length >= 3) {
    const rest   = segments.filter((s) => !first.inliers.includes(s));
    const second = findVanishingPoint(rest);

    let f = defaultF;
    let down: Vec3 | null = null;
    const vps: Vec3[] = [first.vp];

    if (second && second.inliers.length >= 3 && second.score >= 0.15 * first.score) {
      const d1 = vpDirection(first.vp, defaultF, cx, cy);
      const d2 = vpDirection(second.vp, defaultF, cx, cy);
      // Two distinct horizontal directions, not the same one found twice.
      if (Math.abs(dot(d1, d2)) < 0.5) {
        vps.push(second.vp);
        // A vanishing point many image-widths away is effectively at infinity: its exact
        // position is noise, so it cannot constrain the focal length.
        const near = (v: Vec3) =>
          Math.abs(v[2]) > 1e-9 && Math.hypot(v[0] / v[2] - cx, v[1] / v[2] - cy) < 8 * maxDim;
        if (near(first.vp) && near(second.vp)) {
          const f2 = -((first.vp[0] / first.vp[2] - cx) * (second.vp[0] / second.vp[2] - cx)
                     + (first.vp[1] / first.vp[2] - cy) * (second.vp[1] / second.vp[2] - cy));
          // 0.25 × the long side is wider than a phone's ultra-wide camera; 2.5 × is a long zoom.
          if (f2 > (0.25 * maxDim) ** 2 && f2 < (2.5 * maxDim) ** 2) f = Math.sqrt(f2);
        }
        const n = normalize(cross(vpDirection(first.vp, f, cx, cy), vpDirection(second.vp, f, cx, cy)));
        down = n[1] < 0 ? [-n[0], -n[1], -n[2]] : n;
      }
    }

    const dir = vpDirection(first.vp, f, cx, cy);
    const solved = homographyFromCamera(down ?? zeroRollDown(dir), dir, f, cx, cy, mask, W, H);
    if (solved) {
      return {
        ...solved,
        source: "vanishing-points",
        vanishingPoints: vps
          .filter((v) => Math.abs(v[2]) > 1e-9)
          .map((v) => ({ x: v[0] / v[2], y: v[1] / v[2] })),
        focalPx: f,
      };
    }
  }

  // Fallback: level camera looking straight down the room, horizon a little above the floor.
  let floorTop = H;
  for (let i = 0; i < W * H; i++) {
    if ((mask[i] ?? 0) > 128) { floorTop = (i / W) | 0; break; }
  }
  const horizonY = Math.min(cy, floorTop - 0.08 * H);
  const dir = normalize([0, horizonY - cy, defaultF]);
  const solved = homographyFromCamera(zeroRollDown(dir), dir, defaultF, cx, cy, mask, W, H);
  return solved ? { ...solved, source: "fallback", vanishingPoints: [], focalPx: defaultF } : null;
}
