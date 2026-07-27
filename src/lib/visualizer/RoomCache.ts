/**
 * Room-cache types for the Roomvo-style visualizer architecture.
 *
 * A RoomCache holds everything produced by the one-time "Step 1" AI run
 * (segmentation, depth, normals, occlusion boxes) for a single uploaded
 * room + selected surface/tap point, plus the lazily-computed FloorGeometry
 * (render mask, floor quad, feather, luminance — see renderFloorTexture.ts).
 *
 * Marble swaps and texture-setting changes reuse the same RoomCache via
 * renderFromCache.ts instead of re-running any of this.
 */

import type { SurfaceType } from "@/app/inventory/_actions/visualize";
import type { BoundingBox } from "@/app/inventory/_actions/detectObjects";
import type { FloorGeometry } from "./renderFloorTexture";

export type RoomCache = {
  roomId:    string;
  createdAt: number;

  imgWidth:  number;
  imgHeight: number;
  roomPhotoFile: File;
  surfaceType:   SurfaceType | null;

  // Segmentation (SAM) — the surface the user selected/tapped
  alphaMaskDataUrl: string;
  rawMaskDataUrl:   string | null;

  // Occlusion (Grounding DINO)
  objectBoxes:      BoundingBox[];
  allObjectBoxes:   BoundingBox[];
  occlusionSkipped: boolean;

  // Depth (Depth Anything V2)
  depthValues:  Float32Array | null;
  depthSkipped: boolean;

  // Surface normals
  normalValues:  Float32Array | null;
  normalSkipped: boolean;

  // Tap point used for connectivity filtering
  tapX?: number;
  tapY?: number;

  /**
   * Floor geometry (render mask / quad / feather / luminance / homography).
   * Null until the first floor render computes it; reused after that unless
   * a manual-quad correction with genuinely different corner coordinates is
   * supplied (see renderFromCache.ts — comparison is by value, not identity,
   * since callers routinely re-pass the last-known quad by reference to keep
   * the perspective stable across texture-only changes).
   */
  geometry: FloorGeometry | null;
};

export type { FloorGeometry } from "./renderFloorTexture";
