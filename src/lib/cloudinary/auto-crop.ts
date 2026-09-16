export type CropBox = { x: number; y: number; width: number; height: number };

const DEFAULT_BOX: CropBox = { x: 0.04, y: 0.04, width: 0.92, height: 0.92 };

const WORK_SIZE = 240;
const MARGIN_FRACTION = 0.06;
const EDGE_RUN = 3;

/**
 * Guesses the slab's bounding box inside a warehouse photo by looking for the
 * high-frequency, high-contrast texture of stone against a comparatively flat
 * floor/wall background. Runs entirely on canvas — no network call, no cost.
 * Always returns a usable box (falls back to a centered inset) since the
 * result is only a starting point for manual adjustment in the crop dialog.
 */
export async function detectSlabCropBox(img: HTMLImageElement): Promise<CropBox> {
  try {
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) return DEFAULT_BOX;

    const scale = Math.min(1, WORK_SIZE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DEFAULT_BOX;
    ctx.drawImage(img, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    const energy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx = gray[idx + 1] - gray[idx - 1];
        const gy = gray[idx + w] - gray[idx - w];
        energy[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    const rowEnergy = new Float32Array(h);
    const colEnergy = new Float32Array(w);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x < w; x++) sum += energy[y * w + x];
      rowEnergy[y] = sum / w;
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y < h; y++) sum += energy[y * w + x];
      colEnergy[x] = sum / h;
    }

    const my = Math.max(1, Math.round(h * MARGIN_FRACTION));
    const mx = Math.max(1, Math.round(w * MARGIN_FRACTION));

    const rowThreshold = baseline(rowEnergy, my) * 1.8 + 2;
    const colThreshold = baseline(colEnergy, mx) * 1.8 + 2;

    let top = findEdge(rowEnergy, rowThreshold, true);
    let bottom = findEdge(rowEnergy, rowThreshold, false);
    let left = findEdge(colEnergy, colThreshold, true);
    let right = findEdge(colEnergy, colThreshold, false);

    if (top < 0 || bottom < 0 || top >= bottom) {
      top = Math.round(h * 0.04);
      bottom = Math.round(h * 0.96);
    }
    if (left < 0 || right < 0 || left >= right) {
      left = Math.round(w * 0.04);
      right = Math.round(w * 0.96);
    }

    const box: CropBox = {
      x: left / w,
      y: top / h,
      width: (right - left) / w,
      height: (bottom - top) / h,
    };

    if (box.width < 0.3 || box.height < 0.3) return DEFAULT_BOX;
    return box;
  } catch {
    return DEFAULT_BOX;
  }
}

function baseline(arr: Float32Array, margin: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < margin; i++) {
    sum += arr[i];
    n++;
  }
  for (let i = arr.length - margin; i < arr.length; i++) {
    sum += arr[i];
    n++;
  }
  return n > 0 ? sum / n : 0;
}

function findEdge(arr: Float32Array, threshold: number, fromStart: boolean): number {
  const n = arr.length;
  if (fromStart) {
    for (let i = 0; i < n - EDGE_RUN; i++) {
      let ok = true;
      for (let k = 0; k < EDGE_RUN; k++) {
        if (arr[i + k] < threshold) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
  } else {
    for (let i = n - 1; i >= EDGE_RUN; i--) {
      let ok = true;
      for (let k = 0; k < EDGE_RUN; k++) {
        if (arr[i - k] < threshold) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
  }
  return -1;
}

const MAX_DIMENSION = 2048;
const OUTPUT_QUALITY = 0.85;
const TARGET_BYTES = 4 * 1024 * 1024;

/** Crops `img` to `box` (fractions of the full image) at native resolution and re-encodes as JPEG. */
export function cropImageToFile(img: HTMLImageElement, box: CropBox, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const sx = Math.round(box.x * img.naturalWidth);
    const sy = Math.round(box.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(box.width * img.naturalWidth));
    const sh = Math.max(1, Math.round(box.height * img.naturalHeight));

    let outW = sw;
    let outH = sh;
    if (outW > MAX_DIMENSION || outH > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / outW, MAX_DIMENSION / outH);
      outW = Math.round(outW * ratio);
      outH = Math.round(outH * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas not supported"));
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const encode = (quality: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Crop failed"));
            return;
          }
          if (blob.size > TARGET_BYTES && quality > 0.5) {
            encode(quality - 0.2);
            return;
          }
          resolve(new File([blob], fileName.replace(/\.[^.]+$/, "-cropped.jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };

    encode(OUTPUT_QUALITY);
  });
}
