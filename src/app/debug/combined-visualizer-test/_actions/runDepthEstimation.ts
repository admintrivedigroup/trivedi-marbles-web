"use server";

import { runDepthBenchmark } from "../../depth-benchmark/_actions/runDepthBenchmark";
import type { PipelineDepthResult } from "../_lib/types";

export async function runDepthEstimation(
  photo:  File,
  width:  string,
  height: string,
): Promise<PipelineDepthResult> {
  const fd = new FormData();
  fd.append("modelId", "depth-anything-v2");
  fd.append("photo",   photo);
  fd.append("width",   width);
  fd.append("height",  height);

  const r = await runDepthBenchmark(fd);
  return {
    depthBase64:      r.depthBase64,
    colorDepthBase64: r.colorDepthBase64,
    inferenceMs:      r.inferenceMs,
    error:            r.error,
  };
}
