"use server";

import { MODEL_REGISTRY }  from "../_models";
import { runPrediction }   from "../_providers/replicate";
import type { DepthResult, ModelId } from "../_lib/types";

export async function runDepthBenchmark(formData: FormData): Promise<DepthResult> {
  const modelId = formData.get("modelId") as ModelId | null;
  const photo   = formData.get("photo")   as File   | null;
  const dimW    = formData.get("width")   as string | null;
  const dimH    = formData.get("height")  as string | null;
  const token   = process.env.REPLICATE_API_TOKEN ?? "";

  console.log("=== runDepthBenchmark START ===");
  console.log("  modelId :", modelId ?? "MISSING");
  console.log("  photo   :", photo
    ? `${photo.name ?? "(unnamed)"} — ${Math.round(photo.size / 1024)}KB  ${photo.type}`
    : "MISSING"
  );
  console.log("  token   :", token ? "EXISTS" : "MISSING — set REPLICATE_API_TOKEN in .env.local");

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!modelId || !(modelId in MODEL_REGISTRY)) {
    return err(modelId ?? "depth-anything-v2", "?", `Invalid model ID: "${String(modelId)}"`);
  }

  const model = MODEL_REGISTRY[modelId as ModelId];

  if (!photo) return err(modelId, model.key, "No photo provided.");

  if (!token) {
    return err(modelId, model.key, "REPLICATE_API_TOKEN is not set in .env.local.");
  }

  const version = process.env[model.versionEnvKey] ?? "";
  if (!version) {
    return err(
      modelId, model.key,
      `${model.versionEnvKey} is not set in .env.local. ${model.replicateHint}`,
    );
  }

  // ── Run inference ────────────────────────────────────────────────────────────
  const t0   = Date.now();
  const dims = dimW && dimH ? `${dimW}×${dimH}` : "(unknown)";

  try {
    const buf     = await photo.arrayBuffer();
    const b64     = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const input   = model.buildInput(dataUrl);

    const { output, elapsedMs } = await runPrediction(token, version, input, {
      timeoutMs:  model.timeoutMs,
      modelKey:   model.key,
      imageMeta:  { name: photo.name ?? "(unnamed)", sizeBytes: photo.size, dims },
    });

    // ── Parse output → grey depth + optional pre-rendered colour depth ──────────
    const [depthBase64, colorDepthBase64] = await Promise.all([
      model.parseOutput(output),
      model.parseColorOutput ? model.parseColorOutput(output) : Promise.resolve(null),
    ]);

    if (!depthBase64) {
      console.error(`[runDepthBenchmark] ${modelId} — parseOutput returned null. Raw:`, output);
      return {
        modelId, modelName: model.key,
        depthBase64: null, colorDepthBase64: null,
        inferenceMs: elapsedMs, rawOutput: output,
        error: "Unexpected output format — check the Raw Output panel.",
      };
    }

    console.log(
`=== runDepthBenchmark DONE ===
  Model:       ${modelId}
  Inference:   ${(elapsedMs / 1000).toFixed(1)}s
  Grey depth:  ${Math.round(depthBase64.length / 1024)}KB
  Color depth: ${colorDepthBase64 ? `${Math.round(colorDepthBase64.length / 1024)}KB` : "none"}`,
    );

    return {
      modelId, modelName: model.key,
      depthBase64, colorDepthBase64: colorDepthBase64 ?? null,
      inferenceMs: elapsedMs, rawOutput: output, error: null,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[runDepthBenchmark] ✗ ${modelId}: ${msg}`);
    return err(modelId, model.key, msg, Date.now() - t0);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function err(
  modelId:     string,
  modelName:   string,
  message:     string,
  inferenceMs  = 0,
): DepthResult {
  console.error(`[runDepthBenchmark] ERROR ${modelId}: ${message}`);
  return { modelId: modelId as ModelId, modelName, depthBase64: null, colorDepthBase64: null, inferenceMs, rawOutput: null, error: message };
}
