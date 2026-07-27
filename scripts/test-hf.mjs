/**
 * Standalone HuggingFace API connectivity test.
 *
 * Usage:
 *   node scripts/test-hf.mjs                          # uses built-in 1×1 JPEG
 *   node scripts/test-hf.mjs test-images/surfaces/hallway.jpg
 *
 * Reads HUGGINGFACE_API_TOKEN from .env.local automatically.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Load .env.local manually (no dotenv dependency needed) ───────────────────
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

// ── Config ────────────────────────────────────────────────────────────────────
const TOKEN    = process.env.HUGGINGFACE_API_TOKEN ?? "";
const MODEL_ID = "nvidia/segformer-b5-finetuned-ade-640-640";
const URL      = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

// Minimal valid 1×1 white JPEG — works as a smoke-test even without a real photo
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
  "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
  "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
  "MjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIhAA" +
  "AgIBBQEBAAAAAAAAAAAAAQIDBAUREiExUf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEA" +
  "AAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABtgAAAAAAAAA/9k=",
  "base64",
);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== HuggingFace API Test ===\n");
  console.log("Model  :", MODEL_ID);
  console.log("URL    :", URL);
  console.log("Token  :", TOKEN ? `EXISTS (${TOKEN.length} chars, starts with ${TOKEN.slice(0, 6)}...)` : "MISSING");

  if (!TOKEN) {
    console.error("\nERROR: HUGGINGFACE_API_TOKEN not found.");
    console.error("Add it to .env.local and restart.\n");
    process.exit(1);
  }

  // ── Load image ──────────────────────────────────────────────────────────────
  let imageBytes;
  let contentType = "image/jpeg";
  const imgArg = process.argv[2];

  if (imgArg) {
    const imgPath = path.isAbsolute(imgArg) ? imgArg : path.join(ROOT, imgArg);
    if (!fs.existsSync(imgPath)) {
      console.error(`\nERROR: Image not found: ${imgPath}`);
      process.exit(1);
    }
    imageBytes  = fs.readFileSync(imgPath);
    contentType = imgPath.endsWith(".png") ? "image/png" : "image/jpeg";
    console.log(`Image  : ${imgPath} (${Math.round(imageBytes.length / 1024)} KB, ${contentType})\n`);
  } else {
    imageBytes = MINIMAL_JPEG;
    console.log("Image  : built-in 1×1 JPEG (connectivity test only)\n");
  }

  // ── DNS check (system resolver) ─────────────────────────────────────────────
  console.log("--- DNS / connectivity ---");
  let systemDnsOk = false;
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const dns = require("dns/promises");
    const addrs = await dns.lookup("api-inference.huggingface.co");
    console.log("System DNS OK :", addrs.address);
    systemDnsOk = true;
  } catch (e) {
    console.error("System DNS FAIL:", e.message);
  }

  // ── DNS check (public DNS — 8.8.8.8) ────────────────────────────────────────
  if (!systemDnsOk) {
    console.log("\nTrying via public DNS (8.8.8.8) …");
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const { Resolver } = require("dns/promises");
      const r = new Resolver();
      r.setServers(["8.8.8.8", "1.1.1.1"]);
      const addrs = await r.resolve4("api-inference.huggingface.co");
      console.log("Public DNS OK :", addrs[0]);
      console.log("  → System DNS is broken but the hostname resolves via 8.8.8.8.");
      console.log("  → Fix: set DNS servers on this machine to 8.8.8.8 / 1.1.1.1");
      console.log("         (Windows: ncpa.cpl → adapter → IPv4 properties → DNS)");
    } catch (e2) {
      console.error("Public DNS also FAIL:", e2.message);
      console.error("  → No internet access or all DNS blocked from this machine.");
      console.error("  → Try: curl -v https://api-inference.huggingface.co");
      console.error("  → Or run the Next.js dev server on a machine with internet.");
    }
    console.log();
  }

  // ── HTTP request ─────────────────────────────────────────────────────────────
  console.log("\n--- HTTP request ---");
  const t0 = Date.now();

  try {
    const res = await fetch(URL, {
      method:  "POST",
      headers: {
        Authorization:      `Bearer ${TOKEN}`,
        "Content-Type":     contentType,
        "x-wait-for-model": "true",
      },
      body: imageBytes,
    });

    const elapsed = Date.now() - t0;
    console.log(`Status       : ${res.status} ${res.statusText}  (${elapsed}ms)`);
    console.log("Content-Type :", res.headers.get("content-type") ?? "(none)");
    console.log("x-request-id :", res.headers.get("x-request-id") ?? "(none)");

    const body = await res.text();
    console.log(`Body (first 1000 chars):\n${body.slice(0, 1000)}`);

    if (res.ok) {
      try {
        const json = JSON.parse(body);
        if (Array.isArray(json)) {
          console.log(`\nOK — ${json.length} segments returned`);
          if (json.length > 0) console.log("First segment keys:", Object.keys(json[0]).join(", "));
        } else {
          console.log("\nOK — non-array JSON response");
        }
      } catch {
        console.log("\nOK — but body is not valid JSON");
      }
    } else {
      switch (res.status) {
        case 401:
        case 403: console.error("\nERROR: Auth failed — token is wrong or revoked"); break;
        case 404: console.error("\nERROR: Model not found — check the model ID"); break;
        case 422: console.error("\nERROR: Invalid input — image may be too small or wrong format"); break;
        case 503: {
          let eta = "";
          try { const j = JSON.parse(body); eta = j.estimated_time ? ` (~${j.estimated_time}s)` : ""; } catch {}
          console.error(`\nERROR: Model loading${eta} — retry in a moment`);
          break;
        }
        default:  console.error(`\nERROR: HTTP ${res.status}`);
      }
    }
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`\nFetch threw after ${elapsed}ms:`);
    console.error("  name   :", err.name);
    console.error("  message:", err.message);
    if (err.cause) {
      console.error("  cause  :", err.cause);
      if (err.cause.code)    console.error("  code   :", err.cause.code);
      if (err.cause.syscall) console.error("  syscall:", err.cause.syscall);
      if (err.cause.address) console.error("  address:", err.cause.address);
    }
    console.error("\nCommon causes:");
    console.error("  ENOTFOUND    → DNS resolution failed; no internet or proxy needed");
    console.error("  ECONNREFUSED → port blocked by firewall");
    console.error("  CERT_*       → TLS certificate issue; try NODE_TLS_REJECT_UNAUTHORIZED=0 to confirm");
    console.error("  AbortError   → request timed out");
  }
}

main();
