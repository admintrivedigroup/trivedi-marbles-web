/**
 * Marble texture canvas generation — Phase 5 texture projection engine.
 *
 * Render modes:
 *   "continuous"  — slab scaled to fill the entire canvas; veins flow
 *                   uninterrupted.  Grout grid overlaid.
 *   "tile"        — N×M repeated slab copies with grout between them.
 *   "bookmatch"   — [slab | flipX(slab)] — 2-slab horizontal mirror.
 *   "bookmatch4"  — 2×2 four-way mirror: TL=orig, TR=flipX, BL=flipY,
 *                   BR=flipXY.  Creates a full symmetric medallion pattern.
 *
 * Grout lines are always drawn in top-down (texture) space BEFORE homography
 * warping, so they converge naturally toward the vanishing point.
 *
 * Rotation and scale are applied as UV-space transforms inside the per-pixel
 * warp loop in renderFloorTexture.ts — not here — so there is no edge-bleed
 * at canvas boundaries.
 */

const DEFAULT_GROUT_COLOR = "#9e9b97";

export type TextureMode = "continuous" | "tile" | "bookmatch" | "bookmatch4";

export type TileOptions = {
  tilesX:      number;
  tilesY:      number;
  groutPx:     number;
  mode?:       TextureMode;  // default: "continuous"
  groutColor?: string;       // default: DEFAULT_GROUT_COLOR
};

/**
 * Build the marble texture canvas at (textureW × textureH) resolution.
 * Returns ImageData ready for homography-based pixel sampling.
 */
export function buildTiledTexture(
  slabImg:  HTMLImageElement,
  textureW: number,
  textureH: number,
  opts:     TileOptions,
): ImageData {
  const { tilesX, tilesY, groutPx, mode = "continuous", groutColor = DEFAULT_GROUT_COLOR } = opts;

  const canvas = document.createElement("canvas");
  canvas.width  = textureW;
  canvas.height = textureH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (mode === "continuous") {
    // One large slab — veins flow uninterrupted across the full canvas
    ctx.drawImage(slabImg, 0, 0, textureW, textureH);
    overlayGroutGrid(ctx, textureW, textureH, tilesX, tilesY, groutPx, groutColor);

  } else if (mode === "bookmatch") {
    // [slab | flipX(slab)] — horizontal 2-slab mirror
    const halfW = textureW / 2;
    ctx.drawImage(slabImg, 0, 0, halfW, textureH);
    ctx.save();
    ctx.translate(textureW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(slabImg, 0, 0, halfW, textureH);
    ctx.restore();
    overlayGroutGrid(ctx, textureW, textureH, tilesX, tilesY, groutPx, groutColor);

  } else if (mode === "bookmatch4") {
    // Four-way mirror — 2×2 quadrant layout:
    //   TL = original slab       TR = flipX
    //   BL = flipY               BR = flipXY
    // tilesX / tilesY should be even so grout lands on quadrant seams.
    const halfW = textureW / 2;
    const halfH = textureH / 2;

    // TL — original
    ctx.drawImage(slabImg, 0, 0, halfW, halfH);

    // TR — flipX
    ctx.save();
    ctx.translate(textureW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(slabImg, 0, 0, halfW, halfH);
    ctx.restore();

    // BL — flipY
    ctx.save();
    ctx.translate(0, textureH);
    ctx.scale(1, -1);
    ctx.drawImage(slabImg, 0, 0, halfW, halfH);
    ctx.restore();

    // BR — flipXY
    ctx.save();
    ctx.translate(textureW, textureH);
    ctx.scale(-1, -1);
    ctx.drawImage(slabImg, 0, 0, halfW, halfH);
    ctx.restore();

    overlayGroutGrid(ctx, textureW, textureH, tilesX, tilesY, groutPx, groutColor);

  } else {
    // Tile mode: N×M repeated copies with grout gaps between them
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, textureW, textureH);

    const tileW = Math.floor((textureW - (tilesX - 1) * groutPx) / tilesX);
    const tileH = Math.floor((textureH - (tilesY - 1) * groutPx) / tilesY);
    if (tileW <= 0 || tileH <= 0) return ctx.getImageData(0, 0, textureW, textureH);

    for (let row = 0; row < tilesY; row++) {
      for (let col = 0; col < tilesX; col++) {
        const x = col * (tileW + groutPx);
        const y = row * (tileH + groutPx);
        ctx.drawImage(slabImg, x, y, tileW, tileH);
      }
    }
  }

  return ctx.getImageData(0, 0, textureW, textureH);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Draw a grout grid over an already-painted canvas.
 * Lines are evenly spaced and centred at each tile boundary.
 * For bookmatch4 with an even tilesX/tilesY, lines land on the quadrant seams.
 */
function overlayGroutGrid(
  ctx:        CanvasRenderingContext2D,
  textureW:   number,
  textureH:   number,
  tilesX:     number,
  tilesY:     number,
  groutPx:    number,
  groutColor: string = DEFAULT_GROUT_COLOR,
): void {
  if (groutPx <= 0 || tilesX <= 0 || tilesY <= 0) return;

  ctx.fillStyle = groutColor;
  const half     = Math.floor(groutPx / 2);
  const colStep  = textureW / tilesX;
  const rowStep  = textureH / tilesY;

  for (let col = 1; col < tilesX; col++) {
    ctx.fillRect(Math.round(col * colStep) - half, 0, groutPx, textureH);
  }
  for (let row = 1; row < tilesY; row++) {
    ctx.fillRect(0, Math.round(row * rowStep) - half, textureW, groutPx);
  }
}
