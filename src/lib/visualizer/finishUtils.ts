/**
 * Floor finish post-processing — Phase 6.
 *
 * Applies brightness and matte/gloss finish to an already-rendered marble
 * composite WITHOUT re-running segmentation or texture projection.
 *
 * Uses the feather mask (a grayscale PNG where white = solid floor, black =
 * original room, grey = feathered edge) produced by renderFloorLocally.
 *
 * Per-pixel transform for floor pixels (feather > 0):
 *   1. Brightness: multiply by 2^(EV/5)  → EV=+5 ≈ 2×, EV=-5 ≈ 0.5×
 *   2. Finish:
 *      "matte" — desaturate -8%, contrast ×0.94 (flat, diffuse look)
 *      "gloss" — saturate +8%, boost highlights above 0.65 luminance by up to 12%
 *
 * Typical runtime: <80 ms for a 1920×1080 composite.
 */

import { loadImageFromDataUrl } from "./bookmatch";

export type FinishMode = "matte" | "gloss";

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Apply brightness and finish post-processing to a marble composite.
 *
 * @param compositeDataUrl  The base render (data URL JPEG from renderFloorLocally).
 * @param featherDataUrl    Grayscale PNG where R=feather value*255 (same W×H as composite).
 * @param brightnessEV      Brightness adjustment -5 to +5.  0 = no change.
 * @param finish            "matte" | "gloss".
 * @returns                 New composite data URL (JPEG 0.92).
 */
export async function applyFloorFinish(
  compositeDataUrl: string,
  featherDataUrl:   string,
  brightnessEV:     number,
  finish:           FinishMode,
): Promise<string> {
  const [comp, feath] = await Promise.all([
    loadImageFromDataUrl(compositeDataUrl),
    loadImageFromDataUrl(featherDataUrl),
  ]);

  const W = comp.naturalWidth;
  const H = comp.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Read composite pixels
  ctx.drawImage(comp, 0, 0, W, H);
  const compData = ctx.getImageData(0, 0, W, H);

  // Read feather mask at the same size (resamples if needed)
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(feath, 0, 0, W, H);
  const feathPx = ctx.getImageData(0, 0, W, H).data;

  const brightFactor = Math.pow(2, brightnessEV / 5); // EV±5 → ×0.5 or ×2
  const isNoop       = brightnessEV === 0 && finish === "gloss"; // gloss is the default

  if (!isNoop) {
    for (let i = 0; i < W * H; i++) {
      const fv = feathPx[i * 4] / 255; // feather: 0=room, 1=solid floor
      if (fv <= 0) continue;

      let r = compData.data[i * 4];
      let g = compData.data[i * 4 + 1];
      let b = compData.data[i * 4 + 2];

      // Brightness
      if (brightFactor !== 1) {
        r = Math.min(255, r * brightFactor);
        g = Math.min(255, g * brightFactor);
        b = Math.min(255, b * brightFactor);
      }

      // Finish
      if (finish === "matte") {
        [r, g, b] = adjustSaturation(r, g, b, 0.92);
        [r, g, b] = adjustContrast(r, g, b, 0.94);
      } else {
        // Gloss: slight saturation + highlight brightening
        [r, g, b] = adjustSaturation(r, g, b, 1.08);
        [r, g, b] = boostHighlights(r, g, b, 0.65, 0.12);
      }

      // For feathered border pixels: blend adjusted vs original proportionally.
      // This preserves the edge blend against the original room.
      if (fv < 1) {
        r = compData.data[i * 4]     * (1 - fv) + r * fv;
        g = compData.data[i * 4 + 1] * (1 - fv) + g * fv;
        b = compData.data[i * 4 + 2] * (1 - fv) + b * fv;
      }

      compData.data[i * 4]     = Math.round(r);
      compData.data[i * 4 + 1] = Math.round(g);
      compData.data[i * 4 + 2] = Math.round(b);
    }
  }

  ctx.putImageData(compData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// ─── Per-pixel adjustments ────────────────────────────────────────────────────

/** Adjust saturation around the per-channel average (luminance-preserving). */
function adjustSaturation(
  r: number, g: number, b: number, factor: number,
): [number, number, number] {
  const avg = (r + g + b) / 3;
  return [
    clamp(avg + (r - avg) * factor),
    clamp(avg + (g - avg) * factor),
    clamp(avg + (b - avg) * factor),
  ];
}

/** Adjust contrast by scaling around the mid-point (128). */
function adjustContrast(
  r: number, g: number, b: number, factor: number,
): [number, number, number] {
  return [
    clamp(128 + (r - 128) * factor),
    clamp(128 + (g - 128) * factor),
    clamp(128 + (b - 128) * factor),
  ];
}

/**
 * Brighten pixels whose luminance exceeds `threshold`.
 * Boost ramps linearly from 0 at the threshold to `maxBoost` at full white.
 * Simulates increased specular reflectance without inventing fake geometry.
 */
function boostHighlights(
  r: number, g: number, b: number,
  threshold: number, maxBoost: number,
): [number, number, number] {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= threshold) return [r, g, b];
  const t     = (lum - threshold) / (1 - threshold); // 0→1 across the highlight range
  const boost = 1 + t * maxBoost;
  return [clamp(r * boost), clamp(g * boost), clamp(b * boost)];
}

function clamp(v: number): number {
  return Math.min(255, Math.max(0, v));
}
