export type VisualizerJobResponse =
  | { jobId: string; resultUrl: string; debug: Record<string, unknown> }
  | { error: string; needsManualFloor?: boolean };
