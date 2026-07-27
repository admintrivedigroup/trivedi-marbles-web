// Client-side only — Canvas API required.
//
// Production copy of src/app/debug/combined-visualizer-test/_lib/perspectiveRenderer.ts,
// split into a geometry stage and a texture stage so RoomCache (renderFromCache.ts) can
// cache the expensive half (mask decode/union, largest-CC, quad, homography) across slab
// swaps and texture-setting changes. No algorithm changes from the debug version — the
// debug page keeps calling its own original, unmodified, standalone copy.
//
// Algorithm (unchanged):
//   1. Find the largest connected component of the floor mask (BFS)
//   2. Row-scan the CC to extract a perspective quadrilateral
//   3. Solve the 8-DOF homography (image pixels → normalised UV) via Gaussian elimination
//   4. For each floor pixel: map to UV, tile with scale/rotation, bilinear-sample the texture
//   5. Preserve occluder pixels on top
//   6. Build a debug overlay showing the CC tint, quad outline, and corner labels

import { decodeMask, unionMasks, loadImage } from "@/app/debug/combined-visualizer-test/_lib/maskUtils";
import type { RenderJob } from "@/app/debug/combined-visualizer-test/_lib/renderUtils";
import type { SlabSettings } from "@/app/debug/combined-visualizer-test/_lib/types";
import { DEFAULT_SLAB_SETTINGS } from "@/app/debug/combined-visualizer-test/_lib/types";

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

function computeSlabParams(col: number, row: number, randomize: boolean): SlabCachedParams {
  const rng = makeSlabRng(col, row);
  const r0 = rng(), r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng();
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
  cache:    Map<number, SlabCachedParams>,
): SlabCachedParams {
  const key  = ((col & 0x7FFF) | ((row & 0x7FFF) << 15)) >>> 0;
  const hit  = cache.get(key);
  if (hit) return hit;
  const p = computeSlabParams(col, row, randomize);
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
  job: Pick<RenderJob, "originalDataUrl" | "surfaceMaskBases" | "occluderMaskBases" | "width" | "height">,
): Promise<FloorGeometry> {
  const { originalDataUrl, surfaceMaskBases, occluderMaskBases, width, height } = job;

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

  return { W, H, origPx, surfMask, occMask, cc, quad, h, debugUrl };
}

// ── Texture stage: geometry + slab texture + settings → composite ────────────

export async function renderTextureFromGeometry(
  geometry: FloorGeometry,
  job: Pick<RenderJob, "textureDataUrl" | "settings" | "renderMode" | "slabSettings" | "debugUV" | "debugCheckerboard" | "debugSlab">,
): Promise<{ compositeUrl: string }> {
  const { textureDataUrl, settings } = job;
  const isUVDebug      = job.debugUV          === true;
  const isCheckerboard = job.debugCheckerboard === true;

  const { W, H, origPx, surfMask, occMask, h, quad } = geometry;

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
          result[ri]     = clamp(jointRgb[0]! * op + origPx[ri]!     * (1 - op));
          result[ri + 1] = clamp(jointRgb[1]! * op + origPx[ri + 1]! * (1 - op));
          result[ri + 2] = clamp(jointRgb[2]! * op + origPx[ri + 2]! * (1 - op));
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
          result[ri]     = clamp(tr * brt * op + origPx[ri]!     * (1 - op));
          result[ri + 1] = clamp(tg * brt * op + origPx[ri + 1]! * (1 - op));
          result[ri + 2] = clamp(tb * brt * op + origPx[ri + 2]! * (1 - op));
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
            const p = getOrMakeSlabParams(col, row, slabCfg.randomize, slabCache);

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
            result[ri]     = clamp(tr * totalBrt * op + origPx[ri]!     * (1 - op));
            result[ri + 1] = clamp(tg * totalBrt * op + origPx[ri + 1]! * (1 - op));
            result[ri + 2] = clamp(tb * totalBrt * op + origPx[ri + 2]! * (1 - op));
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

        result[ri]     = clamp(tr * brt * op + origPx[ri]!     * (1 - op));
        result[ri + 1] = clamp(tg * brt * op + origPx[ri + 1]! * (1 - op));
        result[ri + 2] = clamp(tb * brt * op + origPx[ri + 2]! * (1 - op));
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
