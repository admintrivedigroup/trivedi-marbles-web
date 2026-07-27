/**
 * Occlusion mask utilities — Phase 2.
 *
 * Takes bounding boxes from Grounding DINO and converts them into binary
 * Uint8Array masks that are subtracted from the floor candidate mask.
 *
 * Final visible floor mask formula:
 *   floorCandidateMask ∩ floorPlaneMask
 *   − furnitureMask
 *   − stairMask
 *   − wallMask
 *
 * v1: uses rectangular bounding-box fills.
 * Future: replace with per-box SAM-2 polygon masks for pixel precision.
 */

import type { BoundingBox } from "@/app/inventory/_actions/detectObjects";
import type { BoxCategory } from "@/app/inventory/_actions/detectObjectsUtils";

// ─── Mask building ────────────────────────────────────────────────────────────

export type OcclusionMasks = {
  furnitureMask:     Uint8Array;
  stairMask:         Uint8Array;
  wallMask:          Uint8Array;
  skirtingMask:      Uint8Array;
  ceilingMask:       Uint8Array;
  /** Union of all blocking masks — applied to the floor in one pass. */
  combinedOcclusion: Uint8Array;
};

/**
 * Build per-category and combined occlusion masks from detected bounding boxes.
 * Rectangles are used as the mask shape (v1 — fast, no extra model calls).
 */
export function buildOcclusionMasks(
  boxes: BoundingBox[],
  W:     number,
  H:     number,
): OcclusionMasks {
  const furnitureMask = new Uint8Array(W * H);
  const stairMask     = new Uint8Array(W * H);
  const wallMask      = new Uint8Array(W * H);
  const skirtingMask  = new Uint8Array(W * H);
  const ceilingMask   = new Uint8Array(W * H);

  const BLOCK_CATEGORIES: BoxCategory[] = ["furniture", "stair", "wall_element", "skirting", "ceiling", "other"];

  for (const box of boxes) {
    if (!BLOCK_CATEGORIES.includes(box.category)) continue;

    const x1 = Math.max(0, box.x1);
    const y1 = Math.max(0, box.y1);
    const x2 = Math.min(W - 1, box.x2);
    const y2 = Math.min(H - 1, box.y2);

    const target =
      box.category === "furniture"    ? furnitureMask :
      box.category === "stair"        ? stairMask     :
      box.category === "wall_element" ? wallMask      :
      box.category === "skirting"     ? skirtingMask  :
      box.category === "ceiling"      ? ceilingMask   :
      furnitureMask; // "other" → furniture bucket

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        target[y * W + x] = 1;
      }
    }
  }

  const combinedOcclusion = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (furnitureMask[i] || stairMask[i] || wallMask[i] || skirtingMask[i] || ceilingMask[i]) {
      combinedOcclusion[i] = 1;
    }
  }

  return { furnitureMask, stairMask, wallMask, skirtingMask, ceilingMask, combinedOcclusion };
}

/**
 * Subtract the combined occlusion mask from the floor mask.
 * Any floor pixel that overlaps an occlusion zone is removed.
 */
export function applyOcclusionToFloor(
  floorMask:         Uint8Array,
  combinedOcclusion: Uint8Array,
): Uint8Array {
  const result = new Uint8Array(floorMask.length);
  for (let i = 0; i < floorMask.length; i++) {
    result[i] = floorMask[i] === 1 && combinedOcclusion[i] !== 1 ? 1 : 0;
  }
  return result;
}

// ─── Debug visualizations (Canvas API — browser only) ─────────────────────────

const CATEGORY_COLORS: Record<BoxCategory, [string, string]> = {
  furniture:    ["rgba(255, 70, 70, 0.80)",   "rgba(255, 70, 70, 0.15)"],   // red
  stair:        ["rgba(255, 155, 0, 0.85)",   "rgba(255, 155, 0, 0.15)"],   // orange
  wall_element: ["rgba(90, 90, 255, 0.85)",   "rgba(90, 90, 255, 0.12)"],   // blue
  skirting:     ["rgba(0, 210, 200, 0.85)",   "rgba(0, 210, 200, 0.12)"],   // cyan
  ceiling:      ["rgba(180, 60, 220, 0.80)",  "rgba(180, 60, 220, 0.12)"],  // purple
  floor_hint:   ["rgba(30, 210, 80, 0.85)",   "rgba(30, 210, 80, 0.12)"],   // green
  other:        ["rgba(190, 190, 190, 0.70)", "rgba(190, 190, 190, 0.10)"], // grey
};

/**
 * Draw detected bounding boxes with category-coloured outlines on a blank canvas.
 * Overlay this on the room photo (CSS mix-blend-mode) for the debug panel.
 */
export function drawBoxesDebug(
  boxes: BoundingBox[],
  W:     number,
  H:     number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx     = canvas.getContext("2d")!;
  const lw      = Math.max(2, Math.round(W / 280));
  const fs      = Math.max(11, Math.round(W / 72));

  for (const box of boxes) {
    const [stroke, fill] = CATEGORY_COLORS[box.category];
    const bw = box.x2 - box.x1;
    const bh = box.y2 - box.y1;

    ctx.fillStyle   = fill;
    ctx.fillRect(box.x1, box.y1, bw, bh);

    ctx.strokeStyle = stroke;
    ctx.lineWidth   = lw;
    ctx.strokeRect(box.x1, box.y1, bw, bh);

    ctx.fillStyle = stroke;
    ctx.font      = `bold ${fs}px sans-serif`;
    ctx.fillText(
      `${box.label} ${Math.round(box.confidence * 100)}%`,
      box.x1 + lw + 2,
      box.y1 + fs + lw,
    );
  }

  return canvas.toDataURL("image/png");
}

/**
 * Render a binary occlusion mask as a coloured semi-transparent PNG.
 * Use different colours per category so each layer is visually distinct.
 */
export function maskCategoryToDataUrl(
  mask:  Uint8Array,
  W:     number,
  H:     number,
  rgba:  [number, number, number, number],
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx  = canvas.getContext("2d")!;
  const data = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i] !== 1) continue;
    data.data[i * 4]     = rgba[0];
    data.data[i * 4 + 1] = rgba[1];
    data.data[i * 4 + 2] = rgba[2];
    data.data[i * 4 + 3] = rgba[3];
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
