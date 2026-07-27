"use server";

/**
 * Grounding DINO deep diagnostics — Steps 6–8.
 *
 * detectObjectsPromptTests  — runs 4 compound prompts in parallel (quick check)
 * detectObjectsDeepDiag     — runs 6 single-term prompts × 5 thresholds (30 calls)
 *
 * Call from the debug panel only — adds significant Replicate usage.
 */

import fs   from "fs";
import path from "path";
import { categorize, parseOutput, OCCLUSION_QUERY, type BoundingBox } from "./detectObjectsUtils";

const GDINO_VERSION    = process.env.GROUNDING_DINO_VERSION ?? "";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX         = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromptTest = {
  label:  string;
  prompt: string;
  boxes:  BoundingBox[];
  totalRaw:  number;
  inferenceMs: number;
  histogram: { above80: number; above50: number; above20: number; above10: number };
  rawOutput: unknown;
  error: string | null;
};

export type PromptTestsResult = {
  skipped:    boolean;
  tests:      PromptTest[];
  fullPrompt: string;
};

export type DeepDiagRow = {
  prompt:    string;
  threshold: number;
  count:     number;
  boxes:     BoundingBox[];
  error:     string | null;
  inferenceMs: number;
};

export type DeepDiagResult = {
  skipped: boolean;
  rows:    DeepDiagRow[];
  /** Rendered table string for console output */
  table:   string;
};

// ─── Replicate helpers ────────────────────────────────────────────────────────

type Prediction = {
  id:      string;
  status:  "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?:  string | null;
};

async function queue(token: string, dataUrl: string, query: string, boxT: number, textT: number): Promise<string | null> {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      version: GDINO_VERSION,
      input:   { image: dataUrl, query, box_threshold: boxT, text_threshold: textT },
    }),
  });
  if (!res.ok) {
    console.warn(`[deepDiag] queue failed HTTP ${res.status} — query="${query}" threshold=${boxT}`);
    return null;
  }
  const p = (await res.json()) as Prediction;
  return p.id;
}

async function poll(id: string, token: string): Promise<Prediction> {
  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: hdrs });
    if (!r.ok) continue;
    const p = (await r.json()) as Prediction;
    if (p.status === "succeeded" || p.status === "failed" || p.status === "canceled") return p;
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

// ─── Compound prompt tests (quick, 4 calls) ───────────────────────────────────

const PROMPT_TEST_CASES = [
  { label: "Furniture (narrow)",  prompt: "chair . table . sofa . cabinet", boxT: 0.10, textT: 0.08 },
  { label: "Structural",          prompt: "door . wall . floor",             boxT: 0.10, textT: 0.08 },
  { label: "Stairs",              prompt: "stairs . staircase . railing . step", boxT: 0.10, textT: 0.08 },
  { label: "Full prompt @0.01",   prompt: OCCLUSION_QUERY,                  boxT: 0.01, textT: 0.01 },
];

export async function detectObjectsPromptTests(formData: FormData): Promise<PromptTestsResult> {
  const photo         = formData.get("photo")         as File | null;
  const naturalWidth  = Number(formData.get("naturalWidth"))  || 1024;
  const naturalHeight = Number(formData.get("naturalHeight")) || 768;
  const token         = process.env.REPLICATE_API_TOKEN ?? "";

  if (!photo || !GDINO_VERSION || !token) {
    return { skipped: true, tests: [], fullPrompt: OCCLUSION_QUERY };
  }

  const buf     = await photo.arrayBuffer();
  const b64     = Buffer.from(buf).toString("base64");
  const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

  console.log(`\n[promptTests] Queueing ${PROMPT_TEST_CASES.length} tests on ${naturalWidth}×${naturalHeight}…\n`);

  const t0  = Date.now();
  const ids = await Promise.all(PROMPT_TEST_CASES.map(tc => queue(token, dataUrl, tc.prompt, tc.boxT, tc.textT)));
  const predictions = await Promise.all(ids.map(id => id ? poll(id, token) : Promise.resolve({ id: "", status: "failed" as const, error: "queue failed" })));

  const tests: PromptTest[] = PROMPT_TEST_CASES.map((tc, i) => {
    const done        = predictions[i];
    const inferenceMs = Date.now() - t0;
    if (done.status !== "succeeded" || !done.output) {
      console.log(`  [${tc.label}] ✗ ${done.status}: ${done.error ?? ""}`);
      return { label: tc.label, prompt: tc.prompt, boxes: [], totalRaw: 0, inferenceMs,
               histogram: { above80: 0, above50: 0, above20: 0, above10: 0 }, rawOutput: ("output" in done ? done.output : null) ?? null, error: done.error ?? done.status };
    }
    const boxes = parseOutput(done.output, naturalWidth, naturalHeight);
    const histogram = {
      above80: boxes.filter(b => b.confidence > 0.80).length,
      above50: boxes.filter(b => b.confidence > 0.50).length,
      above20: boxes.filter(b => b.confidence > 0.20).length,
      above10: boxes.filter(b => b.confidence > 0.10).length,
    };
    const tag = boxes.length > 0 ? `${boxes.length} boxes` : "ZERO";
    console.log(`  [${tc.label}] ${tag}` + (boxes.length > 0 ? `  → ${boxes.map(b => `${b.label}(${(b.confidence*100).toFixed(0)}%)`).join(", ")}` : ""));
    return { label: tc.label, prompt: tc.prompt, boxes, totalRaw: boxes.length, inferenceMs, histogram, rawOutput: done.output, error: null };
  });

  const savedPath = saveDebugFile("dino-prompt-tests.json", JSON.stringify({ tests }, null, 2));
  console.log(`[promptTests] Saved to ${savedPath}\n`);

  return { skipped: false, tests, fullPrompt: OCCLUSION_QUERY };
}

// ─── Deep diagnostic: 6 prompts × 5 thresholds (30 calls) ────────────────────

const DEEP_PROMPTS  = ["chair", "table", "door", "stairs", "wall", "floor"];
const DEEP_THRESHOLDS = [0.01, 0.05, 0.10, 0.20, 0.30];

export async function detectObjectsDeepDiag(formData: FormData): Promise<DeepDiagResult> {
  const photo         = formData.get("photo")         as File | null;
  const naturalWidth  = Number(formData.get("naturalWidth"))  || 1024;
  const naturalHeight = Number(formData.get("naturalHeight")) || 768;
  const token         = process.env.REPLICATE_API_TOKEN ?? "";

  if (!photo || !GDINO_VERSION || !token) {
    return { skipped: true, rows: [], table: "DINO not configured" };
  }

  const buf     = await photo.arrayBuffer();
  const b64     = Buffer.from(buf).toString("base64");
  const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

  console.log(`
╔════════════════════════════════════════════════════════╗
║   Steps 7–8: Deep Diagnostic (${DEEP_PROMPTS.length} prompts × ${DEEP_THRESHOLDS.length} thresholds)   ║
╚════════════════════════════════════════════════════════╝

Prompts:    ${DEEP_PROMPTS.join(", ")}
Thresholds: ${DEEP_THRESHOLDS.join(", ")}
Total calls: ${DEEP_PROMPTS.length * DEEP_THRESHOLDS.length}  (running all in parallel)
`);

  // Build all 30 jobs
  type Job = { prompt: string; threshold: number };
  const jobs: Job[] = [];
  for (const p of DEEP_PROMPTS) {
    for (const t of DEEP_THRESHOLDS) {
      jobs.push({ prompt: p, threshold: t });
    }
  }

  // Queue all 30 in parallel
  const t0  = Date.now();
  const ids = await Promise.all(jobs.map(j => queue(token, dataUrl, j.prompt, j.threshold, j.threshold)));

  // Poll all 30 in parallel
  const preds = await Promise.all(ids.map(id => id ? poll(id, token) : Promise.resolve({ id: "", status: "failed" as const, error: "queue failed" })));
  const totalMs = Date.now() - t0;

  const rows: DeepDiagRow[] = jobs.map((job, i) => {
    const done = preds[i];
    if (done.status !== "succeeded" || !done.output) {
      return { prompt: job.prompt, threshold: job.threshold, count: 0, boxes: [], error: done.error ?? done.status, inferenceMs: totalMs };
    }
    const boxes = parseOutput(done.output, naturalWidth, naturalHeight);
    return { prompt: job.prompt, threshold: job.threshold, count: boxes.length, boxes, error: null, inferenceMs: totalMs };
  });

  // Print table — Step 8
  const header = `Prompt`.padEnd(8) + " | " + DEEP_THRESHOLDS.map(t => `t=${t}`.padEnd(6)).join(" | ");
  const divider = "-".repeat(header.length);
  const tableLines = [divider, header, divider];

  for (const prompt of DEEP_PROMPTS) {
    const cells = DEEP_THRESHOLDS.map(t => {
      const row = rows.find(r => r.prompt === prompt && r.threshold === t);
      const n   = row?.count ?? "err";
      return String(n).padEnd(6);
    });
    tableLines.push(prompt.padEnd(8) + " | " + cells.join(" | "));
  }
  tableLines.push(divider);
  const table = tableLines.join("\n");

  console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 7: Per-Prompt Results                          ║
╚════════════════════════════════════════════════════════╝
`);

  for (const prompt of DEEP_PROMPTS) {
    const promptRows = rows.filter(r => r.prompt === prompt);
    const best = promptRows.find(r => r.count > 0);
    console.log(`  Prompt: "${prompt}"`);
    console.log(`    Inference time: ~${totalMs}ms (parallel)`);
    promptRows.forEach(r => {
      const tag = r.error ? `ERROR: ${r.error}` : r.count === 0 ? "ZERO" : `${r.count} box${r.count !== 1 ? "es" : ""}`;
      console.log(`    threshold=${r.threshold}  → ${tag}` + (r.boxes.length > 0 ? `  [${r.boxes.map(b => `${b.label}(${(b.confidence*100).toFixed(0)}%)`).join(", ")}]` : ""));
    });
    if (!best) console.log(`    ← NO DETECTIONS AT ANY THRESHOLD`);
    console.log();
  }

  console.log(`
╔════════════════════════════════════════════════════════╗
║   Step 8: Threshold Table                             ║
╚════════════════════════════════════════════════════════╝

${table}

Total time: ${totalMs}ms
`);

  const savedPath = saveDebugFile("dino-deep-diag.json", JSON.stringify({ jobs, rows: rows.map(r => ({ ...r, boxes: r.boxes.length })) }, null, 2));
  console.log(`[deepDiag] Saved to ${savedPath}\n`);

  return { skipped: false, rows, table };
}
