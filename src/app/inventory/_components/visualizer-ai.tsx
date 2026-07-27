"use client";

import { useRef, useState, useMemo } from "react";
import {
  AlertTriangle,
  Camera,
  Download,
  FlipHorizontal,
  Layers2,
  Loader2,
  RefreshCw,
  Scan,
} from "lucide-react";

import {
  classifySurface,
  detectSurface,
  renderVisualization,
  type SurfaceType,
} from "@/app/inventory/_actions/visualize";
import { discoverSurfaces } from "@/app/inventory/_actions/discoverSurfaces";
import {
  buildSurfaceCandidates,
  toRenderSurfaceType,
  type SurfaceCandidate,
} from "@/lib/visualizer/surfaceClassifier";
import {
  detectObjects,
  type BoundingBox,
  type DiagnosticChecks,
} from "@/app/inventory/_actions/detectObjects";
import {
  detectObjectsPromptTests,
  detectObjectsDeepDiag,
  type PromptTestsResult,
  type DeepDiagResult,
} from "@/app/inventory/_actions/detectObjectsDebug";
import { getDepthMap } from "@/app/inventory/_actions/getDepthMap";
import { getSurfaceNormals } from "@/app/inventory/_actions/getSurfaceNormals";
import { type DebugInfo } from "@/lib/visualizer/renderFloorTexture";
import { useRoomCache } from "@/lib/visualizer/useRoomCache";
import { renderFromCache } from "@/lib/visualizer/renderFromCache";
import {
  buildOcclusionMasks,
  drawBoxesDebug,
  maskCategoryToDataUrl,
} from "@/lib/visualizer/occlusionUtils";
import {
  parseDepthMap,
  depthToColorDataUrl,
  depthEdgesToDataUrl,
} from "@/lib/visualizer/depthUtils";
import { parseNormalMap } from "@/lib/visualizer/normalUtils";
import { applyFloorFinish, type FinishMode } from "@/lib/visualizer/finishUtils";
import type { TextureMode } from "@/lib/visualizer/bookmatch";
import type { Quad } from "@/lib/visualizer/perspective";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "upload"
  | "analyzing"        // auto-discovery running after upload
  | "surface_select"   // show detected surface candidates
  | "tap"
  | "segmenting"
  | "rendering"
  | "floor_correction"
  | "result"
  | "error";

type SlabOption = {
  id: string;
  slabCode: string;
  marbleName: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
};

type Props = {
  currentSlab: SlabOption;
  comparisons: SlabOption[];
};

// ─── Client-side helpers ──────────────────────────────────────────────────────

async function compressPhoto(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1500;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], "room.jpg", { type: "image/jpeg" }) : file);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Composite AI result with original photo using a blur-threshold mask.
//
// Why blur instead of erode/feather:
//   SAM masks have small interior holes (isolated preserve-pixels inside the floor region).
//   Erosion amplified those holes into blocky patches.
//   Blurring the mask pulls interior holes toward the surrounding floor value (alpha≈0),
//   filling them, while pushing isolated stray floor pixels near walls toward alpha≈255,
//   preventing bleed onto furniture/walls — all in one pass.
async function compositeResult(
  originalFile: File,
  aiResultDataUrl: string,
  alphaMaskDataUrl: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const SIZE = 1024;
    const origUrl = URL.createObjectURL(originalFile);

    const origImg = new Image();
    const aiImg = new Image();
    const maskImg = new Image();

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 3) return;

      URL.revokeObjectURL(origUrl);

      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(origImg, 0, 0, SIZE, SIZE);
      const origData = ctx.getImageData(0, 0, SIZE, SIZE);

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(aiImg, 0, 0, SIZE, SIZE);
      const aiData = ctx.getImageData(0, 0, SIZE, SIZE);

      // Draw mask with a blur so:
      //   • small preserve-islands inside the floor collapse → use AI (fills holes)
      //   • AI floor pixels near walls/furniture boundaries stay collapsed → preserve original
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.filter = "blur(8px)";
      ctx.drawImage(maskImg, 0, 0, SIZE, SIZE);
      ctx.filter = "none";
      const blurred = ctx.getImageData(0, 0, SIZE, SIZE);

      const out = ctx.createImageData(SIZE, SIZE);
      for (let i = 0; i < out.data.length; i += 4) {
        // blurred alpha ≈ 0   → solidly inside floor → use AI result
        // blurred alpha ≈ 255 → non-floor or near edge → preserve original photo
        // threshold at 100: conservative — never bleeds AI onto walls
        const useAi = blurred.data[i + 3] < 100;
        out.data[i]     = useAi ? aiData.data[i]     : origData.data[i];
        out.data[i + 1] = useAi ? aiData.data[i + 1] : origData.data[i + 1];
        out.data[i + 2] = useAi ? aiData.data[i + 2] : origData.data[i + 2];
        out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    const onError = (e: unknown) => { URL.revokeObjectURL(origUrl); reject(e); };
    origImg.onload = aiImg.onload = maskImg.onload = onLoad;
    origImg.onerror = aiImg.onerror = maskImg.onerror = onError;

    origImg.src = origUrl;
    aiImg.src = aiResultDataUrl;
    maskImg.src = alphaMaskDataUrl;
  });
}

// Convert SAM raw mask (white = surface) to OpenAI alpha mask (alpha=0 = editable).
async function buildAlphaMask(rawMaskDataUrl: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const out = ctx.createImageData(width, height);
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = 0;
        out.data[i + 3] = brightness > 128 ? 0 : 255;
      }
      ctx.putImageData(out, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = rawMaskDataUrl;
  });
}

// Creates a bookmatched slab by placing the original and its mirror side by side.
async function createBookmatchedDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blobUrl = URL.createObjectURL(await res.blob());
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = W * 2;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.save();
        ctx.translate(W * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

const SURFACE_LABELS: Record<SurfaceType, string> = {
  floor: "Floor",
  wall: "Wall",
  countertop: "Countertop",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizerAI({ currentSlab, comparisons }: Props) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const photoImgRef   = useRef<HTMLImageElement>(null);
  // Tap pixel coordinates — used by the floor geometry pipeline for connectivity filtering.
  // Stored in a ref (not state) to avoid stale-closure issues in async runRender calls.
  const tapPixelR = useRef<{ x: number; y: number } | null>(null);

  // Roomvo-style room cache — AI outputs + derived floor geometry, computed once
  // per photo/tap and reused across marble swaps and texture-setting changes.
  const { roomCacheRef, status: roomStatus, startProcessing, createRoom, invalidate: invalidateRoomCache } = useRoomCache();

  const [phase, setPhase] = useState<Phase>("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const [roomPreviewUrl, setRoomPreviewUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  const [tapDisplay, setTapDisplay] = useState<{ pct: { x: number; y: number } } | null>(null);

  const [alphaMaskBase64, setAlphaMaskBase64] = useState<string | null>(null);

  const [activeSlab, setActiveSlab] = useState<SlabOption>(currentSlab);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [loadingMsg, setLoadingMsg] = useState("");

  const [bookmatch, setBookmatch] = useState(false);
  const [surfaceType, setSurfaceType] = useState<SurfaceType | null>(null);

  // Surface discovery state — populated by runDiscovery after upload
  const [surfaceCandidates, setSurfaceCandidates] = useState<SurfaceCandidate[]>([]);
  const [discoveryError, setDiscoveryError]       = useState<string | null>(null);

  // ── Floor correction state ───────────────────────────────────────────────────
  // rawMaskDataUrl: original Replicate output used as a red debug overlay in floor_correction phase
  const [rawMaskDataUrl, setRawMaskDataUrl] = useState<string | null>(null);
  // Corners the staff has tapped to manually define the floor quad
  type FloorCorner = { pct: { x: number; y: number }; natural: { x: number; y: number } };
  const [manualFloorCorners, setManualFloorCorners] = useState<FloorCorner[]>([]);
  // The quad that was actually used for the last successful floor render (auto or manual).
  // Cached so slab comparisons and bookmatch toggles reuse it without re-running SAM.
  const [lastFloorQuad, setLastFloorQuad] = useState<Quad | null>(null);
  // Floor texture mode — independent of the wall/countertop bookmatch toggle
  const [floorMode, setFloorMode] = useState<TextureMode>("continuous");
  // Debug overlay — pipeline stage visualizations (staff-only toggle)
  const [debugMode, setDebugMode]     = useState(false);
  const [debugInfo, setDebugInfo]     = useState<DebugInfo | null>(null);
  const [floorConfidence, setFloorConfidence] = useState<"high" | "low" | null>(null);

  // Phase 2 — Grounding DINO object detection (occlusion)
  const [objectBoxes, setObjectBoxes]           = useState<BoundingBox[]>([]);
  const [allObjectBoxes, setAllObjectBoxes]     = useState<BoundingBox[]>([]);  // unfiltered, for debug overlay
  const [occlusionSkipped, setOcclusionSkipped] = useState(true);
  const [dinoDiagnostic, setDinoDiagnostic]     = useState<DiagnosticChecks | null>(null);
  const [promptTests, setPromptTests]               = useState<PromptTestsResult | null>(null);
  const [promptTestsRunning, setPromptTestsRunning] = useState(false);
  const [deepDiag, setDeepDiag]                     = useState<DeepDiagResult | null>(null);
  const [deepDiagRunning, setDeepDiagRunning]       = useState(false);

  // Phase 3 — Depth Anything V2 (floor geometry)
  const [depthValues, setDepthValues]   = useState<Float32Array | null>(null);
  const [depthSkipped, setDepthSkipped] = useState(true);
  const [depthError,   setDepthError]   = useState<string | null>(null);

  // Phase 4 — Surface normals (floor/wall orientation)
  const [normalValues, setNormalValues]   = useState<Float32Array | null>(null);
  const [normalSkipped, setNormalSkipped] = useState(true);

  // Phase 5 — Texture projection settings
  // Refs hold the latest values for use inside async callbacks without stale-closure issues.
  const [groutPx,     setGroutPx]     = useState(3);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1.0);
  const [tileWidthMm, setTileWidthMm] = useState(1200);
  const [tileHeightMm, setTileHeightMm] = useState(2400);
  const groutPxR      = useRef(3);
  const rotationDegR  = useRef(0);
  const scaleFactorR  = useRef(1.0);
  const tileWidthMmR  = useRef(1200);
  const tileHeightMmR = useRef(2400);
  // Sync-refs: state updates are async — runRender reads these refs so it always
  // gets the values parsed in the same pipeline run, never stale closures.
  const objectBoxesR  = useRef<BoundingBox[]>([]);
  const depthValuesR  = useRef<Float32Array | null>(null);
  const normalValuesR = useRef<Float32Array | null>(null);

  // Phase 6 — Brightness / Finish (post-process; no segmentation re-run)
  const [baseResultUrl,  setBaseResultUrl]  = useState<string | null>(null);
  const [featherDataUrl, setFeatherDataUrl] = useState<string | null>(null);
  const [brightnessEV,   setBrightnessEV]   = useState(0);
  const [finish,         setFinish]         = useState<FinishMode>("gloss");
  const brightnessEVR = useRef(0);

  // Lazily compute occlusion debug visuals only when debug panel is visible.
  // Stage 2 "DINO boxes" uses allObjectBoxes (everything API returned — Step 4).
  // Per-category masks use objectBoxes (same set, just also drives the render).
  const occlusionDebugData = useMemo(() => {
    if (!debugMode || occlusionSkipped || imgNatural.w === 0) return null;
    const masks = buildOcclusionMasks(objectBoxes, imgNatural.w, imgNatural.h);
    return {
      // Step 4: draw EVERY box returned (allObjectBoxes = all above API threshold)
      boxesUrl:     drawBoxesDebug(allObjectBoxes, imgNatural.w, imgNatural.h),
      furnitureUrl: maskCategoryToDataUrl(masks.furnitureMask,     imgNatural.w, imgNatural.h, [255,  70,  70, 180]),
      stairUrl:     maskCategoryToDataUrl(masks.stairMask,         imgNatural.w, imgNatural.h, [255, 155,   0, 180]),
      wallUrl:      maskCategoryToDataUrl(masks.wallMask,          imgNatural.w, imgNatural.h, [ 90,  90, 255, 180]),
      skirtingUrl:  maskCategoryToDataUrl(masks.skirtingMask,      imgNatural.w, imgNatural.h, [  0, 210, 200, 180]),
      combinedUrl:  maskCategoryToDataUrl(masks.combinedOcclusion, imgNatural.w, imgNatural.h, [255,  50,  50, 180]),
    };
  }, [debugMode, occlusionSkipped, objectBoxes, allObjectBoxes, imgNatural.w, imgNatural.h]);

  // Lazily compute depth debug visuals only when debug panel is visible
  const depthDebugData = useMemo(() => {
    if (!debugMode || !depthValues || imgNatural.w === 0) return null;
    return {
      colormapUrl: depthToColorDataUrl(depthValues, imgNatural.w, imgNatural.h),
      edgesUrl:    depthEdgesToDataUrl(depthValues, imgNatural.w, imgNatural.h),
    };
  }, [debugMode, depthValues, imgNatural.w, imgNatural.h]);


  // ── handlers ────────────────────────────────────────────────────────────────

  function measureImage(url: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1024, h: 768 });
      img.src     = url;
    });
  }

  async function handleFile(file: File) {
    const compressed = await compressPhoto(file);
    const previewUrl = URL.createObjectURL(compressed);
    const dims       = await measureImage(previewUrl);

    setCompressedPhoto(compressed);
    setRoomPreviewUrl(previewUrl);
    setImgNatural(dims);
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setSurfaceType(null);
    setSurfaceCandidates([]);
    setDiscoveryError(null);

    setPhase("analyzing");
    void runDiscovery(compressed, dims, previewUrl);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) void handleFile(f);
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (phase !== "tap") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    setTapDisplay({ pct: { x: pctX, y: pctY } });
    const pixelX = Math.round(pctX * imgNatural.w);
    const pixelY = Math.round(pctY * imgNatural.h);
    tapPixelR.current = { x: pixelX, y: pixelY };
    void runPipeline(pixelX, pixelY);
  }

  async function runDiscovery(
    photo: File,
    dims:  { w: number; h: number },
    roomUrl: string,
  ) {
    try {
      setLoadingMsg("Analyzing room surfaces… (first run may take 1–2 min to warm up)");
      startProcessing();

      const fd = new FormData();
      fd.append("photo",         photo);
      fd.append("naturalWidth",  String(dims.w));
      fd.append("naturalHeight", String(dims.h));

      const depthFd  = new FormData(); depthFd.append("photo",  photo);
      const normalFd = new FormData(); normalFd.append("photo", photo);
      const objFd    = new FormData();
      objFd.append("photo",         photo);
      objFd.append("naturalWidth",  String(dims.w));
      objFd.append("naturalHeight", String(dims.h));

      console.log("Production visualizer: AI started");
      const [discovery, depthResult, normalResult, objResult] = await Promise.all([
        discoverSurfaces(fd),
        getDepthMap(depthFd),
        getSurfaceNormals(normalFd),
        detectObjects(objFd),
      ]);

      // Store shared pipeline results (reused when user selects a candidate)
      objectBoxesR.current = objResult.boxes;
      setObjectBoxes(objResult.boxes);
      setAllObjectBoxes(objResult.allBoxes);
      setOcclusionSkipped(objResult.skipped);
      setDinoDiagnostic(objResult.diagnostic);

      setDepthSkipped(depthResult.skipped);
      setDepthError(depthResult.error);
      if (depthResult.depthDataUrl && dims.w > 0) {
        const parsed = await parseDepthMap(depthResult.depthDataUrl, dims.w, dims.h);
        depthValuesR.current = parsed;
        setDepthValues(parsed);
      }

      setNormalSkipped(normalResult.skipped);
      if (normalResult.normalDataUrl && dims.w > 0) {
        const parsed = await parseNormalMap(normalResult.normalDataUrl, dims.w, dims.h);
        normalValuesR.current = parsed;
        setNormalValues(parsed);
      }

      if (discovery.error && discovery.masks.length === 0) {
        setDiscoveryError(discovery.error);
        setPhase("surface_select");
        return;
      }

      const candidates = await buildSurfaceCandidates(
        discovery.masks,
        roomUrl,
        dims.w, dims.h,
        depthValuesR.current,
        objectBoxesR.current,
      );

      setSurfaceCandidates(candidates);
      setPhase("surface_select");
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Surface analysis failed.");
      setPhase("surface_select");
    }
  }

  async function handleSelectCandidate(candidate: SurfaceCandidate) {
    if (!compressedPhoto) return;
    tapPixelR.current = { x: candidate.tapPixelX, y: candidate.tapPixelY };
    const renderSurface = toRenderSurfaceType(candidate.type);
    setSurfaceType(renderSurface);
    const alpha = await buildAlphaMask(candidate.rawMaskBase64, imgNatural.w, imgNatural.h);
    setAlphaMaskBase64(alpha);
    setRawMaskDataUrl(candidate.rawMaskBase64);
    // Step 1 (Roomvo-style) is already done — AI ran once in runDiscovery.
    // Cache it now so marble swaps never re-run segmentation/depth/normals/occlusion.
    createRoom({
      roomPhotoFile:    compressedPhoto,
      imgWidth:         imgNatural.w,
      imgHeight:        imgNatural.h,
      surfaceType:      renderSurface,
      alphaMaskDataUrl: alpha,
      rawMaskDataUrl:   candidate.rawMaskBase64,
      objectBoxes:      objectBoxesR.current,
      allObjectBoxes,
      occlusionSkipped,
      depthValues:      depthValuesR.current,
      depthSkipped,
      normalValues:     normalValuesR.current,
      normalSkipped,
      tapX: candidate.tapPixelX,
      tapY: candidate.tapPixelY,
    });
    console.log("Production visualizer: room cached");
    await runRender(alpha, activeSlab, renderSurface, bookmatch);
  }

  async function runPipeline(pixelX: number, pixelY: number) {
    if (!compressedPhoto) return;

    try {
      setPhase("segmenting");
      setLoadingMsg("Detecting surface… (first run may take 1–2 min to warm up)");
      startProcessing();

      const detectFd = new FormData();
      detectFd.append("photo", compressedPhoto);
      detectFd.append("pointX", String(pixelX));
      detectFd.append("pointY", String(pixelY));

      const classifyFd = new FormData();
      classifyFd.append("photo", compressedPhoto);
      classifyFd.append("pointX", String(pixelX));
      classifyFd.append("pointY", String(pixelY));
      classifyFd.append("naturalWidth", String(imgNatural.w));
      classifyFd.append("naturalHeight", String(imgNatural.h));

      // Grounding DINO object detection — runs in parallel with SAM, non-fatal
      const objectFd = new FormData();
      objectFd.append("photo", compressedPhoto);
      objectFd.append("naturalWidth",  String(imgNatural.w));
      objectFd.append("naturalHeight", String(imgNatural.h));

      // Depth Anything V2 — runs in parallel, non-fatal, env-gated
      const depthFd = new FormData();
      depthFd.append("photo", compressedPhoto);

      // Surface normals — runs in parallel, non-fatal, env-gated
      const normalFd = new FormData();
      normalFd.append("photo", compressedPhoto);

      // Run SAM, GDINO, depth, normals, and surface classification in parallel
      let detectedSurfaceType: SurfaceType | null = null;
      console.log("Production visualizer: AI started");
      const [detectResult, objectResult, depthResult, normalResult] = await Promise.all([
        detectSurface(detectFd),
        detectObjects(objectFd),
        getDepthMap(depthFd),
        getSurfaceNormals(normalFd),
        classifySurface(classifyFd).then((r) => {
          if (r.surfaceType) {
            detectedSurfaceType = r.surfaceType;
            setSurfaceType(r.surfaceType);
          }
        }),
      ]);

      objectBoxesR.current = objectResult.boxes;
      setObjectBoxes(objectResult.boxes);
      setAllObjectBoxes(objectResult.allBoxes);
      setOcclusionSkipped(objectResult.skipped);
      setDinoDiagnostic(objectResult.diagnostic);
      setPromptTests(null);  // clear stale prompt-test results from previous run

      // Parse depth map client-side (fast Canvas resize — ~5 ms)
      setDepthSkipped(depthResult.skipped);
      setDepthError(depthResult.error);
      if (depthResult.depthDataUrl && imgNatural.w > 0) {
        const parsed = await parseDepthMap(depthResult.depthDataUrl, imgNatural.w, imgNatural.h);
        depthValuesR.current = parsed;
        setDepthValues(parsed);
      } else {
        depthValuesR.current = null;
        setDepthValues(null);
      }

      // Parse normal map client-side (~5 ms)
      setNormalSkipped(normalResult.skipped);
      if (normalResult.normalDataUrl && imgNatural.w > 0) {
        const parsed = await parseNormalMap(normalResult.normalDataUrl, imgNatural.w, imgNatural.h);
        normalValuesR.current = parsed;
        setNormalValues(parsed);
      } else {
        normalValuesR.current = null;
        setNormalValues(null);
      }

      if (detectResult.error || !detectResult.rawMaskBase64) {
        setErrorMsg(detectResult.error ?? "Surface detection returned no mask.");
        setPhase("error");
        return;
      }

      // Store raw Replicate mask for the floor-correction debug overlay
      setRawMaskDataUrl(detectResult.rawMaskBase64);

      const alphaMask = await buildAlphaMask(detectResult.rawMaskBase64, imgNatural.w, imgNatural.h);
      setAlphaMaskBase64(alphaMask);

      // Step 1 (Roomvo-style) done — cache it so marble swaps skip AI + mask geometry.
      createRoom({
        roomPhotoFile:    compressedPhoto,
        imgWidth:         imgNatural.w,
        imgHeight:        imgNatural.h,
        surfaceType:      detectedSurfaceType,
        alphaMaskDataUrl: alphaMask,
        rawMaskDataUrl:   detectResult.rawMaskBase64,
        objectBoxes:      objectResult.boxes,
        allObjectBoxes:   objectResult.allBoxes,
        occlusionSkipped: objectResult.skipped,
        depthValues:      depthValuesR.current,
        depthSkipped:     depthResult.skipped,
        normalValues:     normalValuesR.current,
        normalSkipped:    normalResult.skipped,
        tapX: pixelX,
        tapY: pixelY,
      });
      console.log("Production visualizer: room cached");

      await runRender(alphaMask, activeSlab, detectedSurfaceType, bookmatch);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  async function runRender(
    alphaMask: string,
    slab: SlabOption,
    currentSurfaceType: SurfaceType | null,
    currentBookmatch: boolean,
    /** Explicit floor quad (from manual 4-point or cached from last render). */
    overrideQuad?: Quad,
    /** Pass explicitly when changing mode so the stale closure doesn't win. */
    explicitFloorMode?: TextureMode,
  ) {
    if (!compressedPhoto || !slab.imageUrl) return;

    setPhase("rendering");

    // ── Floor: deterministic Canvas projection — no GPT Image 1 ──────────────
    if (currentSurfaceType === "floor") {
      setLoadingMsg("Projecting slab onto floor…");
      try {
        // Roomvo-style cache: geometry (mask/quad/feather/luminance) is computed
        // once per room/tap and reused here — only the slab/texture settings
        // below ever change on a marble swap, grout/rotation/scale tweak, etc.
        if (!roomCacheRef.current) {
          throw new Error("Room not processed yet — please re-select the surface.");
        }
        const output = await renderFromCache(
          roomCacheRef.current,
          {
            slabImageUrl: slab.imageUrl,
            mode:         explicitFloorMode ?? floorMode,
            groutPx:      groutPxR.current,
            rotationDeg:  rotationDegR.current,
            scaleFactor:  scaleFactorR.current,
            tileWidthMm:  tileWidthMmR.current,
            tileHeightMm: tileHeightMmR.current,
          },
          overrideQuad ?? lastFloorQuad ?? undefined,
        );
        setBaseResultUrl(output.dataUrl);
        setFeatherDataUrl(output.featherDataUrl);
        setLastFloorQuad(output.floorQuad);
        setFloorConfidence(output.confidence);
        setDebugInfo(output.debug);
        setActiveSlab(slab);
        // Apply brightness / finish immediately after render (no segmentation re-run)
        const finished = await applyFloorFinish(
          output.dataUrl, output.featherDataUrl,
          brightnessEVR.current, finish,
        );
        setResultUrl(finished);
        setPhase("result");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Floor rendering failed.";
        // Strip the internal prefix; show a clean message with a manual-select option
        setErrorMsg(msg.replace("NEEDS_MANUAL_FLOOR: ", ""));
        setPhase("error");
      }
      return;
    }

    // ── Wall / countertop / unknown: GPT Image 1 inpainting ──────────────────
    setLoadingMsg("Generating visualization…");

    // Build bookmatched slab reference client-side before sending to server
    let slabImageBase64: string | null = null;
    if (currentBookmatch) {
      slabImageBase64 = await createBookmatchedDataUrl(slab.imageUrl);
    }

    const renderFd = new FormData();
    renderFd.append("photo", compressedPhoto);
    renderFd.append("alphaMaskBase64", alphaMask);
    if (slabImageBase64) {
      renderFd.append("slabImageBase64", slabImageBase64);
    } else {
      renderFd.append("slabImageUrl", slab.imageUrl);
    }
    renderFd.append("marbleName", slab.marbleName ?? slab.slabCode);
    if (currentSurfaceType) renderFd.append("surfaceType", currentSurfaceType);
    renderFd.append("bookmatch", String(currentBookmatch));

    const { resultBase64, error: renderError } = await renderVisualization(renderFd);

    if (renderError || !resultBase64) {
      setErrorMsg(renderError ?? "Rendering failed.");
      setPhase("error");
      return;
    }

    const composited = await compositeResult(compressedPhoto, resultBase64, alphaMask);
    setResultUrl(composited);
    setActiveSlab(slab);
    setPhase("result");
  }

  async function handleCompareSlab(slab: SlabOption) {
    if (!alphaMaskBase64) return;
    await runRender(alphaMaskBase64, slab, surfaceType, bookmatch);
  }

  async function handleBookmatchToggle() {
    const newBookmatch = !bookmatch;
    setBookmatch(newBookmatch);
    if (phase === "result" && alphaMaskBase64 && surfaceType !== "floor") {
      await runRender(alphaMaskBase64, activeSlab, surfaceType, newBookmatch);
    }
  }

  async function handleFloorModeChange(newMode: TextureMode) {
    setFloorMode(newMode);
    if (phase === "result" && alphaMaskBase64) {
      await runRender(
        alphaMaskBase64,
        activeSlab,
        "floor",
        bookmatch,
        lastFloorQuad ?? undefined,
        newMode,
      );
    }
  }

  // Phase 6: re-apply brightness + finish without re-running the Canvas pipeline.
  async function applyFloorFinishNow(newEV: number, newFinish: FinishMode) {
    if (!baseResultUrl || !featherDataUrl) return;
    const finished = await applyFloorFinish(baseResultUrl, featherDataUrl, newEV, newFinish);
    setResultUrl(finished);
  }

  async function handleFinishChange(newFinish: FinishMode) {
    setFinish(newFinish);
    await applyFloorFinishNow(brightnessEVR.current, newFinish);
  }

  function handleDownload() {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${activeSlab.slabCode}-visualization.jpg`;
    link.click();
  }

  // ── Floor correction: collect 4 corners from staff clicks ──────────────────

  const CORNER_LABELS = ["Back-left", "Back-right", "Front-right", "Front-left"] as const;

  function handleFloorCornerClick(e: React.MouseEvent<HTMLImageElement>) {
    // Ignore clicks once 4 corners are selected (render already in progress)
    if (manualFloorCorners.length >= 4) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    const corner = {
      pct: { x: pctX, y: pctY },
      natural: {
        x: Math.round(pctX * imgNatural.w),
        y: Math.round(pctY * imgNatural.h),
      },
    };

    const next = [...manualFloorCorners, corner];
    setManualFloorCorners(next);

    if (next.length === 4 && alphaMaskBase64) {
      const quad: Quad = [
        next[0].natural,
        next[1].natural,
        next[2].natural,
        next[3].natural,
      ] as Quad;
      // Pass floorMode explicitly — closure captures stale state when quad completes
      void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, quad, floorMode);
    }
  }

  function resetToTap() {
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setErrorMsg(null);
    setSurfaceType(null);
    setSurfaceCandidates([]);
    setDiscoveryError(null);
    setManualFloorCorners([]);
    setLastFloorQuad(null);
    setFloorConfidence(null);
    setDebugInfo(null);
    objectBoxesR.current = [];  setObjectBoxes([]);  setAllObjectBoxes([]);
    setOcclusionSkipped(true);  setDinoDiagnostic(null);  setPromptTests(null);  setDeepDiag(null);
    depthValuesR.current = null;  setDepthValues(null);
    setDepthSkipped(true);
    setDepthError(null);
    normalValuesR.current = null; setNormalValues(null);
    setNormalSkipped(true);
    groutPxR.current = 3;      setGroutPx(3);
    rotationDegR.current = 0;  setRotationDeg(0);
    scaleFactorR.current = 1;  setScaleFactor(1);
    setBaseResultUrl(null);
    setFeatherDataUrl(null);
    brightnessEVR.current = 0; setBrightnessEV(0);
    setFinish("gloss");
    tapPixelR.current = null;
    invalidateRoomCache();
    setPhase("tap");
  }

  function resetAll() {
    setCompressedPhoto(null);
    setRoomPreviewUrl(null);
    setTapDisplay(null);
    setAlphaMaskBase64(null);
    setResultUrl(null);
    setErrorMsg(null);
    setActiveSlab(currentSlab);
    setSurfaceType(null);
    setBookmatch(false);
    setSurfaceCandidates([]);
    setDiscoveryError(null);
    setRawMaskDataUrl(null);
    setManualFloorCorners([]);
    setLastFloorQuad(null);
    setFloorMode("continuous");
    setFloorConfidence(null);
    setDebugInfo(null);
    objectBoxesR.current = [];  setObjectBoxes([]);  setAllObjectBoxes([]);
    setOcclusionSkipped(true);  setDinoDiagnostic(null);  setPromptTests(null);  setDeepDiag(null);
    depthValuesR.current = null;  setDepthValues(null);
    setDepthSkipped(true);
    setDepthError(null);
    normalValuesR.current = null; setNormalValues(null);
    setNormalSkipped(true);
    groutPxR.current = 3;      setGroutPx(3);
    rotationDegR.current = 0;  setRotationDeg(0);
    scaleFactorR.current = 1;  setScaleFactor(1);
    tileWidthMmR.current = 1200;  setTileWidthMm(1200);
    tileHeightMmR.current = 2400; setTileHeightMm(2400);
    setBaseResultUrl(null);
    setFeatherDataUrl(null);
    brightnessEVR.current = 0; setBrightnessEV(0);
    setFinish("gloss");
    tapPixelR.current = null;
    invalidateRoomCache();
    setPhase("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── render ───────────────────────────────────────────────────────────────────

  const isLoading = phase === "segmenting" || phase === "rendering";

  const surfaceBadge = surfaceType ? (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
      {SURFACE_LABELS[surfaceType]} detected
    </span>
  ) : null;

  // Roomvo-style status: once the room is cached, marble/setting changes skip
  // AI + floor-geometry recompute entirely (renderFromCache reuses the cache).
  const roomStatusBadge = roomStatus === "ready" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
      Room Ready
    </span>
  ) : roomStatus === "processing" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      Processing room…
    </span>
  ) : null;

  const bookmatchToggle = (
    <button
      type="button"
      onClick={() => void handleBookmatchToggle()}
      disabled={isLoading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        bookmatch
          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <FlipHorizontal className="h-3.5 w-3.5" />
      Bookmatch
    </button>
  );

  return (
    <div>
      {/* Upload phase */}
      {phase === "upload" && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          {currentSlab.thumbnailUrl && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                Slab texture
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentSlab.thumbnailUrl}
                alt={currentSlab.slabCode}
                className="h-28 w-44 rounded-lg object-cover"
              />
            </div>
          )}

          <div
            className="flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-8 py-14 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Camera className="h-10 w-10 text-gray-400" />
            <div className="text-center">
              <p className="font-semibold text-gray-700">Upload a room photo</p>
              <p className="mt-1 text-sm text-gray-400">
                Take or upload a photo of the client&apos;s space
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* Analyzing phase — auto-discovery running */}
      {phase === "analyzing" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3.5">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-500" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Scanning room surfaces…</p>
              <p className="mt-0.5 text-xs text-indigo-600">
                Detecting floor, walls, and other surfaces. First run may take 1–2 min.
              </p>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roomPreviewUrl}
            alt="Room"
            className="w-full rounded-xl border border-gray-200 opacity-50 shadow-sm"
            draggable={false}
          />
          {/* Skeleton cards hinting at what's being found */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Floor", "Back Wall", "Left Wall", "Right Wall"].map((label) => (
              <div key={label} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <div className="aspect-[4/3] w-full animate-pulse bg-gray-200" />
                <div className="p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    <div className="h-4 w-6 animate-pulse rounded-full bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Surface select phase — show auto-detected candidates */}
      {phase === "surface_select" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          {discoveryError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">Surface scan issue</p>
              <p className="mt-0.5 text-xs text-amber-600">{discoveryError}</p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-gray-700">
              Select the surface where you want to apply marble
            </p>
          )}

          {surfaceCandidates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {surfaceCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void handleSelectCandidate(c)}
                  className="group flex flex-col overflow-hidden rounded-xl border-2 border-transparent bg-white shadow-sm transition-all hover:border-indigo-400 hover:shadow-md active:scale-[0.97]"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.previewDataUrl}
                      alt={c.label}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.04]"
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-between px-2.5 pt-2">
                    <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        c.confidence >= 70
                          ? "bg-green-100 text-green-700"
                          : c.confidence >= 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.confidence}%
                    </span>
                  </div>
                  <p className="px-2.5 pb-2.5 text-[11px] text-gray-400">{c.coveragePct}% of image</p>
                </button>
              ))}
            </div>
          ) : !discoveryError ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No surfaces detected automatically.</p>
              <p className="mt-1 text-xs text-gray-400">Use manual selection below to tap a surface.</p>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <hr className="flex-1 border-gray-200" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPhase("tap")}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Select surface manually
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              New photo
            </button>
          </div>
        </div>
      )}

      {/* Tap phase */}
      {phase === "tap" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <Scan className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="text-sm text-indigo-800">
              <span className="font-semibold">Tap once</span> on the floor, wall, or countertop surface you want to replace with marble.
            </span>
          </div>

          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={photoImgRef}
              src={roomPreviewUrl}
              alt="Room"
              className="w-full cursor-crosshair rounded-xl border border-gray-200 shadow-sm"
              onLoad={(e) =>
                setImgNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onClick={handleImageClick}
              draggable={false}
            />
            {tapDisplay && (
              <div
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-lg"
                style={{
                  left: `${tapDisplay.pct.x * 100}%`,
                  top: `${tapDisplay.pct.y * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            {bookmatchToggle}
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Change photo
            </button>
          </div>
        </div>
      )}

      {/* Loading phases */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl ?? roomPreviewUrl ?? ""}
            alt="Room"
            className="w-full rounded-xl border border-gray-200 opacity-60 shadow-sm"
            draggable={false}
          />
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">{loadingMsg}</span>
            </div>
            {surfaceBadge}
          </div>
        </div>
      )}

      {/* Floor correction phase — staff taps 4 corners to define the floor plane */}
      {phase === "floor_correction" && roomPreviewUrl && (
        <div className="flex flex-col gap-4">
          {/* Instruction banner */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Floor detection needs correction.</span>{" "}
              {manualFloorCorners.length < 4 ? (
                <>
                  Tap corner{" "}
                  <span className="font-medium">
                    {manualFloorCorners.length + 1} of 4 —{" "}
                    {CORNER_LABELS[manualFloorCorners.length]}
                  </span>
                  {manualFloorCorners.length >= 2 && (
                    <span className="block mt-1 text-amber-700 text-xs">
                      Tip: click the two front points at the very bottom edge of the visible floor for full coverage.
                    </span>
                  )}
                </>
              ) : (
                "All 4 corners selected — rendering…"
              )}
            </div>
          </div>

          {/* Corner progress pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {CORNER_LABELS.map((label, i) => (
              <div
                key={i}
                className={`rounded-lg px-2 py-1.5 text-center text-xs font-medium border transition-all ${
                  i < manualFloorCorners.length
                    ? "border-blue-300 bg-blue-500 text-white"
                    : i === manualFloorCorners.length
                    ? "border-amber-300 bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>

          {/* Room photo with SAM debug overlay + corner markers */}
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roomPreviewUrl}
              alt="Room"
              className="w-full cursor-crosshair rounded-xl border border-amber-300 shadow-sm"
              onClick={handleFloorCornerClick}
              draggable={false}
            />

            {/* Red tint overlay: white areas in rawMask = what SAM detected */}
            {rawMaskDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rawMaskDataUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full rounded-xl"
                style={{
                  mixBlendMode: "screen",
                  filter: "sepia(1) saturate(5) hue-rotate(330deg) brightness(0.8)",
                  opacity: 0.45,
                }}
                draggable={false}
              />
            )}

            {/* Numbered corner markers */}
            {manualFloorCorners.map((c, i) => (
              <div
                key={i}
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-bold text-white shadow-lg"
                style={{ left: `${c.pct.x * 100}%`, top: `${c.pct.y * 100}%` }}
              >
                {i + 1}
              </div>
            ))}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1">
              <div className="h-3 w-3 rounded-sm bg-red-400 opacity-80" />
              <span className="text-xs text-white">SAM detected area (red = what was included)</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManualFloorCorners([])}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset corners
            </button>
            <button
              type="button"
              onClick={resetToTap}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Retap surface
            </button>
          </div>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-sm font-semibold text-red-700">Something went wrong</p>
            <p className="mt-1 text-sm text-red-600">{errorMsg}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => surfaceCandidates.length > 0 ? setPhase("surface_select") : resetToTap()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {surfaceCandidates.length > 0 ? "Pick surface" : "Try again"}
            </button>
            {surfaceType === "floor" && rawMaskDataUrl && (
              <button
                type="button"
                onClick={() => { setManualFloorCorners([]); setPhase("floor_correction"); }}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                Select corners manually
              </button>
            )}
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              New photo
            </button>
          </div>
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && resultUrl && (
        <div className="flex flex-col gap-5">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {activeSlab.marbleName ?? activeSlab.slabCode} applied
              </span>
              {surfaceBadge}
              {surfaceType === "floor" && roomStatusBadge}
              {surfaceType === "floor" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <Layers2 className="h-3 w-3" />
                  Exact slab texture
                </span>
              )}
              {surfaceType === "floor" && floorConfidence === "low" && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                  Low confidence — verify floor area
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {surfaceType === "floor" ? (
                <div className="flex overflow-hidden rounded-lg border border-gray-200 text-sm">
                  {([
                    ["continuous",  "Slab"],
                    ["tile",        "Tile"],
                    ["bookmatch",   "2-Way"],
                    ["bookmatch4",  "4-Way"],
                  ] as const).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleFloorModeChange(m)}
                      className={`px-3 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                        floorMode === m
                          ? "bg-indigo-600 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                bookmatchToggle
              )}
              {surfaceType === "floor" && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => { setManualFloorCorners([]); setPhase("floor_correction"); }}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Adjust floor area
                </button>
              )}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              {surfaceCandidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPhase("surface_select")}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Pick surface
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetToTap}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retap surface
                </button>
              )}
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                New photo
              </button>
              {surfaceType === "floor" && (
                <button
                  type="button"
                  onClick={() => setDebugMode((v) => !v)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    debugMode
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-gray-200 text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  Debug
                </button>
              )}
            </div>
          </div>

          {/* Texture settings panel — floor only (hidden when debug split view is active) */}
          {surfaceType === "floor" && !(debugMode && debugInfo) && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Texture settings
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-3">

                {/* Grout width */}
                <label className="flex min-w-27.5 flex-col gap-1">
                  <span className="text-xs text-gray-500">Grout — {groutPx}px</span>
                  <input
                    type="range" min="0" max="8" step="1"
                    value={groutPx}
                    disabled={isLoading}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      groutPxR.current = v; setGroutPx(v);
                    }}
                    onPointerUp={() => {
                      if (phase === "result" && alphaMaskBase64)
                        void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined);
                    }}
                    className="accent-indigo-600"
                  />
                </label>

                {/* Rotation */}
                <label className="flex min-w-32.5 flex-col gap-1">
                  <span className="text-xs text-gray-500">Rotation — {rotationDeg}°</span>
                  <input
                    type="range" min="-45" max="45" step="1"
                    value={rotationDeg}
                    disabled={isLoading}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      rotationDegR.current = v; setRotationDeg(v);
                    }}
                    onPointerUp={() => {
                      if (phase === "result" && alphaMaskBase64)
                        void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined);
                    }}
                    className="accent-indigo-600"
                  />
                </label>

                {/* Scale */}
                <label className="flex min-w-32.5 flex-col gap-1">
                  <span className="text-xs text-gray-500">Scale — {scaleFactor.toFixed(1)}×</span>
                  <input
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={scaleFactor}
                    disabled={isLoading}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      scaleFactorR.current = v; setScaleFactor(v);
                    }}
                    onPointerUp={() => {
                      if (phase === "result" && alphaMaskBase64)
                        void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined);
                    }}
                    className="accent-indigo-600"
                  />
                </label>

                {/* Brightness */}
                <label className="flex min-w-32.5 flex-col gap-1">
                  <span className="text-xs text-gray-500">
                    Brightness — {brightnessEV > 0 ? "+" : ""}{brightnessEV}
                  </span>
                  <input
                    type="range" min="-5" max="5" step="1"
                    value={brightnessEV}
                    disabled={isLoading}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      brightnessEVR.current = v; setBrightnessEV(v);
                    }}
                    onPointerUp={() => {
                      if (phase === "result")
                        void applyFloorFinishNow(brightnessEVR.current, finish);
                    }}
                    className="accent-indigo-600"
                  />
                </label>

                {/* Finish */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Finish</span>
                  <div className="flex gap-1">
                    {(["matte", "gloss"] as FinishMode[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleFinishChange(f)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50 ${
                          finish === f
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tile dimensions — only meaningful in tile mode */}
                {floorMode === "tile" && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Tile width (mm)</span>
                      <input
                        type="number" min="200" max="3000" step="100"
                        value={tileWidthMm}
                        disabled={isLoading}
                        onChange={(e) => {
                          const v = Math.max(200, Number(e.target.value));
                          tileWidthMmR.current = v; setTileWidthMm(v);
                        }}
                        onBlur={() => {
                          if (phase === "result" && alphaMaskBase64)
                            void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined);
                        }}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Tile height (mm)</span>
                      <input
                        type="number" min="200" max="3000" step="100"
                        value={tileHeightMm}
                        disabled={isLoading}
                        onChange={(e) => {
                          const v = Math.max(200, Number(e.target.value));
                          tileHeightMmR.current = v; setTileHeightMm(v);
                        }}
                        onBlur={() => {
                          if (phase === "result" && alphaMaskBase64)
                            void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined);
                        }}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Debug split-screen OR Before / Slab / After */}
          {debugMode && debugInfo && debugInfo.wallOverlapPct !== undefined ? (() => {
            const pipelineStages: { label: string; src: string | null; hint: string }[] = [
              { label: "Raw SAM mask",           src: debugInfo.rawMaskDataUrl,                    hint: "Blue = raw SAM segmentation output" },
              { label: "Object boxes (DINO)",    src: occlusionDebugData?.boxesUrl ?? null,         hint: "Detected furniture/objects by category (DINO occlusion only)" },
              { label: "Object masks (union)",   src: occlusionDebugData?.combinedUrl ?? null,      hint: "Union of all object blocking masks" },
              { label: "Wall mask (opt.)",       src: occlusionDebugData?.wallUrl ?? null,           hint: "Blue = structural elements (not used for floor detection)" },
              { label: "Stair mask",             src: occlusionDebugData?.stairUrl ?? null,         hint: "Orange = stair structures" },
              { label: "Furniture mask",         src: occlusionDebugData?.furnitureUrl ?? null,     hint: "Red = chairs, tables, sofas, cabinets" },
              { label: "Skirting mask",          src: occlusionDebugData?.skirtingUrl ?? null,      hint: "Cyan = baseboards, skirting boards" },
              { label: "Occlusion mask",         src: occlusionDebugData?.combinedUrl ?? null,      hint: "Combined occlusion (subtracted from floor)" },
              { label: "Depth map",              src: depthDebugData?.colormapUrl ?? null,          hint: "Purple=close · yellow=far" },
              { label: "Depth edges",            src: depthDebugData?.edgesUrl ?? null,             hint: "Red = furniture/stair depth edges" },
              { label: "Depth-consistent floor", src: debugInfo.depthConsistentMaskDataUrl,         hint: "Cyan = smooth-depth floor (Stage 11)" },
              { label: "Floor-wall boundary",    src: debugInfo.boundaryDataUrl,                    hint: "Yellow = per-column floor-top line (Stage 12)" },
              { label: "Final visible floor",    src: debugInfo.finalMaskDataUrl,                   hint: "White = pixels receiving marble texture" },
            ];
            const confPct     = debugInfo.confidencePct;
            const wf          = debugInfo.coverageWaterfall;
            const finalCovPct = wf ? Math.round(wf.final * 100) : debugInfo.coveragePct;
            const isLowCov    = finalCovPct < 8;
            const isGood      = !isLowCov && confPct >= 75 && debugInfo.wallOverlapPct < 2;
            return (
              <div className="rounded-xl border border-violet-900 bg-gray-950 overflow-hidden">
                {/* Header bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Pipeline Debug</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                      <span>{debugInfo.confidence === "high" ? "High" : "Low"} confidence</span>
                      <span className="text-gray-700">•</span>
                      <span>{debugInfo.coveragePct}% floor</span>
                      <span className="text-gray-700">•</span>
                      <span>Pass {debugInfo.passUsed}</span>
                      <span className="text-gray-700">•</span>
                      <span>Occlusion <span className={occlusionSkipped ? "text-red-500" : "text-green-500"}>{occlusionSkipped ? "OFF" : "ON"}</span></span>
                      <span className="text-gray-700">•</span>
                      <span>Connectivity <span className={debugInfo.connectivityUsed ? "text-green-500" : "text-gray-500"}>{debugInfo.connectivityUsed ? "ON" : "OFF"}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      confPct >= 75 ? "bg-green-900/60 text-green-300 border-green-800"
                      : confPct >= 50 ? "bg-amber-900/60 text-amber-300 border-amber-800"
                      : "bg-red-900/60 text-red-300 border-red-800"
                    }`}>Confidence: {confPct}%</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-900/60 text-blue-300 border border-blue-800">Mode: Floor</span>
                  </div>
                </div>

                {/* Two-column split: pipeline LEFT, render+settings RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">

                  {/* ── LEFT: pipeline stages + legend + stats ── */}
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-400">Floor Detection Pipeline</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {pipelineStages.map(({ label, src, hint }, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-0.5">
                              <span className="text-[9px] font-mono text-gray-600 w-3 shrink-0">{idx + 1}</span>
                              <span className="text-[9px] font-medium text-gray-400 leading-tight truncate" title={label}>{label}</span>
                            </div>
                            {src ? (
                              <div className="relative rounded overflow-hidden border border-gray-800 bg-black" style={{ aspectRatio: "4/3" }}>
                                {roomPreviewUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={roomPreviewUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" draggable={false} />
                                )}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover" draggable={false} title={hint} />
                              </div>
                            ) : (
                              <div className="rounded border border-gray-800 bg-gray-900 flex items-center justify-center text-[8px] text-gray-700" style={{ aspectRatio: "4/3" }}>
                                {occlusionSkipped && idx >= 1 && idx <= 7 ? "DINO off" : depthSkipped && idx >= 8 && idx <= 11 ? "Depth off" : "—"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mask legend */}
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Mask Legend</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {([
                          { label: "Floor (final)",         color: "bg-white" },
                          { label: "Walls",                 color: "bg-[#5a5aff]" },
                          { label: "Stairs",                color: "bg-[#ff9b00]" },
                          { label: "Furniture",             color: "bg-[#ff4646]" },
                          { label: "Skirting / Baseboards", color: "bg-[#00d2c8]" },
                          { label: "Other Objects",         color: "bg-gray-500" },
                          { label: "Depth Consistent",      color: "bg-emerald-400" },
                          { label: "Depth Edges",           color: "bg-gray-300" },
                        ] as const).map(({ label, color }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 border border-gray-700 ${color}`} />
                            <span className="text-[10px] text-gray-400 leading-none">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coverage waterfall */}
                    {wf && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Coverage Waterfall</p>
                        <div className="space-y-0.5">
                          {([
                            { label: "SAM floor",      v: wf.sam },
                            { label: "After depth",    v: wf.depth },
                            { label: "After normals",  v: wf.normals },
                            { label: "After boundary", v: wf.boundary },
                            { label: "After trapezoid",v: wf.trapezoid },
                            { label: "After objects",  v: wf.occlusion },
                            { label: "Final",          v: wf.final },
                          ]).map(({ label, v }) => {
                            const pct = Math.round(v * 100);
                            const drop = label !== "SAM floor" && v < wf.sam * 0.6;
                            return (
                              <div key={label} className="flex items-center gap-1.5">
                                <span className="text-[9px] text-gray-500 w-24 shrink-0">{label}:</span>
                                <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${drop ? "bg-red-500" : label === "Final" ? "bg-green-500" : "bg-blue-600"}`}
                                    style={{ width: `${Math.min(100, pct * 2.5)}%` }}
                                  />
                                </div>
                                <span className={`text-[9px] tabular-nums w-7 text-right ${drop ? "text-red-400" : label === "Final" ? "text-green-400" : "text-gray-400"}`}>{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Floor stats */}
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Floor Stats</p>
                      <div className="space-y-1">
                        {([
                          { label: "Final coverage",   value: `${finalCovPct}%`,                            good: finalCovPct >= 8 },
                          { label: "Wall overlap",      value: `${debugInfo.wallOverlapPct.toFixed(1)}%`,    good: debugInfo.wallOverlapPct < 2 },
                          { label: "Object overlap",    value: `${debugInfo.objectOverlapPct.toFixed(1)}%`,  good: debugInfo.objectOverlapPct < 3 },
                          { label: "Depth consistency", value: debugInfo.depthConsistencyScore.toFixed(2),   good: debugInfo.depthConsistencyScore > 0.80 },
                          { label: "Connectivity",      value: `${debugInfo.connectivityPct}%`,              good: debugInfo.connectivityPct > 70 },
                        ] as const).map(({ label, value, good }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500">{label}:</span>
                            <span className={`text-[10px] font-semibold tabular-nums ${good ? "text-green-400" : "text-red-400"}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Verdict */}
                    <div className={`rounded-lg border p-2 ${isGood ? "border-green-900 bg-green-950/30" : isLowCov ? "border-red-900 bg-red-950/30" : "border-amber-900 bg-amber-950/30"}`}>
                      <p className={`text-[10px] font-semibold ${isGood ? "text-green-400" : isLowCov ? "text-red-400" : "text-amber-400"}`}>
                        {isGood
                          ? `✓ Floor detected. Objects preserved. Coverage ${finalCovPct}%.`
                          : isLowCov
                          ? `✗ Floor detection incomplete: final coverage ${finalCovPct}% (need ≥8%). Check waterfall above for the collapsing step. Try tapping the centre of a larger floor area.`
                          : `⚠ ${debugInfo.wallOverlapPct >= 2 ? `Wall overlap ${debugInfo.wallOverlapPct.toFixed(1)}% — marble may leak onto walls. ` : ""}${debugInfo.depthConsistencyScore < 0.60 ? "Low depth consistency. " : ""}Try tapping the center of a clear floor area.`
                        }
                      </p>
                    </div>

                    {/* Warnings */}
                    {occlusionSkipped && (
                      <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-2">
                        <p className="text-[10px] font-semibold text-amber-400">⚠ Grounding DINO not configured — furniture and objects will NOT be preserved</p>
                        <p className="mt-0.5 text-[10px] text-amber-700">Floor detection still works via SAM + depth + geometry. Add <code className="text-amber-500">GROUNDING_DINO_VERSION=&lt;hash&gt;</code> to .env.local to enable object occlusion.</p>
                      </div>
                    )}
                    {/* ── DINO diagnostic report (Step 10) ────────────────── */}
                    {!occlusionSkipped && dinoDiagnostic && (
                      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-2 space-y-1">
                        <p className="text-[10px] font-semibold text-gray-400">Grounding DINO Diagnostic</p>
                        <div className="grid grid-cols-2 gap-x-2 text-[9px] font-mono">
                          {[
                            ["API reachable",    dinoDiagnostic.apiReachable],
                            ["Prediction done",  dinoDiagnostic.predictionDone],
                            ["Boxes returned",   dinoDiagnostic.rawBoxesPresent],
                            ["Labels parsed",    dinoDiagnostic.labelsParsed],
                            ["Coords valid",     dinoDiagnostic.coordinatesValid],
                            ["Objects detected", dinoDiagnostic.objectsDetected],
                          ].map(([label, ok]) => (
                            <span key={String(label)} className={ok ? "text-green-500" : "text-red-400"}>
                              {ok ? "✓" : "✗"} {String(label)}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 text-[9px] text-gray-600 font-mono space-y-0.5">
                          <div>Image: {dinoDiagnostic.imageSizeKb}KB  {dinoDiagnostic.imageDimensions}  {dinoDiagnostic.imageFormat.split("/")[1]?.toUpperCase() ?? dinoDiagnostic.imageFormat}</div>
                          <div>SHA256: {dinoDiagnostic.sha256Prefix}…</div>
                          <div>Prompt: {dinoDiagnostic.promptTerms} terms  box={dinoDiagnostic.histogram && "0.10"}  text=0.08</div>
                          <div>Request: {dinoDiagnostic.requestMs}ms  Poll: {dinoDiagnostic.pollMs}ms  Retries: {dinoDiagnostic.retryCount}</div>
                          <div>output type: {dinoDiagnostic.outputType}  keys: {dinoDiagnostic.outputKeys.length > 0 ? dinoDiagnostic.outputKeys.join(", ") : "(none)"}</div>
                          {dinoDiagnostic.histogram && (
                            <div>Conf: &gt;80%={dinoDiagnostic.histogram.above80}  &gt;50%={dinoDiagnostic.histogram.above50}  &gt;20%={dinoDiagnostic.histogram.above20}  &gt;10%={dinoDiagnostic.histogram.above10}</div>
                          )}
                        </div>
                        {dinoDiagnostic.failedStep && (
                          <p className="text-[9px] text-red-400 font-mono mt-1">✗ {dinoDiagnostic.failedStep}</p>
                        )}
                      </div>
                    )}

                    {/* ── Prompt-test panel (Step 6) ───────────────────────── */}
                    {!occlusionSkipped && compressedPhoto && (
                      <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-gray-400">Prompt Tests (Step 6)</p>
                          <button
                            onClick={async () => {
                              setPromptTestsRunning(true);
                              try {
                                const fd = new FormData();
                                fd.append("photo", compressedPhoto);
                                fd.append("naturalWidth",  String(imgNatural.w));
                                fd.append("naturalHeight", String(imgNatural.h));
                                const result = await detectObjectsPromptTests(fd);
                                setPromptTests(result);
                              } finally {
                                setPromptTestsRunning(false);
                              }
                            }}
                            disabled={promptTestsRunning}
                            className="text-[9px] px-2 py-0.5 rounded bg-violet-900/60 text-violet-300 hover:bg-violet-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {promptTestsRunning ? "Running…" : "Run 4 tests"}
                          </button>
                        </div>
                        {promptTests && !promptTests.skipped && (
                          <div className="space-y-1">
                            {promptTests.tests.map((t) => (
                              <div key={t.label} className="rounded border border-gray-800 bg-gray-950/60 p-1.5">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[9px] font-semibold text-gray-300">{t.label}</span>
                                  <span className={`text-[9px] font-mono ${t.totalRaw > 0 ? "text-green-400" : "text-red-400"}`}>
                                    {t.totalRaw > 0 ? `${t.totalRaw} box${t.totalRaw !== 1 ? "es" : ""}` : "ZERO"}
                                  </span>
                                </div>
                                <p className="text-[8px] text-gray-700 font-mono leading-tight">{t.prompt.slice(0, 60)}{t.prompt.length > 60 ? "…" : ""}</p>
                                {t.totalRaw > 0 && (
                                  <p className="text-[8px] text-gray-500 mt-0.5 font-mono">
                                    {t.boxes.slice(0, 4).map(b => `${b.label}(${(b.confidence*100).toFixed(0)}%)`).join(", ")}{t.boxes.length > 4 ? "…" : ""}
                                  </p>
                                )}
                                {t.error && <p className="text-[8px] text-red-500 mt-0.5">{t.error}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {promptTests?.skipped && (
                          <p className="text-[9px] text-red-400">DINO not configured — tests skipped</p>
                        )}
                        {!promptTests && !promptTestsRunning && (
                          <p className="text-[9px] text-gray-700">Click "Run 4 tests" to diagnose prompt/threshold issues.</p>
                        )}
                      </div>
                    )}

                    {/* ── Deep diagnostic: 6 prompts × 5 thresholds (Step 7+8) ── */}
                    {!occlusionSkipped && compressedPhoto && (
                      <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400">Deep Diag — 6×5 threshold table</p>
                            <p className="text-[8px] text-gray-700">chair/table/door/stairs/wall/floor at 0.01–0.30 (30 API calls)</p>
                          </div>
                          <button
                            onClick={async () => {
                              setDeepDiagRunning(true);
                              try {
                                const fd = new FormData();
                                fd.append("photo", compressedPhoto);
                                fd.append("naturalWidth",  String(imgNatural.w));
                                fd.append("naturalHeight", String(imgNatural.h));
                                const result = await detectObjectsDeepDiag(fd);
                                setDeepDiag(result);
                              } finally {
                                setDeepDiagRunning(false);
                              }
                            }}
                            disabled={deepDiagRunning}
                            className="text-[9px] px-2 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deepDiagRunning ? "Running 30 calls…" : "Run deep diag"}
                          </button>
                        </div>
                        {deepDiag && !deepDiag.skipped && (
                          <pre className="text-[8px] font-mono text-gray-400 bg-gray-950 rounded p-2 overflow-x-auto leading-tight whitespace-pre">
                            {deepDiag.table}
                          </pre>
                        )}
                        {deepDiag?.skipped && <p className="text-[9px] text-red-400">DINO not configured</p>}
                      </div>
                    )}

                    {depthSkipped && (
                      <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-2">
                        <p className="text-[10px] font-semibold text-amber-400">
                          {depthError ? "✗ Depth estimation failed" : "⚠ Depth not configured — floor boundary detection unavailable"}
                        </p>
                        {depthError
                          ? <p className="mt-0.5 text-[9px] text-amber-500 font-mono break-all">{depthError}</p>
                          : <p className="mt-0.5 text-[10px] text-amber-700">Add <code className="text-amber-500">DEPTH_ANYTHING_VERSION=&lt;hash&gt;</code> to .env.local</p>
                        }
                      </div>
                    )}
                    {!depthSkipped && normalSkipped && (
                      <div className="rounded-lg border border-blue-900 bg-blue-950/30 p-2">
                        <p className="text-[10px] text-blue-400">ℹ Normals derived from depth map — no extra model needed.</p>
                      </div>
                    )}
                  </div>

                  {/* ── RIGHT: render result + slab info + texture settings ── */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Render Result (Live)</p>
                      {isGood && !occlusionSkipped && (
                        <span className="text-[10px] font-semibold text-green-400">✓ Objects preserved · Leakage minimized</span>
                      )}
                      {isGood && occlusionSkipped && (
                        <span className="text-[10px] font-semibold text-blue-400">✓ Floor detected (no object blocking)</span>
                      )}
                      {isLowCov && (
                        <span className="text-[10px] font-semibold text-red-400">✗ Coverage too low — {finalCovPct}%</span>
                      )}
                    </div>

                    {/* Live render */}
                    <div className="rounded-lg overflow-hidden border border-gray-700 bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resultUrl} alt="Render result" className="w-full" draggable={false} />
                    </div>
                    <p className="text-[9px] text-gray-600 text-center">Debug overlay is OFF. Only final composite shown.</p>

                    {/* Slab info + texture settings */}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800">
                      {/* Slab info */}
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Slab & Texture Info</p>
                        <div className="flex gap-2 items-start">
                          {activeSlab.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={activeSlab.thumbnailUrl} alt={activeSlab.slabCode} className="h-14 w-[4.5rem] shrink-0 object-cover rounded border border-gray-700" draggable={false} />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-200 truncate">{activeSlab.marbleName ?? activeSlab.slabCode}</p>
                            <p className="text-[10px] text-gray-500">Lot: {activeSlab.slabCode}</p>
                            <p className="text-[10px] text-gray-500">Finish: {finish === "gloss" ? "Gloss" : "Matte"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Texture settings (compact) */}
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Texture Settings</p>
                        <div className="space-y-1.5">
                          {([
                            { label: "Grout",      display: `${groutPx}px`,                          min: 0,   max: 8,   step: 1,   val: groutPx,      onChangeVal: (v: number) => { groutPxR.current = v; setGroutPx(v); },     onUp: () => { if (phase === "result" && alphaMaskBase64) void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined); } },
                            { label: "Rotation",   display: `${rotationDeg}°`,                       min: -45, max: 45,  step: 1,   val: rotationDeg,  onChangeVal: (v: number) => { rotationDegR.current = v; setRotationDeg(v); }, onUp: () => { if (phase === "result" && alphaMaskBase64) void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined); } },
                            { label: "Scale",      display: `${scaleFactor.toFixed(1)}×`,            min: 0.5, max: 2.0, step: 0.1, val: scaleFactor,  onChangeVal: (v: number) => { scaleFactorR.current = v; setScaleFactor(v); }, onUp: () => { if (phase === "result" && alphaMaskBase64) void runRender(alphaMaskBase64, activeSlab, "floor", bookmatch, lastFloorQuad ?? undefined); } },
                            { label: "Brightness", display: `${brightnessEV > 0 ? "+" : ""}${brightnessEV}`, min: -5, max: 5, step: 1, val: brightnessEV, onChangeVal: (v: number) => { brightnessEVR.current = v; setBrightnessEV(v); }, onUp: () => { if (phase === "result") void applyFloorFinishNow(brightnessEVR.current, finish); } },
                          ]).map(({ label, display, min, max, step, val, onChangeVal, onUp }) => (
                            <div key={label} className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 w-14 shrink-0">{label}</span>
                              <input
                                type="range" min={min} max={max} step={step} value={val}
                                disabled={isLoading}
                                onChange={(e) => onChangeVal(Number(e.target.value))}
                                onPointerUp={onUp}
                                className="flex-1 accent-indigo-600"
                              />
                              <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums shrink-0">{display}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 w-14 shrink-0">Finish</span>
                            <div className="flex gap-1">
                              {(["matte", "gloss"] as FinishMode[]).map((f) => (
                                <button key={f} type="button" disabled={isLoading}
                                  onClick={() => void handleFinishChange(f)}
                                  className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors disabled:opacity-50 ${
                                    finish === f ? "bg-indigo-600 text-white" : "border border-gray-700 text-gray-500 hover:text-gray-300"
                                  }`}
                                >{f === "gloss" ? "Gloss" : "Matte"}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            /* Normal before / slab / after view */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Before</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={roomPreviewUrl ?? ""}
                  alt="Before"
                  className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {activeSlab.marbleName ?? activeSlab.slabCode}
                </span>
                {activeSlab.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSlab.thumbnailUrl}
                    alt={activeSlab.slabCode}
                    className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex w-full flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-10 text-xs text-gray-300">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">After</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="After"
                  className="w-full rounded-xl border border-gray-200 shadow-sm object-cover"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {/* Compare with other slabs */}
          {comparisons.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">
                Compare with another slab
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {comparisons.map((slab) => (
                  <button
                    key={slab.id}
                    type="button"
                    onClick={() => void handleCompareSlab(slab)}
                    disabled={isLoading}
                    className={`flex shrink-0 flex-col overflow-hidden rounded-xl border transition-all hover:border-indigo-400 hover:shadow-md disabled:opacity-50 ${
                      activeSlab.id === slab.id
                        ? "border-indigo-500 ring-2 ring-indigo-500"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="h-20 w-28 overflow-hidden bg-gray-100">
                      {slab.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slab.thumbnailUrl}
                          alt={slab.slabCode}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-300">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-left">
                      <p className="truncate w-28 text-xs font-semibold text-gray-900">{slab.slabCode}</p>
                      {slab.marbleName && (
                        <p className="truncate w-28 text-xs text-gray-400">{slab.marbleName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
