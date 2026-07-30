export type VisualizerInferenceMode = "local" | "replicate";

export type VisualizerTextureMode = "continuous" | "tile" | "bookmatch" | "bookmatch4";

export type RenderVisualizerParams = {
  roomPhoto: File;
  slabImage: File;
  tapX: number;
  tapY: number;
  mode?: VisualizerTextureMode;
  tileWidthMm?: number;
  tileHeightMm?: number;
  groutPx?: number;
  rotationDeg?: number;
  scaleFactor?: number;
  inferenceModeOverride?: VisualizerInferenceMode;
};

export type RenderVisualizerDebug = {
  confidence: "high" | "low";
  coveragePct: number;
  usedManualQuad: boolean;
  depthUsed: boolean;
  normalsUsed: boolean;
  connectivityUsed: boolean;
  mode: VisualizerInferenceMode;
};

export type RenderVisualizerResult =
  | { ok: true; dataUrl: string; debug: RenderVisualizerDebug }
  | { ok: false; error: string; needsManualFloor: boolean };
