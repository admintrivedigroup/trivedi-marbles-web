/**
 * Slab image loading utilities.
 *
 * Texture generation (buildTiledTexture, TextureMode, TileOptions) has been
 * moved to textureGenerator.ts.  They are re-exported here so existing import
 * sites remain unchanged.
 */

export { buildTiledTexture, type TextureMode, type TileOptions } from "./textureGenerator";

// ─── Image loading ────────────────────────────────────────────────────────────

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch slab image (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(blobUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Failed to decode slab image")); };
    img.src = blobUrl;
  });
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load room photo")); };
    img.src = url;
  });
}
