export type SurfaceCategory =
  | "floor" | "wall" | "ceiling" | "stairs"
  | "opening" | "furniture" | "fixture" | "countertop" | "other";

export type Segment = {
  label: string;
  score: number | null;
  maskBase64: string; // base64 PNG, no data: prefix
};

export type BenchmarkResult = {
  modelKey: string;
  modelName: string;
  segments: Segment[];
  inferenceMs: number;
  rawOutput: unknown; // raw Replicate output (no base64 blobs)
  error: string | null;
};

export type TestImage = {
  path: string;        // relative to test-images/surfaces/  e.g. "hallway.png" or "Room with table/chair.png"
  displayName: string;
};

export type ModelKey = "mask2former" | "segformer-b5" | "oneformer";
