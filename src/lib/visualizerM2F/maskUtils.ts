// Client-side only — requires Canvas API (browser).

function newCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width  = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Decode a grayscale mask PNG (base64, no data: prefix) → Uint8Array of brightness values.
// Scales the mask to [w × h] in case dimensions differ from the original image.
export async function decodeMask(maskBase64: string, w: number, h: number): Promise<Uint8Array> {
  const img = await loadImage(`data:image/png;base64,${maskBase64}`);
  const { ctx } = newCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * 4]!; // red channel = brightness
  return out;
}

// Union of multiple masks — any pixel > 128 in any mask → 255 in output.
export function unionMasks(masks: Uint8Array[]): Uint8Array {
  if (masks.length === 0) return new Uint8Array(0);
  const out = new Uint8Array(masks[0]!.length);
  for (const mask of masks) {
    for (let i = 0; i < out.length; i++) {
      if ((mask[i] ?? 0) > 128) out[i] = 255;
    }
  }
  return out;
}

// Render a mask visualisation: selected region highlighted, rest darkened.
export async function renderMaskHighlight(
  originalDataUrl: string,
  maskBases:        string[],
  color:            [number, number, number],
  W:                number,
  H:                number,
): Promise<string> {
  const origImg = await loadImage(originalDataUrl);
  const { c, ctx } = newCanvas(W, H);
  ctx.drawImage(origImg, 0, 0, W, H);
  const origPixels = ctx.getImageData(0, 0, W, H).data;

  const masks = await Promise.all(maskBases.map((b) => decodeMask(b, W, H)));
  const union = unionMasks(masks);

  const [r, g, b] = color;
  const result = new Uint8ClampedArray(W * H * 4);

  for (let i = 0; i < W * H; i++) {
    const ri     = i * 4;
    const active = (union[i] ?? 0) > 128;
    if (active) {
      result[ri]     = Math.round(origPixels[ri]!     * 0.35 + r * 0.65);
      result[ri + 1] = Math.round(origPixels[ri + 1]! * 0.35 + g * 0.65);
      result[ri + 2] = Math.round(origPixels[ri + 2]! * 0.35 + b * 0.65);
    } else {
      result[ri]     = Math.round(origPixels[ri]!     * 0.45);
      result[ri + 1] = Math.round(origPixels[ri + 1]! * 0.45);
      result[ri + 2] = Math.round(origPixels[ri + 2]! * 0.45);
    }
    result[ri + 3] = 255;
  }

  ctx.putImageData(new ImageData(result, W, H), 0, 0);
  return c.toDataURL("image/jpeg", 0.88);
}
