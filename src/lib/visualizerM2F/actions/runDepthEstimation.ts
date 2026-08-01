"use server";

import type { PipelineDepthResult } from "../types";
import { runPrediction } from "../replicate";
import { depthAnythingV2 } from "../models/depthAnythingV2";

export async function runDepthEstimation(
  photo:  File,
  width:  string,
  height: string,
): Promise<PipelineDepthResult> {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  const dims  = width && height ? `${width}×${height}` : "(unknown)";

  if (!token) {
    return { depthBase64: null, colorDepthBase64: null, inferenceMs: 0, error: "REPLICATE_API_TOKEN is not set in .env.local." };
  }

  const version = process.env[depthAnythingV2.versionEnvKey] ?? "";
  if (!version) {
    return {
      depthBase64:      null,
      colorDepthBase64: null,
      inferenceMs:      0,
      error:            `${depthAnythingV2.versionEnvKey} is not set in .env.local. ${depthAnythingV2.replicateHint}`,
    };
  }

  const t0 = Date.now();
  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const input   = depthAnythingV2.buildInput(dataUrl);

    const { output, elapsedMs } = await runPrediction(token, version, input, {
      timeoutMs: depthAnythingV2.timeoutMs,
      modelKey:  depthAnythingV2.key,
      imageMeta: {
        name:      photo.name ?? "(unnamed)",
        sizeBytes: photo.size,
        dims,
      },
    });

    const [depthBase64, colorDepthBase64] = await Promise.all([
      depthAnythingV2.parseOutput(output),
      depthAnythingV2.parseColorOutput(output),
    ]);

    if (!depthBase64) {
      console.error("[runDepthEstimation] parseOutput returned null. Raw:", output);
      return {
        depthBase64:      null,
        colorDepthBase64: null,
        inferenceMs:      elapsedMs,
        error:            "Unexpected output format from depth-anything-v2.",
      };
    }

    console.log(
`[runDepthEstimation] Complete
  Runtime:     ${(elapsedMs / 1000).toFixed(1)}s
  Grey depth:  ${Math.round(depthBase64.length / 1024)}KB
  Color depth: ${colorDepthBase64 ? `${Math.round(colorDepthBase64.length / 1024)}KB` : "none"}`,
    );

    return { depthBase64, colorDepthBase64: colorDepthBase64 ?? null, inferenceMs: elapsedMs, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[runDepthEstimation] ✗ ${msg}`);
    return { depthBase64: null, colorDepthBase64: null, inferenceMs: Date.now() - t0, error: msg };
  }
}
