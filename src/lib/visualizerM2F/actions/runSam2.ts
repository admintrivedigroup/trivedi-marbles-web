"use server";

import type { PipelineSamResult } from "../types";
import { runPrediction } from "../replicate";
import { sam2 } from "../models/sam2";

// Optional refinement step: any failure here returns an empty mask list and the floor
// render simply uses Mask2Former's own boundaries.
export async function runSam2(
  photo:  File,
  width:  string,
  height: string,
): Promise<PipelineSamResult> {
  const token   = process.env.REPLICATE_API_TOKEN ?? "";
  const version = process.env[sam2.versionEnvKey] ?? "";
  const dims    = width && height ? `${width}×${height}` : "(unknown)";

  if (!token || !version) {
    return { masksBase64: [], inferenceMs: 0, error: `${sam2.versionEnvKey} is not set in .env.local. ${sam2.replicateHint}` };
  }

  const t0 = Date.now();
  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

    const { output, elapsedMs } = await runPrediction(token, version, sam2.buildInput(dataUrl), {
      timeoutMs:   sam2.timeoutMs,
      modelKey:    sam2.key,
      versionFull: version,
      imageMeta:   { name: photo.name ?? "(unnamed)", sizeBytes: photo.size, dims },
    });

    const masksBase64 = await sam2.parseOutput(output);
    console.log(`[runSam2] Complete — ${masksBase64.length} segments in ${(elapsedMs / 1000).toFixed(1)}s`);
    return { masksBase64, inferenceMs: elapsedMs, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[runSam2] ✗ ${msg}`);
    return { masksBase64: [], inferenceMs: Date.now() - t0, error: msg };
  }
}
