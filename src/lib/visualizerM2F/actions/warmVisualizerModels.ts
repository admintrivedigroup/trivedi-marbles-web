"use server";

import { startPrediction } from "../replicate";
import { mask2former } from "../models/mask2former";
import { depthAnythingV2 } from "../models/depthAnythingV2";

// Replicate scales community models to zero when idle; the next request then waits for
// the container to boot (Mask2Former: usually 1–4 minutes, against ~7 s of real work).
// This starts a throwaway prediction on a tiny image and returns without waiting for it,
// so the boot happens while staff are still picking a room photo. SAM 2 is kept warm by
// Replicate and needs no nudge.
export async function warmVisualizerModels(sample: File): Promise<{ started: string[] }> {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  if (!token) return { started: [] };

  const b64     = Buffer.from(await sample.arrayBuffer()).toString("base64");
  const dataUrl = `data:${sample.type || "image/jpeg"};base64,${b64}`;

  const started: string[] = [];
  await Promise.all([mask2former, depthAnythingV2].map(async (model) => {
    const version = process.env[model.versionEnvKey] ?? "";
    if (!version) return;
    try {
      await startPrediction(token, version, model.buildInput(dataUrl));
      started.push(model.key);
    } catch (e) {
      console.warn(`[warmVisualizerModels] ${model.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }));
  return { started };
}
