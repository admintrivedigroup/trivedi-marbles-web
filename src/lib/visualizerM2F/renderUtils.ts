// Client-side only — Canvas API required.

import { decodeMask, unionMasks, loadImage } from "./maskUtils";
import type { TextureSettings, SlabSettings, RenderMode, PipelineSegment } from "./types";

// ── Canvas helper ─────────────────────────────────────────────────────────────

function newCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Seeded PRNG (Mulberry32) — deterministic marble texture.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Marble texture generator ──────────────────────────────────────────────────

export function generateMarbleTexture(size = 512): string {
  const { c, ctx } = newCanvas(size, size);
  const rng = mulberry32(0xABCDEF);

  // Warm cream base
  ctx.fillStyle = "#F8F2E4";
  ctx.fillRect(0, 0, size, size);

  // Subtle tonal wash
  const grad = ctx.createRadialGradient(size * 0.3, size * 0.35, 0, size * 0.5, size * 0.5, size * 0.9);
  grad.addColorStop(0, "rgba(255,253,244,0.5)");
  grad.addColorStop(1, "rgba(235,220,200,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Primary veins
  for (let v = 0; v < 22; v++) {
    const x0     = rng() * size * 1.5 - size * 0.25;
    const y0     = rng() * size;
    const len    = size * (0.35 + rng() * 1.1);
    const angle  = (rng() - 0.5) * 0.7;
    const alpha  = 0.06 + rng() * 0.2;
    const dark   = rng() > 0.5;
    const lineW  = 0.3 + rng() * 2.4;
    const steps  = 22 + Math.round(rng() * 18);

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i <= steps; i++) {
      const t  = i / steps;
      const w  = Math.sin(t * Math.PI * (2 + rng() * 2) + rng() * 4) * (4 + rng() * 20);
      const px = Math.cos(angle + Math.PI / 2) * w;
      const py = Math.sin(angle + Math.PI / 2) * w;
      ctx.lineTo(
        x0 + Math.cos(angle) * len * t + px,
        y0 + Math.sin(angle) * len * t + py,
      );
    }

    ctx.strokeStyle = dark
      ? `rgba(88,66,52,${alpha})`
      : `rgba(160,138,112,${alpha * 0.55})`;
    ctx.lineWidth = lineW;
    ctx.stroke();
  }

  // Fine secondary veins
  for (let v = 0; v < 35; v++) {
    const x0    = rng() * size * 1.6 - size * 0.3;
    const y0    = rng() * size;
    const len   = size * (0.1 + rng() * 0.5);
    const angle = (rng() - 0.5) * 1.0;
    const alpha = 0.03 + rng() * 0.09;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const steps = 10 + Math.round(rng() * 10);
    for (let i = 1; i <= steps; i++) {
      const t  = i / steps;
      const w  = Math.sin(t * Math.PI * 3 + rng() * 5) * (2 + rng() * 8);
      const px = Math.cos(angle + Math.PI / 2) * w;
      const py = Math.sin(angle + Math.PI / 2) * w;
      ctx.lineTo(
        x0 + Math.cos(angle) * len * t + px,
        y0 + Math.sin(angle) * len * t + py,
      );
    }
    ctx.strokeStyle = `rgba(100,80,60,${alpha})`;
    ctx.lineWidth   = 0.2 + rng() * 0.8;
    ctx.stroke();
  }

  // Grain noise
  const imgData = ctx.getImageData(0, 0, size, size);
  const { data } = imgData;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 9;
    data[i]!     = clamp(data[i]!     + n);
    data[i + 1]! = clamp(data[i + 1]! + n * 0.85);
    data[i + 2]! = clamp(data[i + 2]! + n * 0.65);
  }
  ctx.putImageData(imgData, 0, 0);
  return c.toDataURL("image/jpeg", 0.93);
}

// ── Segmentation overlay ─────────────────────────────────────────────────────

export async function generateSegOverlay(
  originalDataUrl: string,
  segments:        { label: string; maskBase64: string }[],
  getLabelColorFn: (label: string) => [number, number, number],
  W:               number,
  H:               number,
): Promise<string> {
  const origImg = await loadImage(originalDataUrl);
  const { c, ctx } = newCanvas(W, H);
  ctx.drawImage(origImg, 0, 0, W, H);

  for (const seg of segments) {
    const [r, g, b] = getLabelColorFn(seg.label);
    const mask      = await decodeMask(seg.maskBase64, W, H);

    const overlay = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      if ((mask[i] ?? 0) > 128) {
        overlay[i * 4]     = r;
        overlay[i * 4 + 1] = g;
        overlay[i * 4 + 2] = b;
        overlay[i * 4 + 3] = 150;
      }
    }

    const { c: tmp, ctx: tmpCtx } = newCanvas(W, H);
    tmpCtx.putImageData(new ImageData(overlay, W, H), 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }

  return c.toDataURL("image/jpeg", 0.9);
}

// ── Marble surface renderer ──────────────────────────────────────────────────

export type RenderJob = {
  originalDataUrl:   string;
  textureDataUrl:    string;
  surfaceMaskBases:  string[];  // union → surface region
  occluderMaskBases: string[];  // union → preserve original pixels
  settings:          TextureSettings;
  width:             number;
  height:            number;
  renderMode?:        RenderMode;    // "slab" (default) | "repeat"
  slabSettings?:      SlabSettings;
  /** Debug: replace texture with (U=red, V=green) gradient to verify UV mapping. */
  debugUV?:           boolean;
  /** Debug: replace texture with 8×8 checkerboard drawn from raw UV — no scale/rotation — to verify perspective compression is visible. */
  debugCheckerboard?: boolean;
  /** Debug: color each slab distinctly and label col:row. */
  debugSlab?:         boolean;
  /** All Mask2Former segments (not just surface/occluder) — used by perspectiveRenderer to find window/fixture segments for the art-directed specular highlight. */
  segments?:          PipelineSegment[];
  /** Depth Anything V2 grayscale output (base64, no data: prefix) — secondary signal for the specular highlight's intensity. */
  depthBase64?:       string | null;
};

const MAX_DIM = 1280;

export async function renderMarbleOnSurface(job: RenderJob): Promise<string> {
  const { originalDataUrl, textureDataUrl, surfaceMaskBases, occluderMaskBases, settings, width, height } = job;

  // Cap resolution for performance while keeping quality
  const scale = Math.min(1, MAX_DIM / Math.max(width || 1, height || 1));
  const W = Math.max(1, Math.round(width  * scale));
  const H = Math.max(1, Math.round(height * scale));

  // ── 1. Original pixels ─────────────────────────────────────────────────────
  const origImg = await loadImage(originalDataUrl);
  const { ctx: origCtx } = newCanvas(W, H);
  origCtx.drawImage(origImg, 0, 0, W, H);
  const origPx = origCtx.getImageData(0, 0, W, H).data;

  // ── 2. Tiled + rotated texture ─────────────────────────────────────────────
  const texImg = await loadImage(textureDataUrl);
  const patSize = Math.max(32, Math.round(256 * settings.scale));

  const { c: patC, ctx: patCtx } = newCanvas(patSize, patSize);
  patCtx.save();
  patCtx.translate(patSize / 2, patSize / 2);
  patCtx.rotate((settings.rotation * Math.PI) / 180);
  patCtx.drawImage(texImg, -patSize / 2, -patSize / 2, patSize, patSize);
  patCtx.restore();

  const { ctx: texCtx } = newCanvas(W, H);
  const pattern = texCtx.createPattern(patC, "repeat")!;
  texCtx.fillStyle = pattern;
  texCtx.fillRect(0, 0, W, H);
  const texPx = texCtx.getImageData(0, 0, W, H).data;

  // ── 3. Decode masks ────────────────────────────────────────────────────────
  const [surfaceMasks, occluderMasks] = await Promise.all([
    Promise.all(surfaceMaskBases.map((b) => decodeMask(b, W, H))),
    Promise.all(occluderMaskBases.map((b) => decodeMask(b, W, H))),
  ]);
  const surfaceMask  = unionMasks(surfaceMasks);
  const occluderMask = unionMasks(occluderMasks);

  // ── 4. Pixel-level composite ───────────────────────────────────────────────
  const br     = settings.brightness;
  const op     = settings.opacity;
  const result = new Uint8ClampedArray(W * H * 4);

  for (let i = 0; i < W * H; i++) {
    const ri         = i * 4;
    const onSurface  = (surfaceMask[i]  ?? 0) > 128;
    const isOccluder = (occluderMask[i] ?? 0) > 128;

    if (onSurface && !isOccluder) {
      result[ri]     = clamp(texPx[ri]!     * br * op + origPx[ri]!     * (1 - op));
      result[ri + 1] = clamp(texPx[ri + 1]! * br * op + origPx[ri + 1]! * (1 - op));
      result[ri + 2] = clamp(texPx[ri + 2]! * br * op + origPx[ri + 2]! * (1 - op));
    } else {
      result[ri]     = origPx[ri]!;
      result[ri + 1] = origPx[ri + 1]!;
      result[ri + 2] = origPx[ri + 2]!;
    }
    result[ri + 3] = 255;
  }

  // ── 5. Put composite + optional gloss ─────────────────────────────────────
  const { c, ctx } = newCanvas(W, H);
  ctx.putImageData(new ImageData(result, W, H), 0, 0);

  if (settings.finish === "gloss") {
    // Build a clipped gloss overlay on the surface region only
    const { c: glossC, ctx: glossCtx } = newCanvas(W, H);

    // Diagonal specular gradient
    const grd = glossCtx.createLinearGradient(0, 0, W * 0.65, H * 0.65);
    grd.addColorStop(0,    "rgba(255,255,255,0.18)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.06)");
    grd.addColorStop(1,    "rgba(255,255,255,0)");
    glossCtx.fillStyle = grd;
    glossCtx.fillRect(0, 0, W, H);

    // Clip to surface pixels only
    const maskAlpha = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const active = (surfaceMask[i]  ?? 0) > 128 && (occluderMask[i] ?? 0) <= 128;
      maskAlpha[i * 4 + 3] = active ? 255 : 0;
    }
    const { c: maskC, ctx: maskCtx } = newCanvas(W, H);
    maskCtx.putImageData(new ImageData(maskAlpha, W, H), 0, 0);

    glossCtx.globalCompositeOperation = "destination-in";
    glossCtx.drawImage(maskC, 0, 0);

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(glossC, 0, 0);
  }

  return c.toDataURL("image/jpeg", 0.93);
}
