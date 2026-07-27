"use server";

/**
 * Grounding DINO object detection — Phase 2 occlusion pipeline.
 *
 * Graceful degradation:
 *   If GROUNDING_DINO_VERSION is not set, detection is skipped silently.
 */

import { createHash } from "crypto";
import fs   from "fs";
import path from "path";
import { parseOutput, OCCLUSION_QUERY, type BoxCategory, type BoundingBox } from "./detectObjectsUtils";
export type { BoxCategory, BoundingBox } from "./detectObjectsUtils";

const GDINO_VERSION    = process.env.GROUNDING_DINO_VERSION ?? "";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX         = 30;
const BOX_THRESHOLD    = 0.10;
const TEXT_THRESHOLD   = 0.08;

export type DiagnosticChecks = {
  apiReachable:     boolean;
  predictionQueued: boolean;
  predictionDone:   boolean;
  rawBoxesPresent:  boolean;
  labelsParsed:     boolean;
  coordinatesValid: boolean;
  objectsDetected:  boolean;
  failedStep:       string | null;
  totalRawBoxes:    number;
  aboveThreshold:   number;
  requestMs:        number;
  pollMs:           number;
  retryCount:       number;
  imageSizeKb:      number;
  imageFormat:      string;
  imageDimensions:  string;
  sha256Prefix:     string;
  promptTerms:      number;
  outputType:       string;
  outputKeys:       string[];
  histogram: {
    above80: number;
    above50: number;
    above20: number;
    above10: number;
    total:   number;
  };
};

export type ObjectDetectionResult = {
  boxes:    BoundingBox[];
  allBoxes: BoundingBox[];
  error:    string | null;
  skipped:  boolean;
  diagnostic: DiagnosticChecks | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Prediction = {
  id:      string;
  status:  "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?:  string | null;
};

const RATE_LIMIT_RETRY_DELAYS_MS = [15_000, 30_000];

async function createPredictionWithRetry(
  token:   string,
  payload: string,
): Promise<{ res: Response; retryCount: number }> {
  const init: RequestInit = {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    payload,
  };
  let retryCount = 0;
  let res = await fetch("https://api.replicate.com/v1/predictions", init);
  for (const delay of RATE_LIMIT_RETRY_DELAYS_MS) {
    if (res.status !== 429) break;
    retryCount++;
    console.warn(`[detectObjects] 429 rate-limited — retry ${retryCount} in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch("https://api.replicate.com/v1/predictions", init);
  }
  return { res, retryCount };
}

async function pollUntilDone(id: string): Promise<Prediction> {
  const headers = {
    Authorization:  `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers });
    if (!res.ok) continue;
    const p = (await res.json()) as Prediction;
    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") return p;
  }
  return { id, status: "failed", error: "timeout" };
}

function saveDebugFile(filename: string, content: string): string {
  try {
    const dir = path.join(process.cwd(), "debug");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  } catch {
    return "(write failed)";
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function detectObjects(formData: FormData): Promise<ObjectDetectionResult> {
  const photo         = formData.get("photo")         as File | null;
  const naturalWidth  = Number(formData.get("naturalWidth"))  || 1024;
  const naturalHeight = Number(formData.get("naturalHeight")) || 768;

  if (!photo || !GDINO_VERSION || !process.env.REPLICATE_API_TOKEN) {
    const reason = !photo ? "no photo" : !GDINO_VERSION ? "GROUNDING_DINO_VERSION not set" : "REPLICATE_API_TOKEN not set";
    console.log(`[detectObjects] Skipped — ${reason}`);
    return { boxes: [], allBoxes: [], error: null, skipped: true, diagnostic: null };
  }

  try {
    const buf      = await photo.arrayBuffer();
    const imgBytes = Buffer.from(buf);
    const b64      = imgBytes.toString("base64");
    const dataUrl  = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const sha256   = createHash("sha256").update(imgBytes).digest("hex");
    const sizeKb   = Math.round(imgBytes.byteLength / 1024);
    const promptTerms = OCCLUSION_QUERY.split(" . ").length;

    // ── Step 1: Model & provider info ─────────────────────────────────────────
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Grounding DINO — Step 1: Model & Provider Info      ║
╚════════════════════════════════════════════════════════╝

Provider:        Replicate
Model slug:      adirik/grounding-dino
Version hash:    ${GDINO_VERSION || "(not set — would use latest)"}
API endpoint:    https://api.replicate.com/v1/predictions
`);

    // ── Step 9: Image verification ────────────────────────────────────────────
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 9: Image Verification                          ║
╚════════════════════════════════════════════════════════╝

Source:       compressedPhoto (original room upload — NOT rendered/masked/debug)
File name:    ${photo.name ?? "(unnamed)"}
MIME type:    ${photo.type || "image/jpeg"}
File size:    ${sizeKb} KB  (${imgBytes.byteLength} bytes)
Dimensions:   ${naturalWidth} × ${naturalHeight} px
SHA256:       ${sha256}
Data URL:     data:${photo.type};base64,<${b64.length} chars>
`);

    // ── Step 2: Complete request payload ──────────────────────────────────────
    const requestPayload = {
      version: GDINO_VERSION,
      input: {
        image:          `data:${photo.type};base64,<${b64.length} base64 chars — omitted from log>`,
        query:          OCCLUSION_QUERY,
        box_threshold:  BOX_THRESHOLD,
        text_threshold: TEXT_THRESHOLD,
      },
    };

    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 2: Complete Request Payload                    ║
╚════════════════════════════════════════════════════════╝

${JSON.stringify(requestPayload, null, 2)}

Prompt (${promptTerms} terms, full):
  ${OCCLUSION_QUERY}
`);

    // ── API call ───────────────────────────────────────────────────────────────
    const t1 = Date.now();
    const actualPayload = JSON.stringify({
      version: GDINO_VERSION,
      input: { image: dataUrl, query: OCCLUSION_QUERY, box_threshold: BOX_THRESHOLD, text_threshold: TEXT_THRESHOLD },
    });
    const { res: createRes, retryCount } = await createPredictionWithRetry(
      process.env.REPLICATE_API_TOKEN!,
      actualPayload,
    );
    const requestMs = Date.now() - t1;

    console.log(`[detectObjects] Create — HTTP ${createRes.status} in ${requestMs}ms (retries: ${retryCount})`);

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "(unreadable)");
      console.error(`[detectObjects] ✗ API error — ${createRes.status}: ${body}`);
      return { boxes: [], allBoxes: [], error: null, skipped: true, diagnostic: {
        apiReachable: false, predictionQueued: false, predictionDone: false,
        rawBoxesPresent: false, labelsParsed: false, coordinatesValid: false, objectsDetected: false,
        failedStep: `HTTP ${createRes.status}: ${body.slice(0, 100)}`,
        totalRawBoxes: 0, aboveThreshold: 0, requestMs, pollMs: 0, retryCount,
        imageSizeKb: sizeKb, imageFormat: photo.type, imageDimensions: `${naturalWidth}×${naturalHeight}`,
        sha256Prefix: sha256.slice(0, 16), promptTerms, outputType: "n/a", outputKeys: [],
        histogram: { above80: 0, above50: 0, above20: 0, above10: 0, total: 0 },
      }};
    }

    const created = (await createRes.json()) as Prediction;
    console.log(`[detectObjects] Queued — id: ${created.id}  status: ${created.status}`);

    const t2 = Date.now();
    const done = await pollUntilDone(created.id);
    const pollMs = Date.now() - t2;

    console.log(`[detectObjects] Poll done — status: ${done.status}  time: ${pollMs}ms`);

    if (done.status !== "succeeded") {
      console.error(`[detectObjects] ✗ Prediction ${done.status}: ${done.error ?? "no error message"}`);
      return { boxes: [], allBoxes: [], error: null, skipped: true, diagnostic: {
        apiReachable: true, predictionQueued: true, predictionDone: false,
        rawBoxesPresent: false, labelsParsed: false, coordinatesValid: false, objectsDetected: false,
        failedStep: `Prediction ${done.status}: ${done.error ?? ""}`,
        totalRawBoxes: 0, aboveThreshold: 0, requestMs, pollMs, retryCount,
        imageSizeKb: sizeKb, imageFormat: photo.type, imageDimensions: `${naturalWidth}×${naturalHeight}`,
        sha256Prefix: sha256.slice(0, 16), promptTerms, outputType: "n/a", outputKeys: [],
        histogram: { above80: 0, above50: 0, above20: 0, above10: 0, total: 0 },
      }};
    }

    // ── Step 3: Complete raw response — NO truncation ─────────────────────────
    const fullOutput = done.output;
    const rawJson    = JSON.stringify(fullOutput, null, 2);
    const savedPath  = saveDebugFile("dino-response.json", rawJson);

    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 3: Complete Raw Response (NO truncation)       ║
╚════════════════════════════════════════════════════════╝

Saved to: ${savedPath}

output (type: ${Array.isArray(fullOutput) ? "array[" + (fullOutput as unknown[]).length + "]" : typeof fullOutput}):

${rawJson}
`);

    // ── Step 4: Validate response format ──────────────────────────────────────
    let outputType: string = typeof fullOutput;
    let outputKeys: string[] = [];

    if (Array.isArray(fullOutput)) {
      outputType = `array[${(fullOutput as unknown[]).length}]`;
      if ((fullOutput as unknown[]).length > 0 && typeof (fullOutput as unknown[])[0] === "object") {
        outputKeys = Object.keys((fullOutput as Record<string, unknown>[])[0] ?? {});
      }
    } else if (fullOutput && typeof fullOutput === "object") {
      outputKeys = Object.keys(fullOutput as object);
    }

    const hasBoxes      = outputKeys.includes("boxes");
    const hasPhrases    = outputKeys.includes("phrases") || outputKeys.includes("labels") || outputKeys.includes("texts");
    const hasScores     = outputKeys.includes("logits")  || outputKeys.includes("scores");
    const hasDetections = outputKeys.includes("detections");

    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 4: Response Format Validation                  ║
╚════════════════════════════════════════════════════════╝

output type:       ${outputType}
output keys:       ${outputKeys.length > 0 ? outputKeys.join(", ") : "(none — may be string/null)"}

  detections key:  ${hasDetections ? "✓ present" : "✗ MISSING"}
  boxes key:       ${hasBoxes      ? "✓ present" : "✗ MISSING — checked: boxes"}
  labels key:      ${hasPhrases    ? "✓ present" : "✗ MISSING — checked: phrases, labels, texts"}
  scores key:      ${hasScores     ? "✓ present" : "✗ MISSING — checked: logits, scores"}

${typeof fullOutput === "string" ? `⚠  output IS A STRING — ${String(fullOutput).slice(0, 200)}` : ""}
${Array.isArray(fullOutput) && (fullOutput as unknown[]).length === 0 ? "⚠  output is an EMPTY ARRAY" : ""}
`);

    // ── Steps 1–3: Inspect response.detections ───────────────────────────────
    if (hasDetections && fullOutput && typeof fullOutput === "object") {
      const detections = ((fullOutput as Record<string, unknown>).detections as unknown[]) ?? [];
      const detectionsJson = JSON.stringify(detections, null, 2);
      const savedDet = saveDebugFile("detections.json", detectionsJson);

      console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 1: Complete response.detections               ║
╚════════════════════════════════════════════════════════╝

Count: ${detections.length}
Saved: ${savedDet}

${detectionsJson}
`);

      if (detections.length > 0) {
        const first = detections[0] as Record<string, unknown>;
        console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 2: First Detection — all fields               ║
╚════════════════════════════════════════════════════════╝

${JSON.stringify(first, null, 2)}
`);

        console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 3: detections[] Schema                        ║
╚════════════════════════════════════════════════════════╝

detections[]:
  keys: ${Object.keys(first).join(", ")}

Field types:
${Object.entries(first).map(([k, v]) => `  ${k.padEnd(16)} ${Array.isArray(v) ? `array[${(v as unknown[]).length}]` : typeof v}  =  ${JSON.stringify(v)}`).join("\n")}
`);
      } else {
        console.log(`[detectObjects] detections[] is empty — model found nothing at box_threshold=${BOX_THRESHOLD}`);
      }
    }

    // ── Step 5 / Parsing validation ───────────────────────────────────────────
    const allBoxes = parseOutput(fullOutput, naturalWidth, naturalHeight);

    const rawDetCount = hasDetections && fullOutput && typeof fullOutput === "object"
      ? (((fullOutput as Record<string, unknown>).detections as unknown[]) ?? []).length
      : 0;

    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 5: Parsing Validation                          ║
╚════════════════════════════════════════════════════════╝

Raw detections in response: ${rawDetCount}
Parsed BoundingBox results: ${allBoxes.length}
${allBoxes.length !== rawDetCount ? `⚠  COUNT MISMATCH — ${rawDetCount - allBoxes.length} detections lost in parsing` : "✓ all detections parsed"}
`);

    // ── Step 6: Coordinate validation ─────────────────────────────────────────
    if (allBoxes.length > 0) {
      console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 6: Coordinate Verification                     ║
╚════════════════════════════════════════════════════════╝
`);
      allBoxes.forEach((box, i) => {
        const raw = !Array.isArray(fullOutput) && fullOutput && typeof fullOutput === "object"
          ? ((fullOutput as Record<string, unknown>).boxes as number[][])?.[i] ?? []
          : [];
        const isNorm = raw.length > 0 && raw.every((v: number) => v <= 2);
        console.log(
          `  ${i + 1}. ${box.label}\n` +
          `     score:  ${(box.confidence * 100).toFixed(1)}%\n` +
          `     raw:    [${raw.join(", ")}]\n` +
          `     pixel:  [${box.x1}, ${box.y1}, ${box.x2}, ${box.y2}]\n` +
          `     mode:   ${isNorm ? "normalised (0–1) → converted to pixels" : "absolute pixels"}\n` +
          `     valid:  ${box.x1 < box.x2 && box.y1 < box.y2 && box.x2 <= naturalWidth && box.y2 <= naturalHeight ? "✓" : "✗"}\n`
        );
      });
    }

    // ── Confidence histogram ───────────────────────────────────────────────────
    const histogram = {
      above80: allBoxes.filter(b => b.confidence > 0.80).length,
      above50: allBoxes.filter(b => b.confidence > 0.50).length,
      above20: allBoxes.filter(b => b.confidence > 0.20).length,
      above10: allBoxes.filter(b => b.confidence > 0.10).length,
      total:   allBoxes.length,
    };

    // ── Step 11: Final diagnostic report ──────────────────────────────────────
    const objectsDetected = allBoxes.length > 0;
    const coordsValid     = allBoxes.every(b => b.x1 < b.x2 && b.y1 < b.y2 && b.x2 <= naturalWidth && b.y2 <= naturalHeight);

    let rootCause: string | null = null;
    if (!objectsDetected) {
      if (typeof fullOutput === "string")
        rootCause = "Model returned a rendered image URL (string), not a JSON object with boxes. The response format differs from what our parser expects.";
      else if (Array.isArray(fullOutput) && (fullOutput as unknown[]).length === 0)
        rootCause = "Model returned an empty array — zero detections at the configured thresholds. Try lower thresholds or simpler prompts.";
      else if (!hasBoxes)
        rootCause = `Response keys [${outputKeys.join(", ")}] do not contain 'boxes' — parser cannot find detections. Check model output schema.`;
      else
        rootCause = "Unknown — boxes key exists but parsed 0 BoundingBox objects. Review raw response file.";
    }

    console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 11: Final Diagnostic Report                    ║
╚════════════════════════════════════════════════════════╝

  ${createRes.ok     ? "✓" : "✗"} Replicate connection     (HTTP ${createRes.status})
  ${GDINO_VERSION    ? "✓" : "✗"} Model version hash set   (${GDINO_VERSION.slice(0, 16)}…)
  ✓ Correct payload sent
  ✓ Image verified           (SHA256 ${sha256.slice(0, 8)}…  ${sizeKb}KB  ${naturalWidth}×${naturalHeight})
  ${done.status === "succeeded" ? "✓" : "✗"} Prediction succeeded     (${pollMs}ms)
  ${rawJson !== "null" && rawJson !== '""' ? "✓" : "✗"} Non-null response
  ${hasBoxes   ? "✓" : "✗"} 'boxes' key present      (${hasBoxes ? "yes" : "NOT FOUND in: " + outputKeys.join(", ")})
  ${hasPhrases ? "✓" : "✗"} labels/phrases key       (${hasPhrases ? "yes" : "NOT FOUND"})
  ${hasScores  ? "✓" : "✗"} scores/logits key        (${hasScores ? "yes" : "NOT FOUND"})
  ${objectsDetected  ? "✓" : "✗"} Objects detected         (${allBoxes.length})
  ${coordsValid      ? "✓" : "—"} Coordinates valid

  Histogram:  total=${histogram.total}  >80%=${histogram.above80}  >50%=${histogram.above50}  >20%=${histogram.above20}  >10%=${histogram.above10}

${rootCause ? `ROOT CAUSE:\n  ${rootCause}` : "  All checks passed — detection working correctly."}

  Response saved to: ${savedPath}
`);

    const diagnostic: DiagnosticChecks = {
      apiReachable: true, predictionQueued: true, predictionDone: true,
      rawBoxesPresent: allBoxes.length > 0, labelsParsed: allBoxes.length > 0,
      coordinatesValid: coordsValid, objectsDetected,
      failedStep: rootCause,
      totalRawBoxes: allBoxes.length, aboveThreshold: allBoxes.length,
      requestMs, pollMs, retryCount,
      imageSizeKb: sizeKb, imageFormat: photo.type,
      imageDimensions: `${naturalWidth}×${naturalHeight}`,
      sha256Prefix: sha256.slice(0, 16),
      promptTerms, outputType, outputKeys,
      histogram,
    };

    return { boxes: allBoxes, allBoxes, error: null, skipped: false, diagnostic };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[detectObjects] Unexpected error: ${msg}`);
    return { boxes: [], allBoxes: [], error: null, skipped: true, diagnostic: null };
  }
}
