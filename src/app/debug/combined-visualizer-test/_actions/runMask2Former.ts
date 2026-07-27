"use server";

import { runBenchmark } from "../../surface-benchmark/_actions/runBenchmark";
import type { PipelineSegResult } from "../_lib/types";

export async function runMask2Former(
  photo:  File,
  width:  string,
  height: string,
): Promise<PipelineSegResult> {
  const fd = new FormData();
  fd.append("model",  "mask2former");
  fd.append("photo",  photo);
  fd.append("width",  width);
  fd.append("height", height);

  const r = await runBenchmark(fd);
  return {
    segments:    r.segments,
    inferenceMs: r.inferenceMs,
    error:       r.error,
  };
}
