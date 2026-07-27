// Generic Replicate inference provider for the depth benchmark.
// Imported only by server-side code (_models, _actions).
// Isolated copy — intentionally not shared with surface-benchmark.

const POLL_INTERVAL_MS   = 3_000;
const DEFAULT_TIMEOUT_MS = 180_000;

type RepPredStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled";

type RepPrediction = {
  id:      string;
  status:  RepPredStatus;
  output?: unknown;
  error?:  string | null;
};

export type RunPredictionOptions = {
  timeoutMs?:  number;
  modelKey?:   string;
  imageMeta?:  { name: string; sizeBytes: number; dims: string };
};

async function createPrediction(
  token:   string,
  version: string,
  input:   Record<string, unknown>,
): Promise<RepPrediction> {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ version, input }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Replicate create failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<RepPrediction>;
}

export async function runPrediction(
  token:   string,
  version: string,
  input:   Record<string, unknown>,
  opts:    RunPredictionOptions = {},
): Promise<{ output: unknown; elapsedMs: number }> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    modelKey  = "unknown",
    imageMeta,
  } = opts;

  const t0 = Date.now();

  console.log(
`────────────────────────────────────────────────
[Depth/Replicate] Starting inference
  Model:     ${modelKey}
  Version:   ${version.slice(0, 16)}…
  Token:     ${token ? "EXISTS" : "MISSING"}
  Image:     ${imageMeta?.name ?? "?"} · ${imageMeta ? `${Math.round(imageMeta.sizeBytes / 1024)}KB` : "?"}
  Dims:      ${imageMeta?.dims ?? "?"}
  Timeout:   ${timeoutMs / 1000}s
────────────────────────────────────────────────`,
  );

  const pred    = await createPrediction(token, version, input);
  const predUrl = `https://api.replicate.com/v1/predictions/${pred.id}`;
  console.log(`[Depth/Replicate] Created ${pred.id}  status=${pred.status}`);

  const headers     = { Authorization: `Bearer ${token}` };
  let lastPred      = pred;
  let lastLogBucket = -1;

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const elapsedMs  = Date.now() - t0;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const logBucket  = Math.floor(elapsedSec / 10);

    if (logBucket !== lastLogBucket) {
      lastLogBucket = logBucket;
      console.log(
        `[Depth/Replicate] Polling  elapsed=${elapsedSec}s  status=${lastPred.status}`,
      );
    }

    if (elapsedMs > timeoutMs) {
      console.error(
        `[Depth/Replicate] TIMEOUT  id=${pred.id}  elapsed=${elapsedSec}s  last=${lastPred.status}`,
      );
      throw new Error(
        `Prediction timed out after ${elapsedSec}s (limit: ${timeoutMs / 1000}s). ID: ${pred.id}`,
      );
    }

    try {
      const res = await fetch(predUrl, { headers });
      if (res.ok) lastPred = (await res.json()) as RepPrediction;
    } catch { /* transient — keep polling */ }

    if (lastPred.status === "succeeded") {
      const elapsed = Date.now() - t0;
      const outType =
        lastPred.output == null ? "null"
        : Array.isArray(lastPred.output) ? `array[${(lastPred.output as unknown[]).length}]`
        : typeof lastPred.output;
      console.log(
        `[Depth/Replicate] Succeeded  id=${pred.id}  elapsed=${(elapsed / 1000).toFixed(1)}s  output=${outType}`,
      );
      return { output: lastPred.output, elapsedMs: elapsed };
    }

    if (lastPred.status === "failed" || lastPred.status === "canceled") {
      console.error(
        `[Depth/Replicate] FAILED  id=${pred.id}  status=${lastPred.status}  error=${lastPred.error}`,
      );
      throw new Error(
        `Prediction ${lastPred.status}: ${lastPred.error ?? "unknown error"}. ID: ${pred.id}`,
      );
    }
  }
}

// Downloads a URL and returns its content as a base64 string (no data: prefix).
export async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchAsBase64 HTTP ${res.status}: ${url.slice(0, 80)}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}
