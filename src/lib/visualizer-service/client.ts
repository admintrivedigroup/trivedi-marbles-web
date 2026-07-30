import "server-only";

import type { RenderVisualizerDebug, RenderVisualizerParams, RenderVisualizerResult } from "./types";

const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Internal HTTP client for the standalone Python visualizer service
 * (services/visualizer). Never called from the browser — only from
 * src/app/api/visualizer/jobs/route.ts, which is the sole holder of these
 * server-only env vars.
 */
export async function renderVisualizerJob(
  params: RenderVisualizerParams,
): Promise<RenderVisualizerResult> {
  const serviceUrl = process.env.VISUALIZER_SERVICE_URL?.trim();
  const serviceSecret = process.env.VISUALIZER_SERVICE_SECRET?.trim();

  if (!serviceUrl) {
    return { ok: false, error: "VISUALIZER_SERVICE_URL is not configured.", needsManualFloor: false };
  }

  const formData = new FormData();
  formData.append("room_photo", params.roomPhoto);
  formData.append("slab_image", params.slabImage);
  formData.append("tap_x", String(params.tapX));
  formData.append("tap_y", String(params.tapY));
  if (params.mode) formData.append("mode", params.mode);
  if (params.tileWidthMm !== undefined) formData.append("tile_width_mm", String(params.tileWidthMm));
  if (params.tileHeightMm !== undefined) formData.append("tile_height_mm", String(params.tileHeightMm));
  if (params.groutPx !== undefined) formData.append("grout_px", String(params.groutPx));
  if (params.rotationDeg !== undefined) formData.append("rotation_deg", String(params.rotationDeg));
  if (params.scaleFactor !== undefined) formData.append("scale_factor", String(params.scaleFactor));
  if (params.inferenceModeOverride) {
    formData.append("inference_mode_override", params.inferenceModeOverride);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: serviceSecret ? { "X-Visualizer-Secret": serviceSecret } : undefined,
      body: formData,
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        error: (json.error as string | undefined) ?? `Visualizer service error: ${res.status}`,
        needsManualFloor: Boolean(json.needsManualFloor),
      };
    }

    return {
      ok: true,
      dataUrl: json.dataUrl as string,
      debug: json.debug as RenderVisualizerDebug,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Visualizer service request failed.";
    return { ok: false, error: msg, needsManualFloor: false };
  } finally {
    clearTimeout(timeout);
  }
}
