/**
 * World-space floor UV mapping — preserves slab proportions.
 *
 * Given normalised floor coordinates (fx, fy) ∈ [0,1] (output of
 * computeHomography(floorQuad → unitQuad)), returns the UV to sample
 * in the original slab image plus a grout flag.
 *
 * Why this matters:
 *   The previous approach pre-tiled the slab image into a fixed 2048×2048
 *   canvas (buildTiledTexture), then mapped that canvas to the floor quad via
 *   a homography.  The canvas tiling squished the slab into equal square grid
 *   cells — destroying the slab's real aspect ratio.
 *
 *   This module computes UV in world (floor) space.  Every tile gets exactly
 *   [0,1]×[0,1] of the slab image at its natural dimensions, so proportions
 *   and vein direction are always preserved regardless of slab size or floor
 *   aspect ratio.
 *
 * Grout convergence:
 *   Because UV is computed per-pixel from the perspective-correct homography,
 *   grout lines automatically converge to the vanishing point — closer tiles
 *   have wider grout in screen space, far tiles have narrower grout.  This is
 *   physically correct (same physical width everywhere, just foreshortened).
 */

import type { TextureMode } from "./textureGenerator";

export type SlabUVParams = {
  /** Floor width / slab width — total slab columns across the floor. */
  tilesAcross: number;
  /** Floor depth / slab height — total slab rows across the floor. */
  tilesDeep:   number;
  mode:        TextureMode;
  /** Half-width of grout joint in normalised U [0,1].  0 = no grout. */
  groutHalfU:  number;
  /** Half-height of grout joint in normalised V [0,1].  0 = no grout. */
  groutHalfV:  number;
  cosR:        number;   // cos(rotationDeg)
  sinR:        number;   // sin(rotationDeg)
  scaleFactor: number;   // > 1 → tiles appear larger
};

/**
 * Convert normalised floor coordinates to slab texture UV.
 *
 * @param fx  Normalised floor X ∈ [0,1] — left to right edge of floor quad.
 * @param fy  Normalised floor Y ∈ [0,1] — back (far) to front (near camera).
 * @returns   { u, v } ∈ [0,1] for sampling the slab image, and isGrout flag.
 */
export function floorUV(
  fx: number,
  fy: number,
  p:  SlabUVParams,
): { u: number; v: number; isGrout: boolean } {
  // ── Scale + rotate in floor space (around floor centre [0.5, 0.5]) ──────────
  let dx = (fx - 0.5) / p.scaleFactor;
  let dy = (fy - 0.5) / p.scaleFactor;
  if (p.cosR !== 1 || p.sinR !== 0) {
    const rx = p.cosR * dx - p.sinR * dy;
    const ry = p.sinR * dx + p.cosR * dy;
    dx = rx; dy = ry;
  }
  fx = dx + 0.5;
  fy = dy + 0.5;

  // ── Tile counts: "continuous" shows one slab across the entire floor ─────────
  const ta = p.mode === "continuous" ? 1 : p.tilesAcross;
  const td = p.mode === "continuous" ? 1 : p.tilesDeep;

  // ── Position in slab units ───────────────────────────────────────────────────
  const slabU  = fx * ta;
  const slabV  = fy * td;
  const colIdx = Math.floor(slabU);
  const rowIdx = Math.floor(slabV);
  const fracU  = slabU - colIdx;
  const fracV  = slabV - rowIdx;

  // ── Grout check ──────────────────────────────────────────────────────────────
  const isGrout = p.groutHalfU > 0 && (
    fracU < p.groutHalfU || fracU > 1 - p.groutHalfU ||
    fracV < p.groutHalfV || fracV > 1 - p.groutHalfV
  );

  // ── Within-slab UV — apply bookmatch mirroring ───────────────────────────────
  let u = fracU;
  let v = fracV;

  if (p.mode === "bookmatch" || p.mode === "bookmatch4") {
    // Mirror odd columns (creates left-right symmetric pairs)
    if (((colIdx % 2) + 2) % 2 === 1) u = 1 - u;
  }
  if (p.mode === "bookmatch4") {
    // Mirror odd rows (creates 4-way symmetric medallion)
    if (((rowIdx % 2) + 2) % 2 === 1) v = 1 - v;
  }

  return { u, v, isGrout };
}
