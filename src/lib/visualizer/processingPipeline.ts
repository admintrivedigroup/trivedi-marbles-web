/**
 * Assembles a RoomCache from the results of the "Step 1" AI run
 * (segmentation, depth, normals, occlusion boxes) that visualizer-ai.tsx
 * already performs once per photo/tap in runDiscovery() / runPipeline().
 *
 * This module does not make the AI calls itself — it's the seam between
 * "AI results are in" and "a cached room now exists" so the render path
 * (renderFromCache.ts) never needs to know how those results were produced.
 */

import type { SurfaceType } from "@/app/inventory/_actions/visualize";
import type { BoundingBox } from "@/app/inventory/_actions/detectObjects";
import type { RoomCache } from "./RoomCache";
import { roomCacheManager } from "./RoomCacheManager";

export type BuildRoomCacheParams = {
  roomPhotoFile: File;
  imgWidth:  number;
  imgHeight: number;
  surfaceType: SurfaceType | null;

  alphaMaskDataUrl: string;
  rawMaskDataUrl:   string | null;

  objectBoxes:      BoundingBox[];
  allObjectBoxes:   BoundingBox[];
  occlusionSkipped: boolean;

  depthValues:  Float32Array | null;
  depthSkipped: boolean;

  normalValues:  Float32Array | null;
  normalSkipped: boolean;

  tapX?: number;
  tapY?: number;
};

/** Build a new RoomCache entry and register it with the RoomCacheManager. */
export function buildRoomCache(params: BuildRoomCacheParams): RoomCache {
  const room: RoomCache = {
    roomId:    roomCacheManager.generateRoomId(),
    createdAt: Date.now(),

    imgWidth:  params.imgWidth,
    imgHeight: params.imgHeight,
    roomPhotoFile: params.roomPhotoFile,
    surfaceType:   params.surfaceType,

    alphaMaskDataUrl: params.alphaMaskDataUrl,
    rawMaskDataUrl:   params.rawMaskDataUrl,

    objectBoxes:      params.objectBoxes,
    allObjectBoxes:   params.allObjectBoxes,
    occlusionSkipped: params.occlusionSkipped,

    depthValues:  params.depthValues,
    depthSkipped: params.depthSkipped,

    normalValues:  params.normalValues,
    normalSkipped: params.normalSkipped,

    tapX: params.tapX,
    tapY: params.tapY,

    geometry: null,
  };

  roomCacheManager.saveRoom(room);
  return room;
}
