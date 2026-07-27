/**
 * Deterministic floor texture renderer.
 *
 * Module layout:
 *   maskUtils.ts        — SAM mask refinement, luminance extraction
 *   floorPlane.ts       — floor plane estimation (linear regression, 3-pass)
 *   textureGenerator.ts — marble texture canvas (continuous / tile / bookmatch)
 *   lightingBlend.ts    — multiply + soft-light compositing
 *   renderFloorTexture  — orchestrator (this file)
 *
 * Pipeline:
 *   Room Photo + SAM mask
 *     → refineFloorMask  (clip 40% + BFS from bottom edge)
 *     → 3-pass floor plane estimation
 *     → SAM ∩ trapezoid → final floor mask
 *     → buildTiledTexture  (slab / tile / bookmatch canvas)
 *     → homography warp (floor quad → texture rect)
 *     → applyLightingBlend  (multiply 65% + soft-light 35%)
 *     → feather 2 px inward
 *     → composite (floor pixels replaced, everything else original)
 *
 * Manual mode (staff 4-point override):
 *   – rasterizeQuad is used as-is; SAM is NOT intersected.
 *   – No erosion; feather keeps the bottom edge clean.
 *
 * Non-floor pixel guarantee:
 *   The output buffer is initialised from `origData`.  Only pixels where
 *   feather[i] > 0 (i.e. inside the floor mask) are ever written to.
 *   Ceiling, walls, and objects outside the mask are unchanged.
 *
 * ── Room-cache split (Roomvo-style architecture) ─────────────────────────
 * The pipeline above is split into two halves so callers can cache the
 * expensive half and only re-run the cheap half when the slab/texture
 * settings change (see src/lib/visualizer/renderFromCache.ts):
 *
 *   computeFloorGeometry()      — steps that depend on the room photo + SAM
 *                                  mask + AI outputs (depth/normals/occlusion)
 *                                  + tap/manual-quad. Does NOT depend on the
 *                                  slab image or any texture setting.
 *   renderTextureFromGeometry() — steps that depend on the slab image and
 *                                  texture settings (mode/grout/rotation/
 *                                  scale/tile size). Consumes a FloorGeometry.
 *
 * renderFloorLocally() is unchanged for existing callers: it simply calls
 * computeFloorGeometry() then renderTextureFromGeometry() in sequence, so
 * its behaviour and output are identical to before this split.
 */

import {
  computeHomography,
  applyH,
  rasterizeQuad,
  type Quad,
} from "./perspective";
import {
  loadImageFromUrl,
  loadImageFromDataUrl,
  loadImageFromFile,
} from "./bookmatch";
import type { TextureMode } from "./textureGenerator";
import { floorUV, type SlabUVParams } from "./floorUV";
import {
  extractBinaryMask,
  refineFloorMask,
  maskCoverage,
  erode1px,
  createFeatherMask,
  extractFloorLuminance,
  meanFloorLuminance,
  floodFillFromPoint,
  largestConnectedComponent,
  erodeNpx,
} from "./maskUtils";
import { estimateFloorTrapezoid, floorBoundingBox } from "./floorPlane";
import { applyLightingBlend } from "./lightingBlend";
import { extractDepthConsistentFloor, computeNormalsFromDepth, depthFloorMaskToDataUrl } from "./depthUtils";
import { buildHorizontalMask, buildHorizontalMaskFixed } from "./normalUtils";
import { detectFloorWallBoundary, boundaryToDataUrl } from "./floorBoundary";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSUMED_FLOOR_WIDTH_MM  = 3600;
const ASSUMED_FLOOR_DEPTH_MM  = 6000;

const TEXTURE_W        = 2048;
const TEXTURE_H        = 2048;
const DEFAULT_GROUT_PX = 3;

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Debug information generated when params.debug === true.
 * Each dataUrl is a PNG the same size as the room photo (W × H).
 * Overlay them on the room photo to see each pipeline stage.
 */
export type DebugInfo = {
  /** Blue semi-transparent overlay — raw SAM segmentation output. */
  rawMaskDataUrl:     string;
  /** Green semi-transparent overlay — after refineFloorMask (clip + BFS). */
  refinedMaskDataUrl: string;
  /** Orange outline — detected floor plane trapezoid. */
  planeMaskDataUrl:   string;
  /** White semi-transparent overlay — pixels that actually received marble. */
  finalMaskDataUrl:   string;
  confidence:         "high" | "low";
  coveragePct:        number;    // 0–100, fraction of image that is floor
  /** Which automatic pass succeeded (1=standard, 2=wide band, 3=bounding box). */
  passUsed:           1 | 2 | 3 | "manual";
  /** True when Grounding DINO was skipped (model not configured). */
  occlusionSkipped:   boolean;
  /** True when Depth Anything V2 was available and influenced the floor mask. */
  depthUsed:          boolean;
  /** True when surface normal estimation influenced the floor mask. */
  normalsUsed:        boolean;
  /**
   * True when the final mask was trimmed to the single connected component
   * reachable from the user's tap pixel.
   */
  connectivityUsed:   boolean;

  // ─── Phase 7 stats & new debug stages ──────────────────────────────────────
  /** Cyan overlay — depth-gradient-consistent floor region (Stage 11). */
  depthConsistentMaskDataUrl: string | null;
  /** Yellow polyline — per-column floor-wall boundary (Stage 12). */
  boundaryDataUrl:            string | null;
  /** % of final floor pixels overlapping detected wall / skirting masks. */
  wallOverlapPct:             number;
  /** % of final floor pixels overlapping detected furniture / stair masks. */
  objectOverlapPct:           number;
  /** 0–1: fraction of final floor pixels also in depth-consistent region. */
  depthConsistencyScore:      number;
  /** % of pre-connectivity mask retained after connectivity filter. */
  connectivityPct:            number;
  /** Composite confidence 0–100 derived from the stats above. */
  confidencePct:              number;
  /**
   * Floor mask coverage (0–1) at each pipeline stage.
   * Use to diagnose which step collapsed the floor mask.
   */
  coverageWaterfall: {
    sam:       number;  // after refineFloorMask
    depth:     number;  // after depth gradient filter (or same as sam if skipped)
    normals:   number;  // after normal filter (or same as depth if skipped)
    boundary:  number;  // after floor-wall boundary (or same as normals if skipped)
    trapezoid: number;  // after trapezoid intersection
    occlusion: number;  // after DINO object occlusion subtraction
    final:     number;  // after connectivity + erode (actual rendered pixels)
  };
};

/** Params consumed by computeFloorGeometry() — everything that does NOT depend on the slab/texture settings. */
export type FloorGeometryParams = {
  roomPhotoFile:    File;
  alphaMaskDataUrl: string;     // alpha=0=floor (from buildAlphaMask)
  imgWidth:         number;
  imgHeight:        number;
  /** Staff 4-point override [TL, TR, BR, BL] in natural-photo coordinates. */
  manualQuad?:      Quad;
  /**
   * Combined occlusion mask from Grounding DINO (Phase 2).
   * Any floor pixel that overlaps this mask will NOT receive marble texture.
   */
  occlusionMask?:   Uint8Array;
  /**
   * Per-category masks from Grounding DINO — used only for stats computation
   * (wallOverlapPct, objectOverlapPct).  Not applied to the floor mask (that
   * is already done via occlusionMask).
   */
  wallMask?:        Uint8Array;
  stairMask?:       Uint8Array;
  furnitureMask?:   Uint8Array;
  skirtingMask?:    Uint8Array;
  /**
   * Normalised depth values (0–1) from Depth Anything V2 (Phase 3).
   * Same resolution as the room photo (W×H).
   * High gradient pixels inside the SAM floor mask are excluded (furniture edges).
   */
  depthValues?:     Float32Array;
  /**
   * Interleaved surface normals [nx,ny,nz,…] from Phase 4, each component -1 to +1.
   * Length = W*H*3.  Pixels with non-horizontal normals are excluded from the floor mask
   * (removes wall patches, stair risers, cabinet side panels).
   */
  normalValues?:    Float32Array;
  /**
   * The pixel coordinates that the user tapped on the room photo (Phase A anti-leakage).
   * After all mask filters run, the final mask is clipped to the single 4-connected
   * component reachable from this point, ensuring disconnected wall/stair patches
   * that survived depth/normal/occlusion filtering are still rejected.
   * Optional: omit for manual-quad mode or when coordinates are unavailable.
   */
  tapX?:            number;
  tapY?:            number;
};

/**
 * Everything computed from the room photo + SAM mask + AI outputs, independent
 * of which slab or texture settings are chosen. Cache this once per room/tap
 * and reuse it across marble swaps and texture-setting changes.
 */
export type FloorGeometry = {
  W: number;
  H: number;
  /** Decoded room-photo pixels — reused instead of re-decoding the File each render. */
  origData:        ImageData;
  renderMask:      Uint8Array;
  floorQuad:       Quad;
  feather:         Float32Array;
  featherDataUrl:  string;
  lumMap:          Float32Array;
  meanLum:         number;
  /** 3×3 homography (row-major, 9 elements) mapping floorQuad → unit quad. */
  homography:      number[];
  refinedCoverage: number;
  usedManualQuad:  boolean;
  confidence:      "high" | "low";
  debug:           DebugInfo;
};

/** Texture/render settings consumed by renderTextureFromGeometry(). */
export type RenderSettings = {
  slabImageUrl:  string;     // Cloudinary URL
  mode?:         TextureMode; // default: "continuous"
  tileWidthMm?:  number;     // default 1200
  tileHeightMm?: number;     // default 2400
  /**
   * Grout line thickness in texture pixels (default 3).
   * 0 = no grout.  Drawn in top-down texture space so lines converge after warping.
   */
  groutPx?:      number;
  /**
   * Rotate the tile pattern by this many degrees around the texture centre (default 0).
   * Applied as a UV-space rotation inside the per-pixel warp loop — no canvas edge bleed.
   */
  rotationDeg?:  number;
  /**
   * Scale the tile pattern (default 1.0).
   * >1 = tiles appear larger on the floor, <1 = smaller.
   * Applied as a UV-space scale — independent of tileWidthMm/tileHeightMm.
   */
  scaleFactor?:  number;
};

export type RenderFloorParams = FloorGeometryParams & RenderSettings & {
  /** Generate debug overlays (adds ~10 ms). */
  debug?: boolean;
};

export type RenderFloorOutput = {
  dataUrl:         string;
  /**
   * Grayscale PNG (same W×H as dataUrl) encoding the feather mask:
   *   R=G=B=255 → solid floor pixel  |  R=G=B=0 → original room pixel
   *   In-between → feathered edge (2 px wide).
   * Used by applyFloorFinish (Phase 6) to apply brightness/finish post-processing
   * without re-running segmentation or texture projection.
   */
  featherDataUrl:  string;
  floorQuad:       Quad;
  refinedCoverage: number;
  usedManualQuad:  boolean;
  /** Confidence of the automatic floor plane detection. */
  confidence:      "high" | "low";
  debug:           DebugInfo;
};

// ─── Geometry stage (room + mask + AI outputs → renderMask/floorQuad/etc.) ────

export async function computeFloorGeometry(
  params: FloorGeometryParams,
): Promise<FloorGeometry> {
  const {
    roomPhotoFile,
    alphaMaskDataUrl,
    imgWidth:  W,
    imgHeight: H,
    manualQuad,
    occlusionMask,
    wallMask,
    stairMask,
    furnitureMask,
    skirtingMask,
    depthValues,
    normalValues,
    tapX,
    tapY,
  } = params;

  // ── 1. Load room + mask images ─────────────────────────────────────────────
  const [roomImg, maskImg] = await Promise.all([
    loadImageFromFile(roomPhotoFile),
    loadImageFromDataUrl(alphaMaskDataUrl),
  ]);

  const origData = readPixels(roomImg, W, H);
  const maskData = readPixels(maskImg, W, H);
  const rawMask  = extractBinaryMask(maskData); // 1 = floor per SAM

  // ── 2. Build render mask and floor quad ────────────────────────────────────
  let renderMask:    Uint8Array;
  let floorQuad:     Quad;
  let usedManualQuad = false;
  let confidence:    "high" | "low" = "high";
  let passUsed:      DebugInfo["passUsed"] = 1;
  let refined:       Uint8Array | null = null;
  let depthUsed        = false;
  let normalsUsed      = false;
  let connectivityUsed = false;

  // Phase 7 — computed in both auto and manual branches, used for debug/stats
  let depthConsistentMask: Uint8Array | null = null;
  let boundaryY:    Int32Array | null = null;
  let connectivityPct = 100;

  // Coverage waterfall — fraction of image (0–1) at each pipeline stage
  let covSam = 0, covDepth = 0, covNormals = 0, covBoundary = 0;
  let covTrapezoid = 0, covOcclusion = 0, covFinal = 0;

  if (manualQuad) {
    // ── Manual mode ───────────────────────────────────────────────────────────
    //   The quad defines the perspective transform (kept fixed for stable texture
    //   alignment across slab changes). The rasterized quad is still filtered by
    //   depth, normals, occlusion, and connectivity so walls/stairs are excluded
    //   even when the quad covers them.
    usedManualQuad = true;
    passUsed       = "manual";
    floorQuad      = manualQuad;
    let manualCandidate: Uint8Array = rasterizeQuad(manualQuad, W, H);

    // Depth gradient filter — removes furniture feet and stair risers
    if (depthValues) {
      const depthFiltered = extractDepthConsistentFloor(depthValues, manualCandidate, W, H);
      depthConsistentMask = depthFiltered;
      if (depthFiltered !== manualCandidate) {
        manualCandidate = depthFiltered;
        depthUsed       = true;
      }
    }

    // Normal filter — removes vertical surfaces (walls, stair panels)
    const effectiveNormals2 = normalValues ?? (depthValues ? computeNormalsFromDepth(depthValues, W, H) : null);
    if (effectiveNormals2) {
      const { horizontalMask } = normalValues
        ? buildHorizontalMask(effectiveNormals2, manualCandidate, W, H)
        : buildHorizontalMaskFixed(effectiveNormals2, W, H);
      const normalFiltered = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        normalFiltered[i] = manualCandidate[i] === 1 && horizontalMask[i] === 1 ? 1 : 0;
      }
      const preCov  = maskCoverage(manualCandidate);
      const postCov = maskCoverage(normalFiltered);
      if (postCov >= preCov * 0.20 && postCov >= 0.005) {
        manualCandidate = normalFiltered;
        normalsUsed     = true;
      }

      // Floor-wall boundary backup filter (manual mode)
      const boundary2 = detectFloorWallBoundary(effectiveNormals2, W, H);
      boundaryY = boundary2.boundaryY;
      const preB2 = maskCoverage(manualCandidate);
      const bFiltered2 = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        bFiltered2[i] = manualCandidate[i] === 1 && boundary2.belowBoundaryMask[i] === 1 ? 1 : 0;
      }
      if (maskCoverage(bFiltered2) >= preB2 * 0.30 && maskCoverage(bFiltered2) >= 0.005) {
        manualCandidate = bFiltered2;
      }
    }

    // Occlusion — GDINO furniture/stair/wall boxes
    if (occlusionMask) {
      const cleaned = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        cleaned[i] = manualCandidate[i] === 1 && occlusionMask[i] !== 1 ? 1 : 0;
      }
      manualCandidate = cleaned;
    }

    // Pre-connectivity erosion — severs thin baseboard connections
    const PRE_ERODE_PX2 = 10;
    const priorCov2  = maskCoverage(manualCandidate);
    const preEroded2 = erodeNpx(manualCandidate, W, H, PRE_ERODE_PX2);
    if (priorCov2 > 0 && maskCoverage(preEroded2) >= priorCov2 * 0.45) {
      manualCandidate = preEroded2;
    }

    // Connectivity filter — keep only the component connected to the tap point
    if (tapX !== undefined && tapY !== undefined) {
      const cx = Math.max(0, Math.min(W - 1, tapX));
      const cy = Math.max(0, Math.min(H - 1, tapY));
      const connected = floodFillFromPoint(manualCandidate, W, H, cx, cy);
      if (maskCoverage(connected) >= 0.005) {
        manualCandidate  = connected;
        connectivityUsed = true;
      } else {
        const largest = largestConnectedComponent(manualCandidate, W, H);
        if (maskCoverage(largest) >= 0.005) manualCandidate = largest;
      }
    } else {
      const largest = largestConnectedComponent(manualCandidate, W, H);
      if (maskCoverage(largest) >= 0.005) manualCandidate = largest;
    }

    renderMask = manualCandidate;
    covFinal   = maskCoverage(renderMask);

  } else {
    // ── Auto mode: 3-pass floor plane detection ────────────────────────────
    //   NEEDS_MANUAL_FLOOR is thrown only when the refined mask is truly empty.
    //   Low perspective-estimation confidence alone does NOT abort the render.

    refined = refineFloorMask(rawMask, W, H);
    covSam  = maskCoverage(refined);

    if (covSam < 0.005) {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: No floor area could be detected. " +
        "Please tap 4 floor corners to define it manually.",
      );
    }

    // Pass 1: standard regression band (15%–80%)
    let plane = estimateFloorTrapezoid(refined, W, H, 0.15, 0.80);
    passUsed  = 1;

    // Pass 2: wider band — helps flat or very deep rooms
    if (plane.confidence === "low") {
      const p2 = estimateFloorTrapezoid(refined, W, H, 0.05, 0.95);
      if (p2.confidence === "high") { plane = p2; passUsed = 2; }
    }

    // Pass 3: bounding-box fallback — always produces a valid quad
    if (plane.confidence === "low") {
      plane    = floorBoundingBox(refined, W, H);
      passUsed = 3;
    }

    confidence = plane.confidence;

    // Phase 3: filter by depth gradient — removes furniture feet and stair edges.
    // Rollback: if depth removes >50% of SAM floor the map is unreliable — skip.
    let floorCandidate: Uint8Array = refined;
    if (depthValues) {
      const depthFiltered = extractDepthConsistentFloor(depthValues, refined, W, H);
      depthConsistentMask = depthFiltered; // always capture for debug/stats
      const depthCov = maskCoverage(depthFiltered);
      if (depthFiltered !== refined && depthCov >= covSam * 0.50 && depthCov >= 0.005) {
        floorCandidate = depthFiltered;
        depthUsed      = true;
      }
    }
    covDepth = maskCoverage(floorCandidate);

    // Phase 4: filter by surface normal — removes vertical surfaces (walls, stair risers,
    // cabinet sides).
    // When DSINE normals are available, use the adaptive classifier (learns floor reference
    // from the SAM mask so it adapts to any model coordinate convention).
    // When normals are derived from depth, use the fixed |ny| classifier instead — the
    // depth convention is known (disparity: floor has large |ny|, walls have |ny| ≈ 0) and
    // the adaptive reference can be contaminated by stair panel pixels in the SAM mask.
    const effectiveNormals = normalValues ?? (depthValues ? computeNormalsFromDepth(depthValues, W, H) : null);
    if (effectiveNormals) {
      const { horizontalMask } = normalValues
        ? buildHorizontalMask(effectiveNormals, floorCandidate, W, H)
        : buildHorizontalMaskFixed(effectiveNormals, W, H);
      const normalFiltered = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        normalFiltered[i] = floorCandidate[i] === 1 && horizontalMask[i] === 1 ? 1 : 0;
      }
      // Rollback: if normals remove >50% of current floor the estimate is
      // unreliable — skip rather than collapsing the mask.
      const preCoverage  = maskCoverage(floorCandidate);
      const postCoverage = maskCoverage(normalFiltered);
      if (postCoverage >= preCoverage * 0.50 && postCoverage >= 0.005) {
        floorCandidate = normalFiltered;
        normalsUsed    = true;
      }
    }
    covNormals = maskCoverage(floorCandidate);

    // Phase 4.5: floor-wall boundary from depth normals.
    // Provides a per-column upper limit on the floor zone as a backup for scenes
    // where the Phase 4 normal filter's safety threshold was triggered.  Each column
    // is scanned from the bottom; the topmost consecutive floor-like run (|ny|>0.35)
    // marks the boundary.  Pixels above the boundary are rejected.
    if (effectiveNormals) {
      const boundary = detectFloorWallBoundary(effectiveNormals, W, H);
      boundaryY = boundary.boundaryY;
      const preBoundaryCov    = maskCoverage(floorCandidate);
      const boundaryFiltered  = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        boundaryFiltered[i] = floorCandidate[i] === 1 && boundary.belowBoundaryMask[i] === 1 ? 1 : 0;
      }
      const postBoundaryCov = maskCoverage(boundaryFiltered);
      // Rollback: apply only if it keeps ≥50% of current floor pixels.
      if (postBoundaryCov >= preBoundaryCov * 0.50 && postBoundaryCov >= 0.005) {
        floorCandidate = boundaryFiltered;
      }
    }
    covBoundary = maskCoverage(floorCandidate);

    // Intersect: orientation-filtered floor ∩ estimated trapezoid (removes wall noise)
    const trapMask = rasterizeQuad(plane.trapezoid, W, H);
    let finalMask  = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      finalMask[i] = floorCandidate[i] === 1 && trapMask[i] === 1 ? 1 : 0;
    }

    // Fallback A: no overlap → use depth-filtered (or refined) mask alone
    if (maskCoverage(finalMask) < 0.01) finalMask = new Uint8Array(floorCandidate);

    // Fallback B: >45% coverage → wall contamination → use trapezoid only
    if (maskCoverage(finalMask) > 0.45) finalMask = new Uint8Array(trapMask);

    covTrapezoid = maskCoverage(finalMask);

    // Subtract occlusion: furniture/stairs/objects detected by Grounding DINO.
    // Rollback: if DINO occlusion would remove >35% of the trapezoid-filtered floor,
    // the boxes are likely wrong (DINO hallucinated large regions) — skip occlusion.
    let priorErode: Uint8Array = finalMask;
    if (occlusionMask) {
      const cleaned = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        cleaned[i] = finalMask[i] === 1 && occlusionMask[i] !== 1 ? 1 : 0;
      }
      const cleanedCov = maskCoverage(cleaned);
      if (cleanedCov >= covTrapezoid * 0.65 && cleanedCov >= 0.005) {
        priorErode = cleaned;
      }
      // else: occlusion too aggressive — keep full floor, skip subtraction
    }
    covOcclusion = maskCoverage(priorErode);

    // Pre-connectivity erosion: sever thin baseboard connections between the
    // floor and adjacent vertical surfaces (stair panels, lower wall patches).
    // Baseboards and transition strips are typically 10–20 px wide at 1500 px
    // image resolution.  A 10 px erosion severs paths narrower than 20 px while
    // keeping the main floor area largely intact.
    // Safety: skip if erosion removes more than 55% of current coverage.
    const PRE_ERODE_PX = 10;
    const priorCoverage = maskCoverage(priorErode);
    const preEroded     = erodeNpx(priorErode, W, H, PRE_ERODE_PX);
    if (priorCoverage > 0 && maskCoverage(preEroded) >= priorCoverage * 0.45) {
      priorErode = preEroded;
    }

    // Phase A — Anti-leakage: connectivity filter.
    //
    // After all mask filters (depth, normals, trapezoid, occlusion) the mask
    // may still contain disconnected wall/stair patches that survived because
    // no individual filter is perfect.  Clipping to the single 4-connected
    // component from the user's tap point removes all such leaked patches in
    // one pass, since the tap was on the true floor and walls/stairs are
    // physically disconnected from it after the filters above have run.
    //
    // Fallback: when the tap pixel was inside a patch that was removed by an
    // aggressive filter (rare), keep the largest surviving component instead.
    const preConnCov = maskCoverage(priorErode);
    if (tapX !== undefined && tapY !== undefined) {
      const clamped   = { x: Math.max(0, Math.min(W - 1, tapX)), y: Math.max(0, Math.min(H - 1, tapY)) };
      const connected = floodFillFromPoint(priorErode, W, H, clamped.x, clamped.y);
      if (maskCoverage(connected) >= 0.005) {
        priorErode       = connected;
        connectivityUsed = true;
      } else {
        // Tap fell outside filtered mask — keep the largest surviving blob
        const largest = largestConnectedComponent(priorErode, W, H);
        if (maskCoverage(largest) >= 0.005) priorErode = largest;
      }
    } else {
      // No tap coordinates: remove disconnected noise by keeping the largest component
      const largest = largestConnectedComponent(priorErode, W, H);
      if (maskCoverage(largest) >= 0.005) priorErode = largest;
    }
    connectivityPct = preConnCov > 0
      ? Math.round((maskCoverage(priorErode) / preConnCov) * 100)
      : 100;

    renderMask = erode1px(priorErode, W, H);
    covFinal   = maskCoverage(renderMask);
    floorQuad  = plane.trapezoid;

    // Guard: if the pipeline collapsed the floor to near-zero, something went
    // wrong (over-aggressive filters or empty scene).  Throw so the caller can
    // offer the manual-quad fallback rather than rendering an invisible texture.
    if (covFinal < 0.02) {
      throw new Error(
        "NEEDS_MANUAL_FLOOR: Floor mask collapsed after filtering " +
        `(coverage ${(covFinal * 100).toFixed(1)}%). ` +
        "Please tap 4 floor corners to define it manually.",
      );
    }
  }

  // ── 3. Feather edges (3 px inward) ─────────────────────────────────────────
  const feather        = createFeatherMask(renderMask, W, H, 3);
  const refinedCoverage = maskCoverage(renderMask);

  // ── 4. Homography: floor image pixel → normalised floor [0,1] ──────────────
  //   Each pixel on the floor mask is mapped to a position in floor space
  //   (0 = left/back edge of the detected quad, 1 = right/front edge).
  //   This is perspective-correct for any planar floor viewed from a pinhole.
  const unitQuad: Quad = [
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 1, y: 1 }, { x: 0, y: 1 },
  ];
  const H_mat = computeHomography(floorQuad, unitQuad);
  if (!H_mat) {
    throw new Error("Floor perspective failed — quad is degenerate. Try tapping a different spot.");
  }

  // ── 5. Extract original floor luminance ────────────────────────────────────
  const lumMap  = extractFloorLuminance(origData, renderMask);
  const meanLum = meanFloorLuminance(lumMap, renderMask);

  // ── 6. Feather mask PNG (needed for Phase 6 brightness/finish) ─────────────
  const feathCanvas  = makeCanvas(W, H);
  const feathCtx     = feathCanvas.getContext("2d")!;
  const feathImgData = feathCtx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(feather[i] * 255);
    feathImgData.data[i * 4]     = v;
    feathImgData.data[i * 4 + 1] = v;
    feathImgData.data[i * 4 + 2] = v;
    feathImgData.data[i * 4 + 3] = 255;
  }
  feathCtx.putImageData(feathImgData, 0, 0);
  const featherDataUrl = feathCanvas.toDataURL("image/png");

  // ── 7. Debug overlays + Phase 7 stats ─────────────────────────────────────
  // Stats: wall/object overlap, depth consistency, composite confidence
  let totalFloorPx = 0;
  for (let i = 0; i < W * H; i++) { if (renderMask[i] === 1) totalFloorPx++; }

  let wallOverlap = 0, objectOverlap = 0;
  if (totalFloorPx > 0) {
    for (let i = 0; i < W * H; i++) {
      if (renderMask[i] !== 1) continue;
      if ((wallMask?.[i] ?? 0) === 1 || (skirtingMask?.[i] ?? 0) === 1) wallOverlap++;
      if ((stairMask?.[i] ?? 0) === 1 || (furnitureMask?.[i] ?? 0) === 1) objectOverlap++;
    }
  }
  const wallOverlapPct   = totalFloorPx > 0 ? (wallOverlap   / totalFloorPx) * 100 : 0;
  const objectOverlapPct = totalFloorPx > 0 ? (objectOverlap / totalFloorPx) * 100 : 0;

  let depthConsistencyScore = 0;
  if (depthConsistentMask && totalFloorPx > 0) {
    let consistent = 0;
    for (let i = 0; i < W * H; i++) {
      if (renderMask[i] === 1 && depthConsistentMask[i] === 1) consistent++;
    }
    depthConsistencyScore = consistent / totalFloorPx;
  }

  // Confidence must reflect actual result quality.
  // Low final coverage overrides everything — the floor mask is unusable.
  const covFinalPct = covFinal > 0 ? covFinal : refinedCoverage; // fallback for manual mode
  let confidencePct: number;
  if (covFinalPct < 0.02) {
    confidencePct = 0;
  } else if (covFinalPct < 0.08) {
    // Collapsed floor — cap at 20 regardless of other stats
    confidencePct = Math.min(20, Math.round(covFinalPct * 250));
  } else {
    confidencePct = Math.min(100, Math.max(0, Math.round(
      (confidence === "high" ? 65 : 45)
      + (depthUsed       ? 8 : 0)
      + (normalsUsed     ? 8 : 0)
      + (wallOverlapPct   < 1 ? 6 : wallOverlapPct   < 5 ? 2 : -8)
      + (objectOverlapPct < 2 ? 6 : objectOverlapPct < 8 ? 1 : -8)
      + (depthConsistencyScore > 0.85 ? 5 : 0)
      + (connectivityUsed ? 2 : 0)
      + (covFinalPct > 0.20 ? 5 : covFinalPct > 0.10 ? 2 : 0)
    )));
  }

  const debugInfo: DebugInfo = {
    rawMaskDataUrl:              maskToDataUrl(rawMask,            W, H, [  0, 100, 255, 180]),
    refinedMaskDataUrl:          maskToDataUrl(refined ?? rawMask, W, H, [  0, 200,  60, 180]),
    planeMaskDataUrl:            quadToDataUrl(floorQuad,          W, H),
    finalMaskDataUrl:            maskToDataUrl(renderMask,         W, H, [255, 255, 255, 160]),
    confidence,
    coveragePct:                 Math.round(refinedCoverage * 100),
    passUsed,
    occlusionSkipped:            !occlusionMask,
    depthUsed,
    normalsUsed,
    connectivityUsed,
    // Phase 7
    depthConsistentMaskDataUrl:  depthConsistentMask ? depthFloorMaskToDataUrl(depthConsistentMask, W, H) : null,
    boundaryDataUrl:             boundaryY ? boundaryToDataUrl(boundaryY, W, H) : null,
    wallOverlapPct,
    objectOverlapPct,
    depthConsistencyScore,
    connectivityPct,
    confidencePct,
    coverageWaterfall: {
      sam:       Math.round(covSam       * 1000) / 1000,
      depth:     Math.round(covDepth     * 1000) / 1000,
      normals:   Math.round(covNormals   * 1000) / 1000,
      boundary:  Math.round(covBoundary  * 1000) / 1000,
      trapezoid: Math.round(covTrapezoid * 1000) / 1000,
      occlusion: Math.round(covOcclusion * 1000) / 1000,
      final:     Math.round(covFinalPct  * 1000) / 1000,
    },
  };

  return {
    W, H,
    origData,
    renderMask,
    floorQuad,
    feather,
    featherDataUrl,
    lumMap,
    meanLum,
    homography: H_mat,
    refinedCoverage,
    usedManualQuad,
    confidence,
    debug: debugInfo,
  };
}

// ─── Texture stage (geometry + slab image + settings → final composite) ──────

export async function renderTextureFromGeometry(
  geometry: FloorGeometry,
  settings: RenderSettings,
): Promise<RenderFloorOutput> {
  const {
    slabImageUrl,
    mode         = "continuous",
    tileWidthMm  = 1200,
    tileHeightMm = 2400,
    groutPx      = DEFAULT_GROUT_PX,
    rotationDeg  = 0,
    scaleFactor  = 1.0,
  } = settings;

  const { W, H, origData, feather, lumMap, meanLum, homography: H_mat } = geometry;

  // ── 1. Slab image — sampled at its natural resolution ─────────────────────
  //   Preserves the slab's real aspect ratio: we sample [0,1]×[0,1] directly
  //   from the original image instead of squishing it into a fixed N×M canvas.
  //   Each tile always receives the full slab image at its natural proportions.
  const slabImg  = await loadImageFromUrl(slabImageUrl);
  const SLAB_W   = slabImg.naturalWidth  || TEXTURE_W;
  const SLAB_H   = slabImg.naturalHeight || TEXTURE_H;
  const slabData = readPixels(slabImg, SLAB_W, SLAB_H);

  // Tile counts in world space (fractional is fine — no rounding needed)
  const tilesAcross = ASSUMED_FLOOR_WIDTH_MM  / tileWidthMm;
  const tilesDeep   = ASSUMED_FLOOR_DEPTH_MM  / tileHeightMm;

  // Grout: convert groutPx (slider 0–8) to UV half-width.
  // GROUT_SCALE = old per-tile pixel size in the 2048-canvas system → same
  // visual weight as before regardless of slab physical dimensions.
  const tilesAcrossR = Math.max(2, Math.round(tilesAcross));
  const tilesDeepR   = Math.max(2, Math.round(tilesDeep));
  const groutHalfU   = groutPx > 0 ? groutPx / (2 * (TEXTURE_W / tilesAcrossR)) : 0;
  const groutHalfV   = groutPx > 0 ? groutPx / (2 * (TEXTURE_H / tilesDeepR))   : 0;
  const GROUT_RGB: [number, number, number] = [158, 155, 151]; // warm grey

  const cosR = Math.cos((rotationDeg * Math.PI) / 180);
  const sinR = Math.sin((rotationDeg * Math.PI) / 180);

  const uvParams: SlabUVParams = {
    tilesAcross,
    tilesDeep,
    mode,
    groutHalfU,
    groutHalfV,
    cosR,
    sinR,
    scaleFactor,
  };

  // ── 2. Per-pixel: world UV → slab sample → light → feather → composite ──────
  //   H_mat maps each floor pixel to a normalised floor position [0,1].
  //   floorUV() converts that to a slab texture UV, applying scale/rotation in
  //   world (floor) space so veins rotate with the floor plane rather than the
  //   image.  Bookmatch mirroring is applied per tile.  sampleBilinear wraps
  //   with modulo for seamless tiling beyond the detected floor quad.
  const output = new Uint8ClampedArray(origData.data);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx   = y * W + x;
      const alpha = feather[idx];
      if (alpha <= 0) continue; // outside mask — original pixel preserved

      const { x: fx, y: fy } = applyH(H_mat, x, y);
      const { u, v, isGrout } = floorUV(fx, fy, uvParams);

      const [mr, mg, mb]: [number, number, number] = isGrout
        ? GROUT_RGB
        : sampleBilinear(slabData, SLAB_W, SLAB_H, u * SLAB_W, v * SLAB_H);

      const pixelLum = lumMap[idx] > 0 ? lumMap[idx] : meanLum;
      const oi       = idx * 4;
      const [lr, lg, lb] = applyLightingBlend(
        mr, mg, mb,
        pixelLum, meanLum,
        origData.data[oi], origData.data[oi + 1], origData.data[oi + 2],
      );

      if (alpha >= 1) {
        output[oi]     = lr;
        output[oi + 1] = lg;
        output[oi + 2] = lb;
        output[oi + 3] = 255;
      } else {
        // Feathered boundary: blend marble with original
        output[oi]     = Math.round(origData.data[oi]     * (1 - alpha) + lr * alpha);
        output[oi + 1] = Math.round(origData.data[oi + 1] * (1 - alpha) + lg * alpha);
        output[oi + 2] = Math.round(origData.data[oi + 2] * (1 - alpha) + lb * alpha);
        output[oi + 3] = 255;
      }
    }
  }

  const outCanvas = makeCanvas(W, H);
  outCanvas.getContext("2d")!.putImageData(new ImageData(output, W, H), 0, 0);

  return {
    dataUrl:         outCanvas.toDataURL("image/jpeg", 0.92),
    featherDataUrl:  geometry.featherDataUrl,
    floorQuad:       geometry.floorQuad,
    refinedCoverage: geometry.refinedCoverage,
    usedManualQuad:  geometry.usedManualQuad,
    confidence:      geometry.confidence,
    debug:           geometry.debug,
  };
}

// ─── Main function (unchanged behaviour — thin wrapper over the two stages) ───

export async function renderFloorLocally(
  params: RenderFloorParams,
): Promise<RenderFloorOutput> {
  const {
    roomPhotoFile, alphaMaskDataUrl, imgWidth, imgHeight, manualQuad,
    occlusionMask, wallMask, stairMask, furnitureMask, skirtingMask,
    depthValues, normalValues, tapX, tapY,
  } = params;

  const geometry = await computeFloorGeometry({
    roomPhotoFile, alphaMaskDataUrl, imgWidth, imgHeight, manualQuad,
    occlusionMask, wallMask, stairMask, furnitureMask, skirtingMask,
    depthValues, normalValues, tapX, tapY,
  });

  const { slabImageUrl, mode, tileWidthMm, tileHeightMm, groutPx, rotationDeg, scaleFactor } = params;
  return renderTextureFromGeometry(geometry, {
    slabImageUrl, mode, tileWidthMm, tileHeightMm, groutPx, rotationDeg, scaleFactor,
  });
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function readPixels(img: HTMLImageElement, w: number, h: number): ImageData {
  const c = makeCanvas(w, h);
  c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, w, h);
  return c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
}

function sampleBilinear(
  tex: ImageData, TW: number, TH: number, u: number, v: number,
): [number, number, number] {
  u = ((u % TW) + TW) % TW;
  v = ((v % TH) + TH) % TH;
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = (x0 + 1) % TW, y1 = (y0 + 1) % TH;
  const fx = u - x0, fy = v - y0;
  const p00 = (y0 * TW + x0) * 4, p10 = (y0 * TW + x1) * 4;
  const p01 = (y1 * TW + x0) * 4, p11 = (y1 * TW + x1) * 4;
  return [
    Math.round(blerp(tex.data[p00],   tex.data[p10],   tex.data[p01],   tex.data[p11],   fx, fy)),
    Math.round(blerp(tex.data[p00+1], tex.data[p10+1], tex.data[p01+1], tex.data[p11+1], fx, fy)),
    Math.round(blerp(tex.data[p00+2], tex.data[p10+2], tex.data[p01+2], tex.data[p11+2], fx, fy)),
  ];
}

function blerp(a: number, b: number, c: number, d: number, fx: number, fy: number): number {
  return a * (1-fx)*(1-fy) + b * fx*(1-fy) + c * (1-fx)*fy + d * fx*fy;
}

// ─── Debug overlay helpers ────────────────────────────────────────────────────

/** Render a binary mask as a coloured semi-transparent PNG data URL. */
function maskToDataUrl(
  mask: Uint8Array,
  W: number, H: number,
  rgba: [number, number, number, number],
): string {
  const c   = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const d   = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i] !== 1) continue;
    d.data[i * 4]     = rgba[0];
    d.data[i * 4 + 1] = rgba[1];
    d.data[i * 4 + 2] = rgba[2];
    d.data[i * 4 + 3] = rgba[3];
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

/** Render the floor plane trapezoid as an orange outline + fill. */
function quadToDataUrl(quad: Quad, W: number, H: number): string {
  const c   = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  ctx.lineTo(quad[1].x, quad[1].y);
  ctx.lineTo(quad[2].x, quad[2].y);
  ctx.lineTo(quad[3].x, quad[3].y);
  ctx.closePath();
  ctx.fillStyle   = "rgba(255,140,0,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,140,0,0.9)";
  ctx.lineWidth   = Math.max(2, Math.round(W / 250));
  ctx.stroke();

  // Label each corner
  ctx.fillStyle = "rgba(255,140,0,0.95)";
  ctx.font      = `bold ${Math.max(12, Math.round(W / 60))}px sans-serif`;
  const labels  = ["TL", "TR", "BR", "BL"];
  quad.forEach((pt, i) => {
    ctx.fillText(labels[i], pt.x + 4, pt.y - 4);
  });

  return c.toDataURL("image/png");
}
