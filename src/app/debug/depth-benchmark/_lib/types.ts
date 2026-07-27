export type ModelId = "depth-anything-v2" | "metric3d" | "zoedepth";

export type VisualizationMode = "grayscale" | "color";

export type DepthMetrics = {
  minDepth:        number;   // 0–1 normalised pixel intensity
  maxDepth:        number;
  contrast:        number;   // max - min
  floorGradient:   number;   // |bottom-third mean − top-third mean|
  wallSeparation:  number;   // |left-quarter mean − right-quarter mean| (mid band)
  edgeQuality:     number;   // mean Sobel magnitude
  histogram:       number[]; // 16 normalised buckets
  depthResolution: string;   // e.g. "1920 × 1080"
};

export type DepthResult = {
  modelId:          ModelId;
  modelName:        string;
  depthBase64:      string | null;        // grey/raw depth PNG, base64, no data: prefix
  colorDepthBase64: string | null;        // pre-rendered colour depth from model (optional)
  inferenceMs:      number;
  rawOutput:        unknown;
  error:            string | null;
};

export type TestImage = {
  path:        string;   // relative to test-images/surfaces/
  displayName: string;
};
