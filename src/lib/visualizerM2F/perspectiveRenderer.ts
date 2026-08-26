// Client-side only — Canvas API required.
//
// Split into a geometry stage and a texture stage so RoomCache (renderFromCache.ts) can
// cache the expensive half (mask decode/union, largest-CC, quad, homography) across slab
// swaps and texture-setting changes.
//
// Algorithm (unchanged):
//   1. Find the largest connected component of the floor mask (BFS)
//   2. Row-scan the CC to extract a perspective quadrilateral
//   3. Solve the 8-DOF homography (image pixels → normalised UV) via Gaussian elimination
//   4. For each floor pixel: map to UV, tile with scale/rotation, bilinear-sample the texture
//   5. Preserve occluder pixels on top
//   6. Build a debug overlay showing the CC tint, quad outline, and corner labels

import { decodeMask, unionMasks, loadImage } from "./maskUtils";
import type { RenderJob } from "./renderUtils";
import type { PipelineSegment, SlabSettings } from "./types";
import { DEFAULT_SLAB_SETTINGS } from "./types";

// ── Canvas helper ────────────────────────────────────────────────────────────

function newCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// ── Slab layout helpers ───────────────────────────────────────────────────────

type SlabCachedParams = {
  offsetU:    number;
  offsetV:    number;
  flipH:      boolean;
  flipV:      boolean;
  cosA:       number;
  sinA:       number;
  hasRot:     boolean;
  brightness: number;
};

// Mulberry32 PRNG seeded deterministically from (col, row).
function makeSlabRng(col: number, row: number): () => number {
  let seed = (((col * 2654435761) ^ (row * 1013904223)) ^ 0xDEADBEEF) >>> 0;
  return (): number => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// HSL → RGB. h ∈ [0,360], s/l ∈ [0,1].
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const ch = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [ch(0), ch(8), ch(4)];
}

// Distinct saturated color per slab — used by slab debug mode.
function slabDebugColor(col: number, row: number): [number, number, number] {
  const idx = (Math.abs(col) * 7 + Math.abs(row) * 13 + col * 3 + row * 17);
  return hslToRgb((idx * 137.508) % 360, 0.65, 0.55);
}

function computeSlabParams(col: number, row: number, randomize: boolean, bookmatch: boolean): SlabCachedParams {
  const rng = makeSlabRng(col, row);
  const r0 = rng(), r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng();

  if (bookmatch) {
    // Deterministic mirror by column parity — adjacent columns are horizontal
    // mirror images of each other, so veins meet symmetrically at each vertical
    // seam. Offset/rotation must stay off (any of it would throw the mirrored
    // veins out of alignment); brightness jitter alone can't break the mirror,
    // so it still honors randomize when both are on.
    const colParity = ((col % 2) + 2) % 2;
    return {
      offsetU:    0,
      offsetV:    0,
      flipH:      colParity === 1,
      flipV:      false,
      cosA:       1,
      sinA:       0,
      hasRot:     false,
      brightness: randomize ? 0.9 + r5 * 0.2 : 1.0,
    };
  }

  const rotDeg = randomize ? (r4 - 0.5) * 4 : 0;   // ±2°
  const angRad = rotDeg * Math.PI / 180;
  return {
    offsetU:    randomize ? r0 : 0,
    offsetV:    randomize ? r1 : 0,
    flipH:      randomize && r2 > 0.5,
    flipV:      randomize && r3 > 0.5,
    cosA:       Math.cos(angRad),
    sinA:       Math.sin(angRad),
    hasRot:     randomize && Math.abs(rotDeg) > 0.01,
    brightness: randomize ? 0.9 + r5 * 0.2 : 1.0,
  };
}

function getOrMakeSlabParams(
  col:      number,
  row:      number,
  randomize: boolean,
  bookmatch: boolean,
  cache:    Map<number, SlabCachedParams>,
): SlabCachedParams {
  const key  = ((col & 0x7FFF) | ((row & 0x7FFF) << 15)) >>> 0;
  const hit  = cache.get(key);
  if (hit) return hit;
  const p = computeSlabParams(col, row, randomize, bookmatch);
  cache.set(key, p);
  return p;
}

// Inverse homography: UV (u,v) → image pixel (x,y).
// hinv is the 9-element row-major result of invert3x3().
function applyHInv(hinv: number[], u: number, v: number): FloorPoint {
  const w = hinv[6]! * u + hinv[7]! * v + hinv[8]!;
  if (Math.abs(w) < 1e-8) return { x: 0, y: 0 };
  return {
    x: (hinv[0]! * u + hinv[1]! * v + hinv[2]!) / w,
    y: (hinv[3]! * u + hinv[4]! * v + hinv[5]!) / w,
  };
}

// ── Public types ─────────────────────────────────────────────────────────────

export type FloorPoint = { x: number; y: number };
export type FloorQuad  = { tl: FloorPoint; tr: FloorPoint; br: FloorPoint; bl: FloorPoint };

export type PerspectiveRenderResult = {
  compositeUrl: string;
  debugUrl:     string;
  quad:         FloorQuad | null;
};

/**
 * Everything derived from the room photo + Mask2Former masks, independent of
 * which slab texture or texture settings are chosen. Cache this once per
 * room/surface-selection and reuse across slab swaps and setting changes.
 */
export type FloorGeometry = {
  W: number;
  H: number;
  origPx:   Uint8ClampedArray;
  surfMask: Uint8Array;
  occMask:  Uint8Array;
  cc:       Uint8Array;
  quad:     FloorQuad | null;
  h:        number[] | null;
  debugUrl: string;
  /** Per-pixel multiplier (~1.0 mean) from blurred original-floor luminance — soft ambient shadow/gradient. */
  lowMul:    Float32Array;
  /** Per-pixel signed residual (orig luminance − blurred) — specular highlights / fine shadow detail. */
  highRes:   Float32Array;
  /** Per-pixel 0..1 feather alpha, 1 deep inside the floor mask, ramping to 0 at the mask edge. */
  edgeAlpha: Float32Array;
  /** Art-directed glossy highlight anchored near a detected light source — see computeSpecularHighlight. Null when no window/fixture segment is found. */
  specular: SpecularHighlight | null;
};

// ── Step 1: Largest connected component (BFS) ────────────────────────────────

function findLargestCC(mask: Uint8Array, W: number, H: number): Uint8Array {
  const n       = W * H;
  const visited = new Uint8Array(n);
  const queue   = new Int32Array(n); // ring buffer — large enough for a full image
  let   best: number[] = [];

  for (let start = 0; start < n; start++) {
    if ((mask[start] ?? 0) <= 128 || visited[start]) continue;

    const pixels: number[] = [];
    let head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const idx = queue[head++]!;
      pixels.push(idx);
      const px = idx % W;
      const py = (idx / W) | 0;

      if (px > 0)     { const ni = idx - 1; if ((mask[ni] ?? 0) > 128 && !visited[ni]) { visited[ni] = 1; queue[tail++] = ni; } }
      if (px < W - 1) { const ni = idx + 1; if ((mask[ni] ?? 0) > 128 && !visited[ni]) { visited[ni] = 1; queue[tail++] = ni; } }
      if (py > 0)     { const ni = idx - W; if ((mask[ni] ?? 0) > 128 && !visited[ni]) { visited[ni] = 1; queue[tail++] = ni; } }
      if (py < H - 1) { const ni = idx + W; if ((mask[ni] ?? 0) > 128 && !visited[ni]) { visited[ni] = 1; queue[tail++] = ni; } }
    }

    if (pixels.length > best.length) best = pixels;
  }

  const result = new Uint8Array(n);
  for (const i of best) result[i] = 255;
  return result;
}

// ── Step 2: Row-scan quadrilateral ───────────────────────────────────────────

function extractFloorQuad(cc: Uint8Array, W: number, H: number): FloorQuad | null {
  const rowLeft  = new Int32Array(H).fill(-1);
  const rowRight = new Int32Array(H).fill(-1);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((cc[y * W + x] ?? 0) > 128) {
        if (rowLeft[y] === -1) rowLeft[y] = x;
        rowRight[y] = x;
      }
    }
  }

  let yMin = H, yMax = -1;
  for (let y = 0; y < H; y++) {
    if (rowLeft[y] !== -1) {
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  if (yMax < 0 || yMax - yMin < 5) return null;

  const band = Math.max(2, Math.round((yMax - yMin) * 0.2));

  const rowMedian = (ys: number[], side: "left" | "right"): number => {
    const vals = ys
      .map((y) => (side === "left" ? rowLeft[y]! : rowRight[y]!))
      .filter((v) => v !== -1)
      .sort((a, b) => a - b);
    if (vals.length === 0) return side === "left" ? 0 : W - 1;
    return vals[Math.floor(vals.length / 2)]!;
  };

  const topYs = Array.from({ length: band }, (_, k) => yMin + k).filter((y) => y <= yMax);
  const botYs = Array.from({ length: band }, (_, k) => yMax - k).filter((y) => y >= yMin);

  return {
    tl: { x: rowMedian(topYs, "left"),  y: yMin },
    tr: { x: rowMedian(topYs, "right"), y: yMin },
    br: { x: rowMedian(botYs, "right"), y: yMax },
    bl: { x: rowMedian(botYs, "left"),  y: yMax },
  };
}

// ── 3×3 matrix inverse ────────────────────────────────────────────────────────
//
// H as stored: h = [h0,h1,h2, h3,h4,h5, h6,h7,h8] where h8 is NOT stored
// (we fix h22=1), so the 3×3 is:
//   [[h0, h1, h2],
//    [h3, h4, h5],
//    [h6, h7,  1]]
//
// Returns the 9 elements of H^-1 in row-major order (including the bottom-right 1/det term).

function invert3x3(h: number[]): number[] | null {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
  const a = h0!, b = h1!, c = h2!;
  const d = h3!, e = h4!, f = h5!;
  const g = h6!, hh = h7!, k = 1;   // k = h[8] fixed at 1

  const det = a * (e * k - f * hh) - b * (d * k - f * g) + c * (d * hh - e * g);
  if (Math.abs(det) < 1e-12) return null;

  // Adjugate (= transposed cofactors)
  const inv = [
    (e * k - f * hh) / det, // [0,0]
    -(b * k - c * hh) / det, // [0,1]
    (b * f - c * e) / det,   // [0,2]
    -(d * k - f * g) / det,  // [1,0]
    (a * k - c * g) / det,   // [1,1]
    -(a * f - c * d) / det,  // [1,2]
    (d * hh - e * g) / det,  // [2,0]
    -(a * hh - b * g) / det, // [2,1]
    (a * e - b * d) / det,   // [2,2]
  ];
  return inv;
}

// Formats a 3×3 matrix (9 elements, row-major) as a table string.
function fmt3x3(m: number[]): string {
  const r = (v: number) => v.toFixed(6).padStart(12);
  return [
    `  [${r(m[0]!)}, ${r(m[1]!)}, ${r(m[2]!)}]`,
    `  [${r(m[3]!)}, ${r(m[4]!)}, ${r(m[5]!)}]`,
    `  [${r(m[6]!)}, ${r(m[7]!)}, ${r(m[8]!)}]`,
  ].join("\n");
}

// Full mathematical trace for the homography computation.
// Called once per geometry computation with the computed h and the floor quad.
function logHomographyMath(h: number[], quad: FloorQuad) {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;

  // ── Matrix display ────────────────────────────────────────────────────────
  const Hmat = [h0!, h1!, h2!, h3!, h4!, h5!, h6!, h7!, 1];
  console.log("H matrix (image → UV, row-major):\n" + fmt3x3(Hmat));

  const Hinv = invert3x3(h);
  if (Hinv) {
    console.log("H⁻¹ (UV → image):\n" + fmt3x3(Hinv));
  } else {
    console.warn("H is singular — cannot invert");
  }

  // ── Helper: full step-by-step transform ──────────────────────────────────
  const trace = (label: string, x: number, y: number, expectU?: number, expectV?: number) => {
    // Raw homogeneous multiply
    const U = h0! * x + h1! * y + h2!;   // numerator u
    const V = h3! * x + h4! * y + h5!;   // numerator v
    const W = h6! * x + h7! * y + 1;     // denominator (homogeneous w)
    const u = W !== 0 ? U / W : NaN;
    const v = W !== 0 ? V / W : NaN;

    const ok = (expectU !== undefined && expectV !== undefined)
      ? (Math.abs(u - expectU) < 0.001 && Math.abs(v - expectV) < 0.001) ? "✅" : "❌"
      : "";

    console.log(
      `${label.padEnd(22)} imgXY=(${String(Math.round(x)).padStart(4)}, ${String(Math.round(y)).padStart(4)})` +
      `  →  [U=${U.toFixed(4)}, V=${V.toFixed(4)}, W=${W.toFixed(4)}]` +
      `  ÷W  →  u=${u.toFixed(4)}, v=${v.toFixed(4)}` +
      (expectU !== undefined ? `  (expected ${expectU},${expectV}) ${ok}` : ""),
    );
  };

  // ── Corner round-trip verification ───────────────────────────────────────
  console.log("\nCorner round-trips (should each match expected UV exactly):");
  trace("tl → (0,0)", quad.tl.x, quad.tl.y, 0, 0);
  trace("tr → (1,0)", quad.tr.x, quad.tr.y, 1, 0);
  trace("br → (1,1)", quad.br.x, quad.br.y, 1, 1);
  trace("bl → (0,1)", quad.bl.x, quad.bl.y, 0, 1);

  // ── Sample pixels ─────────────────────────────────────────────────────────
  const midX = (a: number, b: number) => (a + b) / 2;
  const samplePts = {
    "center of top edge":    { x: midX(quad.tl.x, quad.tr.x), y: quad.tl.y },
    "center of bottom edge": { x: midX(quad.bl.x, quad.br.x), y: quad.bl.y },
    "left edge midpoint":    { x: midX(quad.tl.x, quad.bl.x), y: midX(quad.tl.y, quad.bl.y) },
    "right edge midpoint":   { x: midX(quad.tr.x, quad.br.x), y: midX(quad.tr.y, quad.br.y) },
    "center of floor":       { x: (quad.tl.x + quad.tr.x + quad.bl.x + quad.br.x) / 4,
                               y: (quad.tl.y + quad.tr.y + quad.bl.y + quad.br.y) / 4 },
  };

  console.log("\nSample pixels (expected UV shown for reference):");
  trace("center of top edge",    samplePts["center of top edge"].x,    samplePts["center of top edge"].y,    0.5, 0);
  trace("center of bottom edge", samplePts["center of bottom edge"].x, samplePts["center of bottom edge"].y, 0.5, 1);
  trace("left edge midpoint",    samplePts["left edge midpoint"].x,    samplePts["left edge midpoint"].y,    0,   0.5);
  trace("right edge midpoint",   samplePts["right edge midpoint"].x,   samplePts["right edge midpoint"].y,   1,   0.5);
  trace("center of floor",       samplePts["center of floor"].x,       samplePts["center of floor"].y);

  // ── Worked example: matrix × vector for floor center ─────────────────────
  const cx = samplePts["center of floor"].x;
  const cy = samplePts["center of floor"].y;
  console.log(`\nWorked example — floor center (${cx.toFixed(1)}, ${cy.toFixed(1)}):`);
  console.log(`  input vec = [x=${cx.toFixed(2)}, y=${cy.toFixed(2)}, 1]`);
  console.log(`  row 0 (U): ${h0!.toFixed(6)}·${cx.toFixed(2)} + ${h1!.toFixed(6)}·${cy.toFixed(2)} + ${h2!.toFixed(6)}·1 = ${(h0! * cx + h1! * cy + h2!).toFixed(6)}`);
  console.log(`  row 1 (V): ${h3!.toFixed(6)}·${cx.toFixed(2)} + ${h4!.toFixed(6)}·${cy.toFixed(2)} + ${h5!.toFixed(6)}·1 = ${(h3! * cx + h4! * cy + h5!).toFixed(6)}`);
  console.log(`  row 2 (W): ${h6!.toFixed(6)}·${cx.toFixed(2)} + ${h7!.toFixed(6)}·${cy.toFixed(2)} + 1·1         = ${(h6! * cx + h7! * cy + 1).toFixed(6)}`);
  const cU = h0! * cx + h1! * cy + h2!;
  const cV = h3! * cx + h4! * cy + h5!;
  const cW = h6! * cx + h7! * cy + 1;
  console.log(`  → u = U/W = ${cU.toFixed(6)} / ${cW.toFixed(6)} = ${(cU / cW).toFixed(6)}`);
  console.log(`  → v = V/W = ${cV.toFixed(6)} / ${cW.toFixed(6)} = ${(cV / cW).toFixed(6)}`);
}

// ── Step 3: Homography via Gaussian elimination ──────────────────────────────
//
// Solves A·h = b for h ∈ ℝ⁸ where h22 = 1 (DLT).
// Maps image pixels → normalised UV coords.

function gaussianElim(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Build augmented [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[maxRow]![col]!)) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow]!, M[col]!];

    const pivot = M[col]![col]!;
    if (Math.abs(pivot) < 1e-10) return null;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / pivot;
      for (let j = col; j <= n; j++) M[r]![j]! -= f * M[col]![j]!;
    }
  }

  return M.map((row, i) => row[n]! / row[i]!);
}

// Computes homography H mapping imgPts → uvPts using 4-point DLT.
function computeH(
  imgPts: [FloorPoint, FloorPoint, FloorPoint, FloorPoint],
  uvPts:  [FloorPoint, FloorPoint, FloorPoint, FloorPoint],
): number[] | null {
  const A: number[][] = [];
  const b: number[]   = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = imgPts[i]!;
    const { x: u, y: v } = uvPts[i]!;
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return gaussianElim(A, b);
}

function applyH(h: number[], x: number, y: number): FloorPoint {
  const w = h[6]! * x + h[7]! * y + 1;
  if (Math.abs(w) < 1e-8) return { x: 0, y: 0 };
  return { x: (h[0]! * x + h[1]! * y + h[2]!) / w, y: (h[3]! * x + h[4]! * y + h[5]!) / w };
}

// ── Step 4: Bilinear texture sampling with tiling ────────────────────────────

function sampleBilinear(
  data: Uint8ClampedArray,
  W:   number,
  H:   number,
  u:   number,
  v:   number,
): [number, number, number] {
  // Tile — handles negative UVs too
  u = ((u % 1) + 1) % 1;
  v = ((v % 1) + 1) % 1;

  const px = u * (W - 1);
  const py = v * (H - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, W - 1);
  const y1 = Math.min(y0 + 1, H - 1);
  const fx  = px - x0;
  const fy  = py - y0;

  const i00 = (y0 * W + x0) * 4;
  const i10 = (y0 * W + x1) * 4;
  const i01 = (y1 * W + x0) * 4;
  const i11 = (y1 * W + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  return [
    data[i00]! * w00 + data[i10]! * w10 + data[i01]! * w01 + data[i11]! * w11,
    data[i00 + 1]! * w00 + data[i10 + 1]! * w10 + data[i01 + 1]! * w01 + data[i11 + 1]! * w11,
    data[i00 + 2]! * w00 + data[i10 + 2]! * w10 + data[i01 + 2]! * w01 + data[i11 + 2]! * w11,
  ];
}

// ── Lighting decomposition: low/high-frequency luminance + edge feather ──────
//
// The old composite was a flat "tex*op + orig*(1-op)" cross-dissolve applied
// uniformly across the whole floor — it doesn't reproduce the room's lighting
// at all, it just fades a fixed fraction of the original photo back in. That's
// why renders read as pasted-on. Instead we decompose the *original* floor
// region's luminance into:
//   - a low-frequency layer (blurred luminance) → soft ambient shadows/gradients
//     cast by furniture, windows, fixtures — reapplied via multiply.
//   - a high-frequency layer (blur residual) → specular highlights/reflections
//     and fine shadow detail — reapplied via screen (brighten) / multiply (darken).
// Both are derived solely from the room photo + floor mask, so they're computed
// once per room and cached on FloorGeometry (independent of slab texture/settings).

function boxBlurPass(src: Float32Array, dst: Float32Array, W: number, H: number, r: number, horizontal: boolean) {
  const norm = 1 / (2 * r + 1);
  if (horizontal) {
    for (let y = 0; y < H; y++) {
      const off = y * W;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[off + Math.min(W - 1, Math.max(0, x))]!;
      for (let x = 0; x < W; x++) {
        dst[off + x] = sum * norm;
        sum += src[off + Math.min(W - 1, x + r + 1)]! - src[off + Math.max(0, x - r)]!;
      }
    }
  } else {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += src[Math.min(H - 1, Math.max(0, y)) * W + x]!;
      for (let y = 0; y < H; y++) {
        dst[y * W + x] = sum * norm;
        sum += src[Math.min(H - 1, y + r + 1) * W + x]! - src[Math.max(0, y - r) * W + x]!;
      }
    }
  }
}

// Three-pass box blur approximates a Gaussian blur of similar radius, cheaply.
function boxBlur3(src: Float32Array, W: number, H: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  let a = src.slice();
  const b = new Float32Array(W * H);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(a, b, W, H, r, true);
    boxBlurPass(b, a, W, H, r, false);
  }
  return a;
}

const SHADOW_STRENGTH    = 0.85;  // how strongly the low-freq (ambient shadow) layer modulates the texture
const HIGHLIGHT_STRENGTH = 0;     // high-freq layer carries the OLD floor's own grain/veining (that's what "high
                                   // frequency" means for a patterned floor), so reapplying it prints the old
                                   // floor's pattern onto the new slab. Disabled — lowMul (blurred, pattern-free
                                   // ambient shadow) plus the art-directed specular hotspot carry realism instead.
const LOW_MUL_MIN = 0.4, LOW_MUL_MAX = 1.75; // clamp so deep shadows/hot spots don't crush or blow out the texture
const FEATHER_PX_FRAC = 1 / 250; // floor-boundary feather width as a fraction of min(W,H)

function computeLightingLayers(
  origPx: Uint8ClampedArray,
  surfMask: Uint8Array,
  W: number,
  H: number,
): { lowMul: Float32Array; highRes: Float32Array } {
  const n   = W * H;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ri = i * 4;
    lum[i] = 0.299 * origPx[ri]! + 0.587 * origPx[ri + 1]! + 0.114 * origPx[ri + 2]!;
  }

  // Blur radius scaled to the floor's on-screen size — bigger floors need a
  // wider kernel so shadow gradients read as soft, not blotchy.
  let xMin = W, xMax = 0, yMin = H, yMax = 0, found = false;
  for (let i = 0; i < n; i++) {
    if ((surfMask[i] ?? 0) > 128) {
      found = true;
      const x = i % W, y = (i / W) | 0;
      if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    }
  }
  const diag   = found ? Math.hypot(xMax - xMin, yMax - yMin) : Math.min(W, H);
  const radius = Math.max(10, Math.min(90, Math.round(diag / 7)));

  const low = boxBlur3(lum, W, H, radius);

  let sum = 0, count = 0;
  for (let i = 0; i < n; i++) {
    if ((surfMask[i] ?? 0) > 128) { sum += low[i]!; count++; }
  }
  const meanLow = count > 0 ? sum / count : 128;

  const lowMul  = new Float32Array(n);
  const highRes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const rawMul = meanLow > 1e-3 ? low[i]! / meanLow : 1;
    const damped = 1 + (rawMul - 1) * SHADOW_STRENGTH;
    lowMul[i]  = Math.max(LOW_MUL_MIN, Math.min(LOW_MUL_MAX, damped));
    highRes[i] = lum[i]! - low[i]!;
  }

  return { lowMul, highRes };
}

// Soft alpha, 1 deep inside the floor mask, ramping to 0 over a few pixels at
// the mask boundary — replaces the current hard binary cutline at the floor/wall
// (and floor/baseboard) edge.
function computeEdgeAlpha(surfMask: Uint8Array, W: number, H: number): Float32Array {
  const n   = W * H;
  const bin = new Float32Array(n);
  for (let i = 0; i < n; i++) bin[i] = (surfMask[i] ?? 0) > 128 ? 1 : 0;

  const featherPx = Math.max(2, Math.round(Math.min(W, H) * FEATHER_PX_FRAC));
  const tmp     = new Float32Array(n);
  const blurred = new Float32Array(n);
  boxBlurPass(bin, tmp, W, H, featherPx, true);
  boxBlurPass(tmp, blurred, W, H, featherPx, false);

  // Only fade inward from the mask edge — never extend alpha past the original mask.
  for (let i = 0; i < n; i++) blurred[i] = bin[i]! > 0 ? Math.min(1, blurred[i]!) : 0;
  return blurred;
}

const CONTACT_SHADOW_STRENGTH   = 0.45;  // 0..1 — how dark the rim gets right at an occluder's edge
const CONTACT_SHADOW_PX_FRAC    = 1 / 130; // rim width as a fraction of min(W,H) — a physical-width contact
                                            // shadow, so it doesn't scale with how big the object itself is

// Per-pixel multiplier (1 = unaffected) that darkens the floor texture in a soft rim just
// outside each occluder's mask boundary, fading back to 1 a few pixels out — makes furniture
// read as resting on the floor rather than pasted over it. The occluder's own cutout stays
// hard-edged: this only ever touches floor-side pixels (occBin === 0), the compositing
// decision of what counts as "occluder" is untouched, so there's nothing here that could
// soften that boundary — only darken the texture just beyond it.
export function computeContactShadow(occMask: Uint8Array, W: number, H: number): Float32Array {
  const n = W * H;
  const occBin = new Float32Array(n);
  for (let i = 0; i < n; i++) occBin[i] = (occMask[i] ?? 0) > 128 ? 1 : 0;

  const radius  = Math.max(2, Math.round(Math.min(W, H) * CONTACT_SHADOW_PX_FRAC));
  const tmp     = new Float32Array(n);
  const blurred = new Float32Array(n);
  boxBlurPass(occBin, tmp, W, H, radius, true);
  boxBlurPass(tmp, blurred, W, H, radius, false);

  const mul = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (occBin[i]! > 0) { mul[i] = 1; continue; } // occluder pixels aren't rendered — value unused
    const closeness = Math.min(1, blurred[i]!);
    mul[i] = 1 - closeness * CONTACT_SHADOW_STRENGTH;
  }
  return mul;
}

// Applies the low/high-frequency lighting layers to a texture-space RGB triplet,
// then cross-dissolves with the original pixel using opacity scaled by the edge
// feather (so op still behaves as before in the mask interior, but transitions
// smoothly to the original photo at the floor boundary).
function compositeLit(
  srcR: number, srcG: number, srcB: number,
  origR: number, origG: number, origB: number,
  lowMul: number, highRes: number, edgeA: number,
  op: number,
): [number, number, number] {
  let r = srcR * lowMul, g = srcG * lowMul, b = srcB * lowMul;

  const eff = highRes * HIGHLIGHT_STRENGTH;
  if (eff >= 0) {
    // Screen blend — brightens toward specular highlights/reflections without clipping.
    r = 255 - (255 - r) * (255 - eff) / 255;
    g = 255 - (255 - g) * (255 - eff) / 255;
    b = 255 - (255 - b) * (255 - eff) / 255;
  } else {
    // Multiply blend — reintroduces fine shadow detail the low-freq layer missed.
    const f = Math.max(0, 1 + eff / 255);
    r *= f; g *= f; b *= f;
  }

  const effOp = op * edgeA;
  return [
    clamp(r * effOp + origR * (1 - effOp)),
    clamp(g * effOp + origG * (1 - effOp)),
    clamp(b * effOp + origB * (1 - effOp)),
  ];
}

// ── Art-directed specular highlight ───────────────────────────────────────────
//
// A deliberate glossy hotspot placed where a detected light source (window, lamp,
// chandelier, sconce) would plausibly cast light onto the floor, rather than relying
// only on the photo's own derived luminance (computeLightingLayers, above). This is
// not a physical light-transport simulation — monocular depth can't recover that — so
// depth is used only as a secondary intensity nudge, and placement/sizing rides on the
// SAME already-correct per-pixel UV the texture sampler uses (rawU/rawV), which is why
// this needs no new warp math and inherits perspective foreshortening for free.
//
// Split into pure/testable pieces (anchor-finding, param derivation, falloff) and a
// thin async orchestrator that does the mask/depth decoding.

export type SpecularHighlight = {
  au: number; av: number;           // anchor position in homography UV space
  radiusU: number; radiusV: number; // Gaussian falloff radii in UV space (1σ)
  intensity: number;                // 0..1 peak brightening strength
};

const LIGHT_SOURCE_LABEL_RE = /window|windowpane|skylight|lamp|chandelier|sconce|streetlight/i;
const SPECULAR_RADIUS_U        = 0.16;
const SPECULAR_RADIUS_V        = 0.22;
const SPECULAR_BASE_INTENSITY  = 0.5;
const SPECULAR_FALLOFF_CUTOFF2 = 9; // 3σ² — beyond this, contribution is visually negligible

/**
 * Walks straight down from a light-source mask's lowest point (its sill/base — the
 * point closest to the floor) until it finds a floor pixel in the same column.
 * Approximates where that light source's illumination would meet the floor.
 * Returns null rather than guessing if no floor is found within a sane scan range.
 */
export function findFloorAnchorBelowMask(
  lightMask: Uint8Array, surfMask: Uint8Array, W: number, H: number,
): FloorPoint | null {
  let sumX = 0, count = 0, bottomY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((lightMask[y * W + x] ?? 0) > 128) {
        sumX += x; count++;
        if (y > bottomY) bottomY = y;
      }
    }
  }
  if (count === 0) return null;
  const cx = Math.round(sumX / count);

  const maxScan = Math.round(H * 0.6);
  for (let dy = 0; dy < maxScan; dy++) {
    const y = bottomY + dy;
    if (y >= H) break;
    if ((surfMask[y * W + cx] ?? 0) > 128) return { x: cx, y };
  }
  return null;
}

/**
 * Derives the UV-space highlight params from an image-space anchor. Depth (if present)
 * only nudges intensity — brighter depth pixel (Depth Anything V2 convention: nearer =
 * brighter) ⇒ a modestly more prominent highlight, since near-camera specular reflections
 * are naturally more visible than distant ones. Missing/failed depth just keeps the base
 * intensity rather than blocking the highlight.
 */
export function computeSpecularParams(
  anchor: FloorPoint, depth: Uint8Array | null, W: number, h: number[],
): SpecularHighlight {
  const { x: au, y: av } = applyH(h, anchor.x, anchor.y);

  let intensity = SPECULAR_BASE_INTENSITY;
  if (depth) {
    const dNear = depth[Math.round(anchor.y) * W + Math.round(anchor.x)] ?? 128;
    intensity = SPECULAR_BASE_INTENSITY * (0.7 + 0.6 * (dNear / 255));
    intensity = Math.max(0.25, Math.min(0.85, intensity));
  }

  return { au, av, radiusU: SPECULAR_RADIUS_U, radiusV: SPECULAR_RADIUS_V, intensity };
}

/** Gaussian falloff, screen-blended onto an already-composited pixel — brightens toward white, never darkens, never overflows. */
export function applySpecularHighlight(
  r: number, g: number, b: number,
  rawU: number, rawV: number,
  specular: SpecularHighlight | null,
): [number, number, number] {
  if (!specular) return [r, g, b];
  const dU = (rawU - specular.au) / specular.radiusU;
  const dV = (rawV - specular.av) / specular.radiusV;
  const d2 = dU * dU + dV * dV;
  if (d2 > SPECULAR_FALLOFF_CUTOFF2) return [r, g, b];

  const eff = Math.exp(-d2 / 2) * specular.intensity * 255;
  return [
    clamp(255 - (255 - r) * (255 - eff) / 255),
    clamp(255 - (255 - g) * (255 - eff) / 255),
    clamp(255 - (255 - b) * (255 - eff) / 255),
  ];
}

// Picks the largest-area segment whose label matches a light-source keyword — the most
// visually prominent light source gets one deliberate highlight, rather than one per
// window/fixture (which would read as busy/artificial).
async function findBrightestLightMask(
  segments: PipelineSegment[], W: number, H: number,
): Promise<Uint8Array | null> {
  const candidates = segments.filter((s) => LIGHT_SOURCE_LABEL_RE.test(s.label));
  if (candidates.length === 0) return null;

  const decoded = await Promise.all(candidates.map((s) => decodeMask(s.maskBase64, W, H)));
  let bestIdx = -1, bestCount = 0;
  for (let i = 0; i < decoded.length; i++) {
    let count = 0;
    for (let p = 0; p < decoded[i]!.length; p++) if (decoded[i]![p]! > 128) count++;
    if (count > bestCount) { bestCount = count; bestIdx = i; }
  }
  // Too small to be a meaningful light source (a sliver of window at the image edge, etc).
  if (bestIdx === -1 || bestCount < 25) return null;
  return decoded[bestIdx]!;
}

async function computeSpecularHighlight(
  segments: PipelineSegment[],
  depthBase64: string | null,
  surfMask: Uint8Array,
  W: number, H: number,
  h: number[],
): Promise<SpecularHighlight | null> {
  const lightMask = await findBrightestLightMask(segments, W, H);
  if (!lightMask) return null;

  const anchor = findFloorAnchorBelowMask(lightMask, surfMask, W, H);
  if (!anchor) return null; // no floor found below this light source — skip rather than guess

  let depth: Uint8Array | null = null;
  if (depthBase64) {
    try {
      depth = await decodeMask(depthBase64, W, H);
    } catch {
      // Depth decode failed — keep depth null, base intensity still applies below.
    }
  }

  return computeSpecularParams(anchor, depth, W, h);
}

// ── Debug overlay ─────────────────────────────────────────────────────────────

async function makeDebugOverlay(
  originalUrl: string,
  cc:         Uint8Array,
  quad:       FloorQuad | null,
  W:          number,
  H:          number,
): Promise<string> {
  const { c, ctx } = newCanvas(W, H);
  ctx.drawImage(await loadImage(originalUrl), 0, 0, W, H);

  // Green tint on CC pixels
  const tint = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if ((cc[i] ?? 0) > 128) {
      tint[i * 4]     = 80;
      tint[i * 4 + 1] = 220;
      tint[i * 4 + 2] = 80;
      tint[i * 4 + 3] = 100;
    }
  }
  const { c: tC, ctx: tCtx } = newCanvas(W, H);
  tCtx.putImageData(new ImageData(tint, W, H), 0, 0);
  ctx.drawImage(tC, 0, 0);

  if (!quad) return c.toDataURL("image/jpeg", 0.9);

  const { tl, tr, br, bl } = quad;
  const pts    = [tl, tr, br, bl];
  const labels = ["TL", "TR", "BR", "BL"];
  const R      = Math.max(4, W / 160);
  const fs     = Math.max(10, Math.round(W / 70));

  // Quad outline
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.strokeStyle = "#FF2200";
  ctx.lineWidth   = Math.max(1.5, W / 500);
  ctx.stroke();

  // Diagonal cross-wires (perspective guides)
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y); ctx.lineTo(br.x, br.y);
  ctx.moveTo(tr.x, tr.y); ctx.lineTo(bl.x, bl.y);
  ctx.strokeStyle = "rgba(255,100,0,0.45)";
  ctx.lineWidth   = Math.max(1, W / 700);
  ctx.stroke();

  // Corner dots + labels
  for (let k = 0; k < 4; k++) {
    const { x, y } = pts[k]!;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = "#FF2200";
    ctx.fill();

    // White text with shadow for contrast
    ctx.font        = `bold ${fs}px sans-serif`;
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.fillText(labels[k]!, x + R + 2, y - 2 + 1);
    ctx.fillStyle   = "white";
    ctx.fillText(labels[k]!, x + R + 2, y - 2);
  }

  return c.toDataURL("image/jpeg", 0.92);
}

// ── Geometry stage: room photo + masks → CC/quad/homography ──────────────────

const MAX_DIM = 1280;

export async function computeFloorGeometry(
  job: Pick<RenderJob, "originalDataUrl" | "surfaceMaskBases" | "occluderMaskBases" | "width" | "height" | "segments" | "depthBase64">,
): Promise<FloorGeometry> {
  const { originalDataUrl, surfaceMaskBases, occluderMaskBases, width, height, segments, depthBase64 } = job;

  // Cap resolution
  const scl = Math.min(1, MAX_DIM / Math.max(width || 1, height || 1));
  const W   = Math.max(1, Math.round(width  * scl));
  const H   = Math.max(1, Math.round(height * scl));

  // Load original image
  const origImg = await loadImage(originalDataUrl);
  const { ctx: oCtx } = newCanvas(W, H);
  oCtx.drawImage(origImg, 0, 0, W, H);
  const origPx = oCtx.getImageData(0, 0, W, H).data;

  // Decode and union masks
  const [surfMasks, occMasks] = await Promise.all([
    Promise.all(surfaceMaskBases.map((b) => decodeMask(b, W, H))),
    Promise.all(occluderMaskBases.map((b) => decodeMask(b, W, H))),
  ]);
  const surfMask = unionMasks(surfMasks);
  const occMask  = unionMasks(occMasks);

  // Largest connected component + quad
  const cc   = findLargestCC(surfMask, W, H);
  const quad = extractFloorQuad(cc, W, H);

  // ── Homography: image pixel → normalised UV [0,1]²
  // Correspondence: tl→(0,0)  tr→(1,0)  br→(1,1)  bl→(0,1)
  let h: number[] | null = null;
  if (quad) {
    h = computeH(
      [quad.tl, quad.tr, quad.br, quad.bl],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    );

    // ── Diagnostic logging ────────────────────────────────────────────────
    console.group("[PerspectiveRenderer] Homography diagnostics");
    console.log("Quad (image px):", {
      tl: quad.tl, tr: quad.tr, br: quad.br, bl: quad.bl,
      width_top:    quad.tr.x - quad.tl.x,
      width_bottom: quad.br.x - quad.bl.x,
      height:       quad.bl.y - quad.tl.y,
    });

    if (h) {
      logHomographyMath(h, quad);

      // UV range across floor pixels (quick scan every 10th pixel)
      let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (let i = 0; i < W * H; i += 10) {
        if ((surfMask[i] ?? 0) > 128) {
          const { x: u, y: v } = applyH(h, i % W, (i / W) | 0);
          if (u < uMin) uMin = u; if (u > uMax) uMax = u;
          if (v < vMin) vMin = v; if (v > vMax) vMax = v;
        }
      }
      console.log(`\nUV range across ALL floor pixels (sampled): u=[${uMin.toFixed(4)}, ${uMax.toFixed(4)}]  v=[${vMin.toFixed(4)}, ${vMax.toFixed(4)}]`);
    } else {
      console.warn("Homography solve failed (degenerate quad?)");
    }
    console.groupEnd();
  }

  const debugUrl = await makeDebugOverlay(originalDataUrl, cc, quad, W, H);

  const { lowMul, highRes } = computeLightingLayers(origPx, surfMask, W, H);
  const edgeAlpha = computeEdgeAlpha(surfMask, W, H);

  // Fold the contact shadow into the same ambient multiplier lowMul already applies —
  // conceptually the same kind of soft darkening, just sourced from occluder proximity
  // instead of the photo's own luminance.
  const contactShadow = computeContactShadow(occMask, W, H);
  for (let i = 0; i < W * H; i++) lowMul[i] = lowMul[i]! * contactShadow[i]!;

  const specular = h
    ? await computeSpecularHighlight(segments ?? [], depthBase64 ?? null, surfMask, W, H, h)
    : null;

  return { W, H, origPx, surfMask, occMask, cc, quad, h, debugUrl, lowMul, highRes, edgeAlpha, specular };
}

// ── Texture stage: geometry + slab texture + settings → composite ────────────

export async function renderTextureFromGeometry(
  geometry: FloorGeometry,
  job: Pick<RenderJob, "textureDataUrl" | "settings" | "renderMode" | "slabSettings" | "debugUV" | "debugCheckerboard" | "debugSlab">,
): Promise<{ compositeUrl: string }> {
  const { textureDataUrl, settings } = job;
  const isUVDebug      = job.debugUV          === true;
  const isCheckerboard = job.debugCheckerboard === true;

  const { W, H, origPx, surfMask, occMask, h, quad, lowMul, highRes, edgeAlpha, specular } = geometry;

  // ── Slab layout setup ────────────────────────────────────────────────────────
  const renderMode  = job.renderMode ?? "slab";
  const slabCfg: SlabSettings = job.slabSettings ?? DEFAULT_SLAB_SETTINGS;
  const isSlab       = renderMode === "slab"       && !isUVDebug && !isCheckerboard;
  const isSequential = renderMode === "sequential" && !isUVDebug && !isCheckerboard;
  const isSlabAny    = isSlab || isSequential;
  const isDebugSlab  = isSlabAny && job.debugSlab === true;

  // Pre-compute slab constants (avoid divisions in the per-pixel loop)
  const slabW      = slabCfg.slabWidth;
  const slabH      = slabCfg.slabHeight;
  const halfJointU = slabCfg.jointSize > 0 ? slabCfg.jointSize / slabW  / 2 : 0;
  const halfJointV = slabCfg.jointSize > 0 ? slabCfg.jointSize / slabH  / 2 : 0;
  const safeSpanU  = 1 - 2 * halfJointU;   // usable slab interior fraction in U
  const safeSpanV  = 1 - 2 * halfJointV;
  const jointRgb   = hexToRgb(slabCfg.jointColor);
  const slabCache  = new Map<number, SlabCachedParams>();

  // Load texture (skip in debug-only modes — texture unused there)
  let texPx: Uint8ClampedArray = new Uint8ClampedArray(0);
  let texW = 1, texH = 1;
  // Sequential debug needs texture (draws lines over it); Random Slabs debug does not (colored squares).
  if (!isUVDebug && !isCheckerboard && !(isSlab && isDebugSlab)) {
    const texImg = await loadImage(textureDataUrl);
    texW = texImg.naturalWidth  || 512;
    texH = texImg.naturalHeight || 512;
    const { ctx: tCtx } = newCanvas(texW, texH);
    tCtx.drawImage(texImg, 0, 0);
    texPx = tCtx.getImageData(0, 0, texW, texH).data;
  }

  // Pre-compute rotation & scale constants
  const angRad = (settings.rotation * Math.PI) / 180;
  const cosA   = Math.cos(angRad);
  const sinA   = Math.sin(angRad);
  const doRot  = settings.rotation !== 0;
  const sc     = settings.scale;
  const brt    = settings.brightness;
  const op     = settings.opacity;

  // ── Pixel loop ───────────────────────────────────────────────────────────
  const result = new Uint8ClampedArray(W * H * 4);

  // Trace state: capture one pixel just above and one just below the first horizontal grout line.
  // seqTraceAbove keeps updating (ends up as the last matching pixel in row 0).
  // seqTraceBelow is captured on the first match in row 1.
  let seqTraceAbove: Record<string, number> | null = null;
  let seqTraceBelow: Record<string, number> | null = null;

  for (let i = 0; i < W * H; i++) {
    const ri         = i * 4;
    const onSurface  = (surfMask[i] ?? 0) > 128;
    const isOccluder = (occMask[i]  ?? 0) > 128;

    if (onSurface && !isOccluder && h) {
      const imgX = i % W;
      const imgY = (i / W) | 0;

      // Perspective UV via homography (image → UV)
      const { x: rawU, y: rawV } = applyH(h, imgX, imgY);

      if (isCheckerboard) {
        // 8×8 checkerboard per UV unit — raw applyH output, no scale/rotation/texture.
        // If perspective is working, cells near the camera appear larger than cells far away.
        const cell = (Math.floor(rawU * 8) + Math.floor(rawV * 8)) % 2;
        const ch   = cell === 0 ? 230 : 40;
        result[ri]     = ch;
        result[ri + 1] = ch;
        result[ri + 2] = ch;
      } else if (isUVDebug) {
        // UV visualisation: U=red, V=green — raw homography output, no scale/rotation
        result[ri]     = clamp(rawU * 255);
        result[ri + 1] = clamp(rawV * 255);
        result[ri + 2] = 0;
      } else if (isSlabAny) {
        // Joint detection via fractional slab position — no col/row reconstruction.
        // ((x % 1) + 1) % 1  gives the fractional part in [0,1) for any sign of x.
        const slabFracU = ((rawU / slabW) % 1 + 1) % 1;
        const slabFracV = ((rawV / slabH) % 1 + 1) % 1;
        const inJoint   = slabFracU < halfJointU || slabFracU > 1 - halfJointU
                       || slabFracV < halfJointV || slabFracV > 1 - halfJointV;

        if (inJoint) {
          const [jr0, jg0, jb0] = compositeLit(
            jointRgb[0]!, jointRgb[1]!, jointRgb[2]!,
            origPx[ri]!, origPx[ri + 1]!, origPx[ri + 2]!,
            lowMul[i]!, highRes[i]!, edgeAlpha[i]!, op,
          );
          const [jr, jg, jb] = applySpecularHighlight(jr0, jg0, jb0, rawU, rawV, specular);
          result[ri] = jr; result[ri + 1] = jg; result[ri + 2] = jb;
        } else if (isSequential) {
          // ── Sequential ────────────────────────────────────────────────────────
          // Sampling depends ONLY on rawU, rawV, slabW, slabH, sc, rotation.
          // No col, row, localU, or localV anywhere in this branch.
          const su0 = rawU / slabW;   // pre-rotation
          const sv0 = rawV / slabH;   // pre-rotation
          let su = su0, sv = sv0;
          if (doRot) {
            const cu = su - 0.5, cv = sv - 0.5;
            su = cosA * cu - sinA * cv + 0.5;
            sv = sinA * cu + cosA * cv + 0.5;
          }
          const su1 = su, sv1 = sv;   // post-rotation, pre-scale
          su *= sc;
          sv *= sc;
          // su, sv are now post-scale — passed directly to sampleBilinear which wraps internally.
          const wu = ((su % 1) + 1) % 1;   // mirrors sampleBilinear's internal wrap
          const wv = ((sv % 1) + 1) % 1;
          const [tr, tg, tb] = sampleBilinear(texPx, texW, texH, su, sv);
          const [sr0, sg0, sb0] = compositeLit(
            tr * brt, tg * brt, tb * brt,
            origPx[ri]!, origPx[ri + 1]!, origPx[ri + 2]!,
            lowMul[i]!, highRes[i]!, edgeAlpha[i]!, op,
          );
          const [sr, sg, sb] = applySpecularHighlight(sr0, sg0, sb0, rawU, rawV, specular);
          result[ri] = sr; result[ri + 1] = sg; result[ri + 2] = sb;
          // Capture trace: last row-0 pixel near grout edge, and first row-1 pixel past grout.
          const rowIdx = Math.floor(rawV / slabH);
          if (rowIdx === 0 && slabFracV > 1 - halfJointV - 0.05) {
            seqTraceAbove = {
              rawU, rawV, slabFracV,
              su_preRot: su0, sv_preRot: sv0,
              su_postRot: su1, sv_postRot: sv1,
              su_scaled: su, sv_scaled: sv,
              wu, wv,
              texX: Math.round(wu * (texW - 1)), texY: Math.round(wv * (texH - 1)),
              tr, tg, tb,
            };
          }
          if (seqTraceBelow === null && rowIdx === 1 && slabFracV < halfJointV + 0.05) {
            seqTraceBelow = {
              rawU, rawV, slabFracV,
              su_preRot: su0, sv_preRot: sv0,
              su_postRot: su1, sv_postRot: sv1,
              su_scaled: su, sv_scaled: sv,
              wu, wv,
              texX: Math.round(wu * (texW - 1)), texY: Math.round(wv * (texH - 1)),
              tr, tg, tb,
            };
          }
        } else {
          // ── Random Slabs ─────────────────────────────────────────────────────
          // col/row only exist in this branch — never used by sequential above.
          const col = Math.floor(rawU / slabW);
          const row = Math.floor(rawV / slabH);
          if (isDebugSlab) {
            const [dr, dg, db] = slabDebugColor(col, row);
            result[ri]     = clamp(dr * op + origPx[ri]!     * (1 - op));
            result[ri + 1] = clamp(dg * op + origPx[ri + 1]! * (1 - op));
            result[ri + 2] = clamp(db * op + origPx[ri + 2]! * (1 - op));
          } else {
            const safeU = safeSpanU > 0 ? (slabFracU - halfJointU) / safeSpanU : slabFracU;
            const safeV = safeSpanV > 0 ? (slabFracV - halfJointV) / safeSpanV : slabFracV;
            const p = getOrMakeSlabParams(col, row, slabCfg.randomize, slabCfg.bookmatch, slabCache);

            let su = p.flipH ? 1 - safeU : safeU;
            let sv = p.flipV ? 1 - safeV : safeV;

            if (p.hasRot) {
              const cu2 = su - 0.5, cv2 = sv - 0.5;
              su = p.cosA * cu2 - p.sinA * cv2 + 0.5;
              sv = p.sinA * cu2 + p.cosA * cv2 + 0.5;
            }

            su = su * sc + p.offsetU;
            sv = sv * sc + p.offsetV;

            const [tr, tg, tb] = sampleBilinear(texPx, texW, texH, su, sv);
            const totalBrt = brt * p.brightness;
            const [rr0, rg0, rb0] = compositeLit(
              tr * totalBrt, tg * totalBrt, tb * totalBrt,
              origPx[ri]!, origPx[ri + 1]!, origPx[ri + 2]!,
              lowMul[i]!, highRes[i]!, edgeAlpha[i]!, op,
            );
            const [rr, rg, rb] = applySpecularHighlight(rr0, rg0, rb0, rawU, rawV, specular);
            result[ri] = rr; result[ri + 1] = rg; result[ri + 2] = rb;
          }
        }
      } else {
        // ── Repeat mode (original path) ───────────────────────────────────────
        let u = rawU, v = rawV;

        if (doRot) {
          const cu = u - 0.5, cv = v - 0.5;
          u = cosA * cu - sinA * cv + 0.5;
          v = sinA * cu + cosA * cv + 0.5;
        }

        u *= sc;
        v *= sc;

        const [tr, tg, tb] = sampleBilinear(texPx, texW, texH, u, v);

        const [cr0, cg0, cb0] = compositeLit(
          tr * brt, tg * brt, tb * brt,
          origPx[ri]!, origPx[ri + 1]!, origPx[ri + 2]!,
          lowMul[i]!, highRes[i]!, edgeAlpha[i]!, op,
        );
        const [cr, cg, cb] = applySpecularHighlight(cr0, cg0, cb0, rawU, rawV, specular);
        result[ri] = cr; result[ri + 1] = cg; result[ri + 2] = cb;
      }
    } else {
      result[ri]     = origPx[ri]!;
      result[ri + 1] = origPx[ri + 1]!;
      result[ri + 2] = origPx[ri + 2]!;
    }
    result[ri + 3] = 255;
  }

  // ── Sequential per-pixel boundary trace ──────────────────────────────────────
  // Shows the exact sampling pipeline for the two pixels straddling the first horizontal grout line.
  // If V is truly continuous, wv should be nearly identical on both sides.
  // A large Δwv means sampleBilinear's internal wrap fired (sv_scaled crossed an integer).
  if (isSequential) {
    const fmtPt = (p: Record<string, number> | null, label: string) => {
      if (!p) { console.log(`  [${label}]: not captured`); return; }
      console.log(`  [${label}]`);
      console.log(`    rawU:            ${(p["rawU"] ?? 0).toFixed(8)}`);
      console.log(`    rawV:            ${(p["rawV"] ?? 0).toFixed(8)}  slabFracV: ${(p["slabFracV"] ?? 0).toFixed(8)}`);
      console.log(`    su pre-rot:      ${(p["su_preRot"] ?? 0).toFixed(8)}    sv pre-rot:   ${(p["sv_preRot"] ?? 0).toFixed(8)}`);
      console.log(`    su post-rot:     ${(p["su_postRot"] ?? 0).toFixed(8)}    sv post-rot:  ${(p["sv_postRot"] ?? 0).toFixed(8)}`);
      console.log(`    su × sc:         ${(p["su_scaled"] ?? 0).toFixed(8)}    sv × sc:      ${(p["sv_scaled"] ?? 0).toFixed(8)}`);
      console.log(`    su wrapped:      ${(p["wu"] ?? 0).toFixed(8)}    sv wrapped:   ${(p["wv"] ?? 0).toFixed(8)}`);
      console.log(`    texX: ${p["texX"]}  texY: ${p["texY"]}`);
      console.log(`    rgb:  (${Math.round(p["tr"] ?? 0)}, ${Math.round(p["tg"] ?? 0)}, ${Math.round(p["tb"] ?? 0)})`);
    };
    console.group(
      `[Sequential] PIXEL TRACE — boundary rawV=${slabH.toFixed(4)}` +
      `  sc=${sc}  slabW=${slabW}  slabH=${slabH}  halfJointV=${halfJointV.toFixed(6)}`
    );
    console.log(
      `  sv at boundary = (rawV/slabH)×sc = 1×${sc} = ${sc}` +
      `  → sampleBilinear wraps when sv_scaled ≥ 1.0 (i.e. sc ≥ slabH=${slabH})`
    );
    fmtPt(seqTraceAbove, "LAST VISIBLE above grout  (row 0, slabFracV near 1−halfJointV)");
    fmtPt(seqTraceBelow, "FIRST VISIBLE below grout (row 1, slabFracV near halfJointV)");
    if (seqTraceAbove && seqTraceBelow) {
      const dScaled  = Math.abs((seqTraceBelow["sv_scaled"] ?? 0) - (seqTraceAbove["sv_scaled"] ?? 0));
      const dWrapped = Math.abs((seqTraceBelow["wv"] ?? 0) - (seqTraceAbove["wv"] ?? 0));
      console.log(`  Δ sv_scaled  = ${dScaled.toFixed(8)}  (formula continuity — expect ≈ 0)`);
      console.log(
        `  Δ wv_wrapped = ${dWrapped.toFixed(8)}  ` +
        (dWrapped > 0.5 ? "✗ WRAP-AROUND RESTART — this is the visual discontinuity" : "✓ continuous inside sampleBilinear")
      );
    }
    console.groupEnd();
  }

  // ── Sequential boundary-continuity trace ─────────────────────────────────────
  // Verifies that sv is identical on both sides of every horizontal slab boundary.
  // Expected: delta_sv ≈ 0 (only floating-point epsilon).  Any large jump means V restart.
  if (isSequential) {
    const eps = 1e-7;
    console.group(`[Sequential] Boundary continuity  sc=${sc}  slabW=${slabW}  slabH=${slabH}`);
    const numRows2 = Math.ceil(1.001 / slabH);
    for (let k = 1; k < numRows2; k++) {
      const vBound  = k * slabH;
      const sv_above = (vBound - eps) / slabH * sc;
      const sv_below = (vBound + eps) / slabH * sc;
      const delta   = Math.abs(sv_below - sv_above);
      console.log(
        `  row ${k - 1}→${k}  rawV=${vBound.toFixed(4)}` +
        `  sv_above=${sv_above.toFixed(6)}  sv_below=${sv_below.toFixed(6)}` +
        `  Δsv=${delta.toExponential(2)}  ${delta < 1e-5 ? "✓ continuous" : "✗ DISCONTINUOUS"}`,
      );
    }
    console.log(
      `  Note: for veins to NOT repeat, sc must be ≤ slabH=${slabH.toFixed(3)}.` +
      `  Current sc=${sc} → ${(1 / sc).toFixed(1)} texture repeats across floor in V.`,
    );
    console.groupEnd();
  }

  // ── Texture sampling trace (normal texture paths only) ──────────────────
  if (!isUVDebug && !isCheckerboard && !isDebugSlab && h && quad) {
    // 5 geometric reference points
    const geomPts = [
      { label: "top edge center",    x: (quad.tl.x + quad.tr.x) / 2,                        y: quad.tl.y },
      { label: "bottom edge center", x: (quad.bl.x + quad.br.x) / 2,                        y: quad.bl.y },
      { label: "left edge mid",      x: (quad.tl.x + quad.bl.x) / 2,                        y: (quad.tl.y + quad.bl.y) / 2 },
      { label: "right edge mid",     x: (quad.tr.x + quad.br.x) / 2,                        y: (quad.tr.y + quad.br.y) / 2 },
      { label: "floor center",       x: (quad.tl.x + quad.tr.x + quad.bl.x + quad.br.x) / 4, y: (quad.tl.y + quad.tr.y + quad.bl.y + quad.br.y) / 4 },
    ];

    // 3 actual floor pixels at top-third / mid / bottom-third of mask Y range
    const floorYMin = quad.tl.y, floorYMax = quad.bl.y;
    const targetYs  = [
      floorYMin + (floorYMax - floorYMin) * 0.15,
      floorYMin + (floorYMax - floorYMin) * 0.50,
      floorYMin + (floorYMax - floorYMin) * 0.85,
    ];
    const actualPts: { label: string; x: number; y: number }[] = [];
    for (const ty of targetYs) {
      const row = Math.round(ty);
      for (let col = 0; col < W; col++) {
        if ((surfMask[row * W + col] ?? 0) > 128 && (occMask[row * W + col] ?? 0) <= 128) {
          actualPts.push({ label: `actual floor y≈${row}`, x: col, y: row });
          break;
        }
      }
    }

    function traceUVSample(label: string, x: number, y: number) {
      const { x: rawU, y: rawV } = applyH(h!, Math.round(x), Math.round(y));

      let u = rawU, v = rawV;
      if (doRot) {
        const cu = u - 0.5, cv = v - 0.5;
        u = cosA * cu - sinA * cv + 0.5;
        v = sinA * cu + cosA * cv + 0.5;
      }

      const scaledU = u * sc, scaledV = v * sc;

      // Mirror exactly what sampleBilinear does
      const wrapU = ((scaledU % 1) + 1) % 1;
      const wrapV = ((scaledV % 1) + 1) % 1;
      const texX  = Math.round(wrapU * (texW - 1));
      const texY  = Math.round(wrapV * (texH - 1));

      // Actual sampled colour
      const [sr, sg, sb] = sampleBilinear(texPx, texW, texH, scaledU, scaledV);

      console.log(
        `  ${label.padEnd(22)} imgXY=(${Math.round(x)},${Math.round(y)}) | ` +
        `rawUV=(${rawU.toFixed(4)},${rawV.toFixed(4)}) | ` +
        `×${sc}→(${scaledU.toFixed(4)},${scaledV.toFixed(4)}) | ` +
        `wrap→(${wrapU.toFixed(4)},${wrapV.toFixed(4)}) | ` +
        `texPx=(${texX},${texY}) | ` +
        `rgb=(${Math.round(sr)},${Math.round(sg)},${Math.round(sb)})`,
      );
    }

    console.group(`[PerspectiveRenderer] Texture sampling trace  scale=${sc}  rot=${settings.rotation}°  tex=${texW}×${texH}`);
    console.log("── Geometric reference points ──");
    for (const { label, x, y } of geomPts) traceUVSample(label, x, y);
    console.log("── Actual floor pixels ──");
    for (const { label, x, y } of actualPts) traceUVSample(label, x, y);
    console.groupEnd();
  }

  // Composite to canvas
  const { c, ctx } = newCanvas(W, H);
  ctx.putImageData(new ImageData(result, W, H), 0, 0);

  // ── Slab debug overlay ────────────────────────────────────────────────────────
  if (isDebugSlab && h) {
    const hinv    = invert3x3(h);
    const numCols = Math.ceil(1.001 / slabW);
    const numRows = Math.ceil(1.001 / slabH);

    if (hinv && isSlab) {
      // Random Slabs: col:row label at each slab centre
      const fontSize = Math.max(9, Math.round(W / 90));
      ctx.font         = `bold ${fontSize}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      for (let r = 0; r < numRows; r++) {
        for (let c2 = 0; c2 < numCols; c2++) {
          const { x: ix, y: iy } = applyHInv(hinv, (c2 + 0.5) * slabW, (r + 0.5) * slabH);
          if (ix >= 4 && ix < W - 4 && iy >= 4 && iy < H - 4) {
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillText(`${c2}:${r}`, ix + 1, iy + 1);
            ctx.fillStyle = "white";
            ctx.fillText(`${c2}:${r}`, ix, iy);
          }
        }
      }
    }

    if (hinv && isSequential) {
      // Sequential: rainbow polylines at every slab boundary.
      // Color encodes texU/texV at that boundary (hue = fract(texCoord) * 360).
      // Both sides of a grout line should show texture that matches the line's hue →
      // confirms UV is continuous across the joint.
      const lw = Math.max(2, Math.round(W / 320));
      const fs = Math.max(8, Math.round(W / 110));
      ctx.lineWidth    = lw;
      ctx.font         = `bold ${fs}px monospace`;
      ctx.textBaseline = "middle";

      // Trace a polyline along a UV isocontour.
      // getImgPt(t): t ∈ [0,1] → image-space point along the boundary.
      const drawBoundary = (
        getImgPt: (t: number) => FloorPoint,
        color: string,
        label: string,
        labelT: number,
        align: "center" | "left",
      ) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        let moved = false;
        for (let ti = 0; ti <= 40; ti++) {
          const { x, y } = getImgPt(ti / 40);
          if (x >= 0 && x < W && y >= 0 && y < H) {
            if (!moved) { ctx.moveTo(x, y); moved = true; } else ctx.lineTo(x, y);
          } else if (moved) { ctx.stroke(); ctx.beginPath(); moved = false; }
        }
        if (moved) ctx.stroke();

        const { x: lx, y: ly } = getImgPt(labelT);
        if (lx >= 2 && lx < W - 2 && ly >= 2 && ly < H - 2) {
          ctx.textAlign = align;
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(label, lx + 1, ly + 1);
          ctx.fillStyle = color;
          ctx.fillText(label, lx, ly);
        }
      };

      // Vertical boundaries: rawU = k * slabW  →  texU = k * sc (before wrap)
      for (let k = 1; k < numCols; k++) {
        const uBound = k * slabW;
        const texU   = k * sc;
        const hue    = ((texU % 1) + 1) % 1 * 360;
        const [cr, cg, cb] = hslToRgb(hue, 1.0, 0.5);
        drawBoundary(
          (t) => applyHInv(hinv, uBound, t),
          `rgb(${cr},${cg},${cb})`,
          `U=${texU.toFixed(2)}`,
          0.12,
          "center",
        );
      }

      // Horizontal boundaries: rawV = k * slabH  →  texV = k * sc (before wrap)
      for (let k = 1; k < numRows; k++) {
        const vBound = k * slabH;
        const texV   = k * sc;
        const hue    = ((texV % 1) + 1) % 1 * 360;
        const [cr, cg, cb] = hslToRgb(hue, 1.0, 0.5);
        drawBoundary(
          (t) => applyHInv(hinv, t, vBound),
          `rgb(${cr},${cg},${cb})`,
          `V=${texV.toFixed(2)}`,
          0.04,
          "left",
        );
      }
    }
  }

  // Gloss pass (skipped in UV debug mode)
  if (!isUVDebug && settings.finish === "gloss") {
    const { c: gC, ctx: gCtx } = newCanvas(W, H);
    const grd = gCtx.createLinearGradient(0, 0, W * 0.65, H * 0.65);
    grd.addColorStop(0,    "rgba(255,255,255,0.18)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.06)");
    grd.addColorStop(1,    "rgba(255,255,255,0)");
    gCtx.fillStyle = grd;
    gCtx.fillRect(0, 0, W, H);

    const alpha = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      alpha[i * 4 + 3] = (surfMask[i] ?? 0) > 128 && (occMask[i] ?? 0) <= 128 ? 255 : 0;
    }
    const { c: mC, ctx: mCtx } = newCanvas(W, H);
    mCtx.putImageData(new ImageData(alpha, W, H), 0, 0);
    gCtx.globalCompositeOperation = "destination-in";
    gCtx.drawImage(mC, 0, 0);
    ctx.globalCompositeOperation  = "source-over";
    ctx.drawImage(gC, 0, 0);
  }

  const compositeUrl = c.toDataURL("image/jpeg", 0.93);
  return { compositeUrl };
}
