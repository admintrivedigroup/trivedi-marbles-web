/**
 * Lighting blend utilities for floor texture compositing.
 *
 * Extracted from renderFloorTexture.ts so the blend logic can be
 * tested and tuned independently of the warp pipeline.
 *
 * Strategy:
 *   65% multiply-adjusted marble  — preserves hard cast shadows and the
 *     room's ambient brightness gradient without inventing reflections.
 *   35% soft-light               — lifts mid-tones so the marble doesn't
 *     look flat/chalky under diffuse lighting.
 */

/** Photoshop soft-light blend mode.  src and dst are normalised 0..1. */
export function softLight(src: number, dst: number): number {
  if (src <= 0.5) return dst - (1 - 2 * src) * dst * (1 - dst);
  const d = dst <= 0.25 ? ((16 * dst - 12) * dst + 4) * dst : Math.sqrt(dst);
  return dst + (2 * src - 1) * (d - dst);
}

/**
 * Blend a marble pixel with the original floor pixel.
 *
 * @param mr,mg,mb    Marble colour (0–255)
 * @param pixelLum    Luminance of the original floor at this pixel
 * @param meanLum     Mean floor luminance (normaliser)
 * @param origR,G,B   Original room pixel (0–255) — used for soft-light
 * @returns [r, g, b] blended output (0–255)
 */
export function applyLightingBlend(
  mr: number, mg: number, mb: number,
  pixelLum: number, meanLum: number,
  origR: number, origG: number, origB: number,
): [number, number, number] {
  const norm    = meanLum > 0 ? pixelLum / meanLum : 1;
  // Clamp: marble never drops below 40% brightness (prevents crushed shadows)
  const mFactor = Math.max(0.40, Math.min(1.30, 0.55 * norm + 0.45));

  const softR = softLight(mr / 255, origR / 255) * 255;
  const softG = softLight(mg / 255, origG / 255) * 255;
  const softB = softLight(mb / 255, origB / 255) * 255;

  return [
    Math.max(0, Math.min(255, Math.round(mr * mFactor * 0.65 + softR * 0.35))),
    Math.max(0, Math.min(255, Math.round(mg * mFactor * 0.65 + softG * 0.35))),
    Math.max(0, Math.min(255, Math.round(mb * mFactor * 0.65 + softB * 0.35))),
  ];
}
