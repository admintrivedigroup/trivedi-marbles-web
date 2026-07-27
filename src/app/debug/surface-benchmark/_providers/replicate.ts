// Generic Replicate inference provider.
// Imported only by server-side code (_models, _actions).

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 120_000;

type RepPredStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled";

type RepPrediction = {
  id: string;
  status: RepPredStatus;
  output?: unknown;
  error?: string | null;
};

export type RunPredictionOptions = {
  timeoutMs?: number;
  imageMeta?: {
    name:      string;
    sizeBytes: number;
    dims:      string; // e.g. "1920×1080"
  };
  modelKey?:     string;
  versionFull?:  string; // full hash for logging
};

async function createPrediction(
  token: string,
  version: string,
  input: Record<string, unknown>,
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
  token: string,
  version: string,
  input: Record<string, unknown>,
  opts: RunPredictionOptions = {},
): Promise<{ output: unknown; elapsedMs: number }> {
  const {
    timeoutMs   = DEFAULT_TIMEOUT_MS,
    imageMeta,
    modelKey    = "unknown",
    versionFull = version,
  } = opts;

  const startTs = new Date().toISOString();
  const t0 = Date.now();

  // ── Pre-create log ──────────────────────────────────────────────────────────
  console.log(
`
────────────────────────────────────────────────────
[Replicate] Starting inference
  Model key:         ${modelKey}
  Version (hash):    ${versionFull}
  Token present:     ${token ? "YES" : "NO"}
  Image filename:    ${imageMeta?.name ?? "(unknown)"}
  Image size:        ${imageMeta ? `${imageMeta.sizeBytes.toLocaleString()} bytes (${Math.round(imageMeta.sizeBytes / 1024)} KB)` : "(unknown)"}
  Image dimensions:  ${imageMeta?.dims ?? "(unknown)"}
  Timeout:           ${timeoutMs / 1000}s
  Start time:        ${startTs}
────────────────────────────────────────────────────`,
  );

  // ── Create prediction ───────────────────────────────────────────────────────
  const pred = await createPrediction(token, version, input);
  const predUrl = `https://api.replicate.com/v1/predictions/${pred.id}`;

  console.log(
`[Replicate] Prediction created
  ID:     ${pred.id}
  URL:    ${predUrl}
  Status: ${pred.status}`,
  );

  // ── Poll loop ───────────────────────────────────────────────────────────────
  const headers = { Authorization: `Bearer ${token}` };
  let lastPred: RepPrediction = pred;
  let lastLogElapsed = -1; // seconds; negative so first log fires immediately at ~10s

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const totalElapsedMs = Date.now() - t0;
    const elapsedSec = Math.floor(totalElapsedMs / 1000);

    // Emit a log line every 10 seconds
    const logBucket = Math.floor(elapsedSec / 10);
    if (logBucket !== lastLogElapsed) {
      lastLogElapsed = logBucket;
      console.log(
        `[Replicate] Polling  elapsed=${elapsedSec}s  status=${lastPred.status}  output=${lastPred.output != null ? "YES" : "NO"}`,
      );
    }

    // Hard timeout
    if (totalElapsedMs > timeoutMs) {
      const msg =
        `Timed out after ${elapsedSec}s (limit: ${timeoutMs / 1000}s). ` +
        `Prediction ID: ${pred.id}`;
      console.error(
`[Replicate] TIMEOUT
  ID:          ${pred.id}
  Last status: ${lastPred.status}
  Elapsed:     ${elapsedSec}s
  Full prediction object:
${JSON.stringify(lastPred, null, 2)}`,
      );
      throw new Error(msg);
    }

    // Fetch current status
    try {
      const res = await fetch(predUrl, { headers });
      if (res.ok) {
        lastPred = (await res.json()) as RepPrediction;
      }
    } catch {
      // transient — keep polling
    }

    if (lastPred.status === "succeeded") {
      const elapsedMs = Date.now() - t0;
      const outputType =
        lastPred.output == null ? "null"
        : Array.isArray(lastPred.output) ? `array[${(lastPred.output as unknown[]).length}]`
        : typeof lastPred.output;

      console.log(
`[Replicate] Succeeded
  ID:      ${pred.id}
  Runtime: ${(elapsedMs / 1000).toFixed(1)}s
  Status:  succeeded
  Output:  ${outputType}`,
      );
      return { output: lastPred.output, elapsedMs };
    }

    if (lastPred.status === "failed" || lastPred.status === "canceled") {
      const elapsedMs = Date.now() - t0;
      console.error(
`[Replicate] FAILED
  ID:          ${pred.id}
  Last status: ${lastPred.status}
  Elapsed:     ${Math.round(elapsedMs / 1000)}s
  Full prediction object:
${JSON.stringify(lastPred, null, 2)}`,
      );
      throw new Error(
        `Prediction ${lastPred.status}: ${lastPred.error ?? "unknown error"}. ` +
        `Prediction ID: ${pred.id}`,
      );
    }
  }
}

// Fetches a URL and returns its content as a base64 string (no data: prefix).
// Used by model parsers when Replicate returns mask image URLs instead of base64.
export async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}
