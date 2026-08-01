"use server";

import type { PipelineSegResult } from "../types";
import { runPrediction } from "../replicate";
import { mask2former } from "../models/mask2former";

export async function runMask2Former(
  photo:  File,
  width:  string,
  height: string,
): Promise<PipelineSegResult> {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  const dims  = width && height ? `${width}×${height}` : "(unknown)";

  if (!token) {
    return { segments: [], inferenceMs: 0, error: "REPLICATE_API_TOKEN is not set in .env.local." };
  }

  const version = process.env[mask2former.versionEnvKey] ?? "";
  if (!version) {
    return {
      segments:    [],
      inferenceMs: 0,
      error:       `${mask2former.versionEnvKey} is not set in .env.local. ${mask2former.replicateHint}`,
    };
  }

  const t0 = Date.now();
  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const input   = mask2former.buildInput(dataUrl);

    const { output, elapsedMs } = await runPrediction(token, version, input, {
      timeoutMs:   mask2former.timeoutMs,
      modelKey:    mask2former.key,
      versionFull: version,
      imageMeta: {
        name:      photo.name ?? "(unnamed)",
        sizeBytes: photo.size,
        dims,
      },
    });

    const segments = await mask2former.parseOutput(output);

    console.log(
`[runMask2Former] Complete
  Runtime:  ${(elapsedMs / 1000).toFixed(1)}s
  Segments: ${segments.length}`,
    );

    return { segments, inferenceMs: elapsedMs, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[runMask2Former] ✗ ${msg}`);
    return { segments: [], inferenceMs: Date.now() - t0, error: msg };
  }
}
