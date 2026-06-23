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

export type DetectResult = {
  rawMaskBase64: string | null;
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
          point_coords: `[${pointX},${pointY}]`,
          point_labels: "1",
        },
      }),
    });

    if (!createRes.ok) {
      const err = (await createRes.json().catch(() => ({}))) as { detail?: string };
      return { rawMaskBase64: null, error: err.detail ?? `Replicate error: ${createRes.status}` };
    }

    const prediction = (await createRes.json()) as ReplicatePrediction;
    const done = await pollUntilDone(prediction.id);

    const maskUrl = done.output?.combined_mask ?? done.output?.individual_masks?.[0];
    if (!maskUrl) {
      return { rawMaskBase64: null, error: "Couldn't detect a clear surface. Try tapping a different spot." };
    }

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

// ─── classifySurface ──────────────────────────────────────────────────────────
// Uses GPT-4o mini to identify whether the tapped area is floor, wall, or countertop.
// Runs in parallel with detectSurface — non-fatal if it fails.

export type SurfaceType = "floor" | "wall" | "countertop";

export type ClassifyResult = {
  surfaceType: SurfaceType | null;
  error: string | null;
};

export async function classifySurface(formData: FormData): Promise<ClassifyResult> {
  try {
    const photo = formData.get("photo") as File | null;
    const pointX = Number(formData.get("pointX"));
    const pointY = Number(formData.get("pointY"));
    const naturalWidth = Number(formData.get("naturalWidth")) || 1;
    const naturalHeight = Number(formData.get("naturalHeight")) || 1;

    if (!photo || !process.env.OPENAI_API_KEY) return { surfaceType: null, error: null };

    const buf = await photo.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const dataUrl = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    const pctX = Math.round((pointX / naturalWidth) * 100);
    const pctY = Math.round((pointY / naturalHeight) * 100);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 10,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            {
              type: "text",
              text: `The user tapped at ${pctX}% from the left and ${pctY}% from the top of this room photo. What type of surface is at that tap location? Reply with exactly one word: floor, wall, or countertop.`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) return { surfaceType: null, error: null };

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.toLowerCase().trim() ?? "";

    if (text.includes("floor")) return { surfaceType: "floor", error: null };
    if (text.includes("counter")) return { surfaceType: "countertop", error: null };
    if (text.includes("wall")) return { surfaceType: "wall", error: null };
    return { surfaceType: null, error: null };
  } catch {
    return { surfaceType: null, error: null };
  }
}

// ─── renderVisualization ──────────────────────────────────────────────────────

export type RenderResult = {
  resultBase64: string | null;
  error: string | null;
};

const SURFACE_RENDER_HINTS: Record<string, string> = {
  floor: "horizontal floor — apply correct perspective foreshortening and subtle stone polish reflections",
  wall: "vertical wall — use natural flat texture with soft ambient shading",
  countertop: "horizontal countertop — apply strong specular highlights, sharp polished reflections, and crisp edge definition",
};

export async function renderVisualization(formData: FormData): Promise<RenderResult> {
  try {
    const photo = formData.get("photo") as File | null;
    const alphaMaskBase64 = formData.get("alphaMaskBase64") as string | null;
    const slabImageUrl = formData.get("slabImageUrl") as string | null;
    const slabImageBase64 = formData.get("slabImageBase64") as string | null;
    const marbleName = (formData.get("marbleName") as string | null) ?? "marble";
    const surfaceType = formData.get("surfaceType") as string | null;
    const bookmatch = formData.get("bookmatch") === "true";

    if (!photo || !alphaMaskBase64 || (!slabImageUrl && !slabImageBase64)) {
      return { resultBase64: null, error: "Missing inputs for render." };
    }
    if (!process.env.OPENAI_API_KEY) {
      return { resultBase64: null, error: "OPENAI_API_KEY is not set." };
    }

    // Use pre-processed base64 (e.g. bookmatched) when provided, otherwise fetch from Cloudinary
    let slabBlob: Blob;
    if (slabImageBase64) {
      const raw = slabImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const slabBuf = Buffer.from(raw, "base64");
      slabBlob = new Blob([slabBuf], { type: "image/jpeg" });
    } else {
      const slabRes = await fetch(slabImageUrl!);
      if (!slabRes.ok) return { resultBase64: null, error: "Failed to load slab image from Cloudinary." };
      const slabBuf = await slabRes.arrayBuffer();
      slabBlob = new Blob([slabBuf], { type: "image/jpeg" });
    }

    const maskRaw = alphaMaskBase64.replace(/^data:image\/\w+;base64,/, "");
    const maskBuf = Buffer.from(maskRaw, "base64");
    const maskBlob = new Blob([maskBuf], { type: "image/png" });

    const surfaceDesc = surfaceType
      ? (SURFACE_RENDER_HINTS[surfaceType] ?? "surface")
      : "surface";
    const bookmatchNote = bookmatch
      ? " The slab reference shows a pre-mirrored bookmatched texture — apply it as a symmetrical bookmatched pattern across the surface."
      : "";

    const prompt =
      `Replace only the masked ${surfaceDesc} with ${marbleName} marble stone.` +
      `${bookmatchNote} ` +
      `Use the exact colour, veining pattern, and texture from the reference slab image. ` +
      `Scale the veining true-to-life so individual veins appear at realistic widths relative to the actual surface dimensions. ` +
      `Precisely match the existing light direction, cast shadows, ambient colour temperature, and surface reflectivity of the room. ` +
      `Do not alter anything outside the masked area.`;

    const fd = new FormData();
    fd.append("model", "gpt-image-1");
    fd.append("image[]", photo, "room.jpg");
    fd.append("image[]", slabBlob, "slab.jpg");
    fd.append("mask", maskBlob, "mask.png");
    fd.append("prompt", prompt);
    fd.append("n", "1");
    fd.append("size", "1024x1024");

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
