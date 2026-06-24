/**
 * Slab image loading and tiled-texture generation for floor projection.
 *
 * Tile layout: N_X × N_Y tiles with GROUT_PX-wide grout joints.
 * Bookmatch mode: each tile is [slab | mirror(slab)] horizontally,
 * giving exact pixel-level mirror symmetry — no AI involved.
 */

const GROUT_COLOR = "#9e9b97"; // dark-ish warm gray

// ─── Image loading ────────────────────────────────────────────────────────────

/**
 * Fetch image from any URL (including Cloudinary) via fetch() → blob URL
 * to sidestep canvas CORS tainting.
 */
export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch slab image (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Failed to decode slab image")); };
    img.src = blobUrl;
  });
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load room photo")); };
    img.src = url;
  });
}

// ─── Tiled texture builder ────────────────────────────────────────────────────

export type TileOptions = {
  tilesX: number;   // number of tile columns
  tilesY: number;   // number of tile rows
  groutPx: number;  // grout joint width in pixels
  bookmatch: boolean;
};

/**
 * Build a tiled marble texture at (textureW × textureH) resolution.
 * Uses only real slab pixels — no AI generation of any kind.
 *
 * In normal mode:   each tile = slab image scaled to tile dimensions.
 * In bookmatch mode: each tile = [slab | mirror(slab)] side by side,
 *                    exact pixel-level reflection.
 */
export function buildTiledTexture(
  slabImg: HTMLImageElement,
  textureW: number,
  textureH: number,
  opts: TileOptions,
): ImageData {
  const { tilesX, tilesY, groutPx, bookmatch } = opts;

  const canvas = document.createElement("canvas");
  canvas.width  = textureW;
  canvas.height = textureH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Fill with grout color
  ctx.fillStyle = GROUT_COLOR;
  ctx.fillRect(0, 0, textureW, textureH);

  // Tile pixel dimensions
  const tileW = Math.floor((textureW - (tilesX - 1) * groutPx) / tilesX);
  const tileH = Math.floor((textureH - (tilesY - 1) * groutPx) / tilesY);
  if (tileW <= 0 || tileH <= 0) return ctx.getImageData(0, 0, textureW, textureH);

  // Build the single tile canvas once (reused for all tiles)
  const tileCanvas = buildOneTile(slabImg, tileW, tileH, bookmatch);

  for (let row = 0; row < tilesY; row++) {
    for (let col = 0; col < tilesX; col++) {
      const x = col * (tileW + groutPx);
      const y = row * (tileH + groutPx);
      ctx.drawImage(tileCanvas, x, y, tileW, tileH);
    }
  }

  return ctx.getImageData(0, 0, textureW, textureH);
}

function buildOneTile(
  slabImg: HTMLImageElement,
  tileW: number,
  tileH: number,
  bookmatch: boolean,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width  = tileW;
  c.height = tileH;
  const ctx = c.getContext("2d")!;

  if (bookmatch) {
    // Left half: normal slab
    const halfW = tileW / 2;
    ctx.drawImage(slabImg, 0, 0, halfW, tileH);
    // Right half: exact pixel mirror of left half
    ctx.save();
    ctx.translate(tileW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(slabImg, 0, 0, halfW, tileH);
    ctx.restore();
  } else {
    ctx.drawImage(slabImg, 0, 0, tileW, tileH);
  }

  return c;
}
