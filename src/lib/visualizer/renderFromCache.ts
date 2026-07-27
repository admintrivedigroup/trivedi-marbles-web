/**
 * Cache-aware floor renderer — the fast path for marble/setting changes.
 *
 * Reuses a RoomCache's FloorGeometry (render mask, floor quad, feather,
 * luminance — the expensive part of the pipeline) across slab swaps and
 * texture-setting changes, only re-running computeFloorGeometry() when a
 * manual floor-correction quad with genuinely different corners is supplied
 * (or on first render for this room).
 *
 * Callers routinely re-pass the room's last-known floor quad by reference
 * on every texture-only change (grout/rotation/scale/mode/slab) to keep the
 * perspective stable — that is NOT a correction request. So the comparison
 * below is by value against the quad baked into the cached geometry, not by
 * object identity: only corner coordinates that actually differ from what
 * was last computed trigger a recompute.
 */

import type { Quad } from "./perspective";
import type { RoomCache } from "./RoomCache";
import { roomCacheManager } from "./RoomCacheManager";
import { buildOcclusionMasks } from "./occlusionUtils";
import {
  computeFloorGeometry,
  renderTextureFromGeometry,
  type RenderSettings,
  type RenderFloorOutput,
} from "./renderFloorTexture";

function quadsEqual(a: Quad, b: Quad): boolean {
  return a.every((pt, i) => pt.x === b[i].x && pt.y === b[i].y);
}

export async function renderFromCache(
  cache: RoomCache,
  settings: RenderSettings,
  overrideQuad?: Quad,
): Promise<RenderFloorOutput> {
  const needsGeometry =
    !cache.geometry ||
    (overrideQuad !== undefined && !quadsEqual(overrideQuad, cache.geometry.floorQuad));

  if (needsGeometry) {
    // Not an AI call — local re-processing of an already-cached room, only
    // triggered by a genuine manual floor-correction quad.
    const occ = cache.objectBoxes.length > 0
      ? buildOcclusionMasks(cache.objectBoxes, cache.imgWidth, cache.imgHeight)
      : null;

    const geometry = await computeFloorGeometry({
      roomPhotoFile:    cache.roomPhotoFile,
      alphaMaskDataUrl: cache.alphaMaskDataUrl,
      imgWidth:         cache.imgWidth,
      imgHeight:        cache.imgHeight,
      manualQuad:       overrideQuad,
      occlusionMask:    occ?.combinedOcclusion,
      wallMask:         occ?.wallMask,
      stairMask:        occ?.stairMask,
      furnitureMask:    occ?.furnitureMask,
      skirtingMask:     occ?.skirtingMask,
      tapX:             cache.tapX,
      tapY:             cache.tapY,
      depthValues:      cache.depthValues ?? undefined,
      normalValues:     cache.normalValues ?? undefined,
    });
    roomCacheManager.updateGeometry(cache.roomId, geometry);
    cache.geometry = geometry;
  } else {
    console.log("Production visualizer: AI skipped");
    console.log("Production visualizer: rendering from cache");
  }

  return renderTextureFromGeometry(cache.geometry!, settings);
}
