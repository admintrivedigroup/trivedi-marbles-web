"use server";

import { MODEL_REGISTRY } from "../_models";
import { runPrediction }  from "../_providers/replicate";
import type { BenchmarkResult, ModelKey } from "../_lib/types";

export async function runBenchmark(formData: FormData): Promise<BenchmarkResult> {
  const modelKey = formData.get("model") as ModelKey | null;
  const photo    = formData.get("photo") as File | null;
  const token    = process.env.REPLICATE_API_TOKEN ?? "";
  const dimW     = formData.get("width")  as string | null;
  const dimH     = formData.get("height") as string | null;
  const dims     = dimW && dimH ? `${dimW}×${dimH}` : "(unknown)";

  // ── Validate inputs ─────────────────────────────────────────────────────────
  if (!modelKey || !(modelKey in MODEL_REGISTRY)) {
    return err(modelKey ?? "unknown", "?", `Invalid model key: "${String(modelKey)}"`);
  }

  const model = MODEL_REGISTRY[modelKey as ModelKey];

  if (!photo) return err(modelKey, model, "No photo provided.");

  if (!token) {
    return err(modelKey, model, "REPLICATE_API_TOKEN is not set in .env.local.");
  }

  const version = process.env[model.versionEnvKey] ?? "";
  if (!version) {
    return err(
      modelKey,
      model,
      `${model.versionEnvKey} is not set in .env.local. ${model.replicateHint}`,
    );
  }

  // ── Run inference ────────────────────────────────────────────────────────────
  const t0 = Date.now();
  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const input   = model.buildInput(dataUrl);

    const { output, elapsedMs } = await runPrediction(token, version, input, {
      timeoutMs:   model.timeoutMs,
      modelKey:    model.key,
      versionFull: version,
      imageMeta: {
        name:      photo.name ?? "(unnamed)",
        sizeBytes: photo.size,
        dims,
      },
    });

    const segments = await model.parseOutput(output);

    console.log(
`[runBenchmark] Complete
  Model:    ${model.key}
  Runtime:  ${(elapsedMs / 1000).toFixed(1)}s
  Segments: ${segments.length}`,
    );

    return {
      modelKey:    modelKey as ModelKey,
      modelName:   model.key,
      segments,
      inferenceMs: elapsedMs,
      rawOutput:   output,
      error:       null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[runBenchmark] ✗ ${model.key}: ${msg}`);
    return err(modelKey, model, msg, Date.now() - t0);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type HasKey = { key: string };

function err(
  modelKey: string,
  model: HasKey | string,
  message: string,
  inferenceMs = 0,
): BenchmarkResult {
  const name = typeof model === "string" ? model : model.key;
  return { modelKey, modelName: name, segments: [], inferenceMs, rawOutput: null, error: message };
}
