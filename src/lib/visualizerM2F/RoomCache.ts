/**
 * Room-cache types for the Mask2Former-based production visualizer.
 *
 * A RoomCache holds everything produced by the one-time "Step 1" AI run
 * (Mask2Former segmentation + Depth Anything V2) for a single uploaded room,
 * plus the lazily-computed FloorGeometry (largest-CC / quad / homography —
 * see perspectiveRenderer.ts). Marble swaps and texture-setting changes reuse
 * the same RoomCache via renderFromCache.ts instead of re-running any of this.
 */

import type { PipelineSegResult, PipelineDepthResult } from "@/app/debug/combined-visualizer-test/_lib/types";
import type { FloorGeometry } from "./perspectiveRenderer";

export type RoomCache = {
  roomId:    string;
  createdAt: number;

  imgWidth:  number;
  imgHeight: number;
  /** Object URL (or data URL) for the uploaded room photo. */
  photoUrl: string;

  segResult:   PipelineSegResult;
  depthResult: PipelineDepthResult | null;

  selectedCategory:  string | null;
  surfaceMaskBases:  string[];
  occluderMaskBases: string[];

  /**
   * Floor geometry (largest CC / quad / homography / debug overlay).
   * Null until the first floor render computes it; reused after that.
   */
  geometry: FloorGeometry | null;
};

export type { FloorGeometry } from "./perspectiveRenderer";
