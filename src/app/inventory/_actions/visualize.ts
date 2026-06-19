"use server";

// SAM-2 on Replicate — verify version at replicate.com/meta/sam-2/versions
const SAM_VERSION =
  "cbd95fb76192174268b6b303aeeb7a736e8dab0cbc38177f09db79b2299da30b";
const POLL_INTERVAL_MS = 2500;
const POLL_MAX = 28; // ~70 seconds before giving up

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: { combined_mask?: string; individual_masks?: string[] } | null;
  error?: string | null;
  urls?: { get: string };
};

async function pollUntilDone(predictionId: string): Promise<ReplicatePrediction> {
  const headers = {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers },
    );
    if (!res.ok) throw new Error(`Replicate polling error: ${res.status}`);

    const prediction = (await res.json()) as ReplicatePrediction;

    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error ?? "Segmentation failed on Replicate.");
    }
  }

  throw new Error("Surface detection timed out. Please try again with a smaller photo.");
}

// ─── detectSurface ────────────────────────────────────────────────────────────
// Sends room photo + one tap point to SAM-2.
// Returns the raw SAM mask as a base64 PNG data URL (white = detected surface).
// Client converts this to an OpenAI-format alpha mask before calling renderVisualization.

export type DetectResult = {
  rawMaskBase64: string | null; // data:image/png;base64,...  white = surface
  error: string | null;
};

export async function detectSurface(formData: FormData): Promise<DetectResult> {
  try {
    const photo = formData.get("photo") as File | null;
    const pointX = Number(formData.get("pointX"));
    const pointY = Number(formData.get("pointY"));

    if (!photo) return { rawMaskBase64: null, error: "No photo provided." };
    if (!process.env.REPLICATE_API_TOKEN) {
      return { rawMaskBase64: null, error: "REPLICATE_API_TOKEN is not set." };
    }

    const buf = await photo.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;

    // Create prediction
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: SAM_VERSION,
        input: {
          image: dataUrl,
          // SAM-2 point_coords format: "[x,y]" comma-separated pairs
          point_coords: `[${pointX},${pointY}]`,
          point_labels: "1", // 1 = positive (include this region)
        },
      }),
    });

    if (!createRes.ok) {
      const err = (await createRes.json().catch(() => ({}))) as { detail?: string };
      return { rawMaskBase64: null, error: err.detail ?? `Replicate error: ${createRes.status}` };
    }

    const prediction = (await createRes.json()) as ReplicatePrediction;

    // Poll until done
    const done = await pollUntilDone(prediction.id);

    // combined_mask is the single merged mask — best choice for a single tap point
    const maskUrl = done.output?.combined_mask ?? done.output?.individual_masks?.[0];
    if (!maskUrl) {
      return { rawMaskBase64: null, error: "Couldn't detect a clear surface. Try tapping a different spot." };
    }

    // Fetch mask from Replicate CDN server-side to avoid CORS issues on client
    const maskRes = await fetch(maskUrl);
    if (!maskRes.ok) {
      return { rawMaskBase64: null, error: "Failed to retrieve mask from Replicate." };
    }

    const maskBuf = await maskRes.arrayBuffer();
    const maskB64 = Buffer.from(maskBuf).toString("base64");

    return { rawMaskBase64: `data:image/png;base64,${maskB64}`, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Surface detection failed.";
    return { rawMaskBase64: null, error: msg };
  }
}

// ─── renderVisualization ──────────────────────────────────────────────────────
// Sends room photo + OpenAI-format alpha mask + slab reference image to GPT Image 1.
// Alpha mask convention: alpha=0 (transparent) = editable region, alpha=255 = preserve.
// Returns rendered result as base64 PNG data URL.

export type RenderResult = {
  resultBase64: string | null;
  error: string | null;
};

export async function renderVisualization(formData: FormData): Promise<RenderResult> {
  try {
    const photo = formData.get("photo") as File | null;
    const alphaMaskBase64 = formData.get("alphaMaskBase64") as string | null;
    const slabImageUrl = formData.get("slabImageUrl") as string | null;
    const marbleName = (formData.get("marbleName") as string | null) ?? "marble";

    if (!photo || !alphaMaskBase64 || !slabImageUrl) {
      return { resultBase64: null, error: "Missing inputs for render." };
    }
    if (!process.env.OPENAI_API_KEY) {
      return { resultBase64: null, error: "OPENAI_API_KEY is not set." };
    }

    // Fetch slab image from Cloudinary
    const slabRes = await fetch(slabImageUrl);
    if (!slabRes.ok) {
      return { resultBase64: null, error: "Failed to load slab image from Cloudinary." };
    }
    const slabBuf = await slabRes.arrayBuffer();
    const slabBlob = new Blob([slabBuf], { type: "image/jpeg" });

    // Decode alpha mask base64 → Blob
    const maskRaw = alphaMaskBase64.replace(/^data:image\/\w+;base64,/, "");
    const maskBuf = Buffer.from(maskRaw, "base64");
    const maskBlob = new Blob([maskBuf], { type: "image/png" });

    const prompt =
      `Replace only the masked surface area with ${marbleName} marble stone. ` +
      `Use the exact texture, colour, and veining pattern from the reference image provided. ` +
      `Preserve the room's existing lighting direction, shadows, perspective, and reflections exactly. ` +
      `Do not alter anything outside the masked area.`;

    const fd = new FormData();
    fd.append("model", "gpt-image-1");
    fd.append("image[]", photo, "room.jpg");       // image[0] — mask applies here
    fd.append("image[]", slabBlob, "slab.jpg");    // image[1] — material reference
    fd.append("mask", maskBlob, "mask.png");
    fd.append("prompt", prompt);
    fd.append("n", "1");
    fd.append("size", "1024x1024");
    fd.append("response_format", "b64_json");

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: fd,
    });

    if (!openaiRes.ok) {
      const errData = (await openaiRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        resultBase64: null,
        error: errData.error?.message ?? `OpenAI error: ${openaiRes.status}`,
      };
    }

    const data = (await openaiRes.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const item = data.data?.[0];
    if (!item) return { resultBase64: null, error: "No image returned by OpenAI." };

    if (item.b64_json) {
      return { resultBase64: `data:image/png;base64,${item.b64_json}`, error: null };
    }

    if (item.url) {
      const imgRes = await fetch(item.url);
      const imgBuf = await imgRes.arrayBuffer();
      const imgB64 = Buffer.from(imgBuf).toString("base64");
      return { resultBase64: `data:image/png;base64,${imgB64}`, error: null };
    }

    return { resultBase64: null, error: "Unexpected response format from OpenAI." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rendering failed.";
    return { resultBase64: null, error: msg };
  }
}
