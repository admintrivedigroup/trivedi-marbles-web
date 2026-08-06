/**
 * Cache-aware floor renderer — the fast path for marble/setting changes.
 *
 * Reuses a RoomCache's FloorGeometry (largest-CC, quad, homography, debug
 * overlay — the expensive part of perspectiveRenderer.ts) across slab swaps
 * and texture-setting changes. Unlike the SAM-2 pipeline's equivalent module,
 * this pipeline has no manual floor-correction/override-quad concept, so
 * geometry only ever needs computing once per room (whenever it's still
 * null) — there's no quad-comparison edge case to get wrong here.
 */

import type { TextureSettings, SlabSettings, RenderMode } from "./types";
import type { RoomCache } from "./RoomCache";
import { roomCacheManagerM2F } from "./RoomCacheManager";
import {
  computeFloorGeometry,
  renderTextureFromGeometry,
  type PerspectiveRenderResult,
} from "./perspectiveRenderer";

export async function renderFromCache(
  cache:          RoomCache,
  textureDataUrl: string,
  settings:       TextureSettings,
  renderMode:     RenderMode,
  slabSettings:   SlabSettings,
  debugFlags?:    { debugUV?: boolean; debugCheckerboard?: boolean; debugSlab?: boolean },
): Promise<PerspectiveRenderResult> {
  if (!cache.geometry) {
    // Not an AI call — one-time local geometry pass (largest-CC/quad/homography)
    // over the already-fetched Mask2Former masks.
    const geometry = await computeFloorGeometry({
      originalDataUrl:   cache.photoUrl,
      surfaceMaskBases:  cache.surfaceMaskBases,
      occluderMaskBases: cache.occluderMaskBases,
      width:             cache.imgWidth,
      height:            cache.imgHeight,
      segments:          cache.segResult.segments,
      depthBase64:       cache.depthResult?.depthBase64 ?? null,
    });
    roomCacheManagerM2F.updateGeometry(cache.roomId, geometry);
    cache.geometry = geometry;
  } else {
    console.log("Production visualizer: AI skipped");
    console.log("Production visualizer: rendering from cache");
  }

  const { compositeUrl } = await renderTextureFromGeometry(cache.geometry, {
    textureDataUrl,
    settings,
    renderMode,
    slabSettings,
    debugUV:           debugFlags?.debugUV,
    debugCheckerboard: debugFlags?.debugCheckerboard,
    debugSlab:         debugFlags?.debugSlab,
  });

  return { compositeUrl, debugUrl: cache.geometry.debugUrl, quad: cache.geometry.quad };
}
