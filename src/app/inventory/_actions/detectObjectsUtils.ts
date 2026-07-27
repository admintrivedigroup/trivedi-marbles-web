/**
 * Shared utilities for Grounding DINO detection — NOT a server action file.
 * Imported by both detectObjects.ts and detectObjectsDebug.ts.
 */

export type BoxCategory =
  | "furniture"
  | "stair"
  | "wall_element"
  | "skirting"
  | "ceiling"
  | "floor_hint"
  | "other";

// Objects/occluders only — DINO is not asked to detect floor, wall, or ceiling.
// Floor detection comes from SAM + depth + geometry.
export const OCCLUSION_QUERY =
  "chair . chair legs . table . table legs . console table . sofa . couch . armchair . " +
  "cabinet . bookshelf . wardrobe . dresser . bed . tv stand . " +
  "furniture . bench . ottoman . stool . " +
  "staircase . stair riser . stair tread . stair panel . step . newel post . stair railing . railing . " +
  "door . door frame . window . mirror . " +
  "skirting board . baseboard . " +
  "rug . carpet . mat . plant . vase . person";

export function categorize(label: string): BoxCategory {
  const l = label.toLowerCase();
  if (/stair|step|riser|tread|newel|railing|stringer/.test(l))                            return "stair";
  if (/skirting|baseboard/.test(l))                                                       return "skirting";
  // wall/column/pillar labels may still appear if DINO hallucinates — keep categorised
  // but door/window/mirror/frame are discrete objects → "other" (no side-wall expansion)
  if (/^wall\b|column|pillar|cladding/.test(l))                                           return "wall_element";
  if (/chair|table|sofa|couch|cabinet|armchair|shelf|rug|mat|carpet|plant|vase|furniture|bench|ottoman|stool|dresser|wardrobe|bed|person/.test(l)) return "furniture";
  return "other";  // door, frame, window, mirror, console table, tv stand, etc.
}

// BoundingBox lives here so parseOutput can reference it without touching
// detectObjects.ts ("use server") — avoids circular imports.
export type BoundingBox = {
  label:      string;
  confidence: number;
  x1: number; y1: number;
  x2: number; y2: number;
  category: BoxCategory;
};

/** Extract one detection object into (box, phrase, score) regardless of field naming. */
function extractDetection(d: Record<string, unknown>): { box: number[]; phrase: string; score: number } | null {
  // Box: try every field name Grounding DINO variants use
  const box = (
    d.bbox ?? d.box ?? d.bounding_box ?? d.xyxy ?? d.xywh ?? d.coordinates
  ) as number[] | undefined;

  // Label / phrase
  const phrase = (
    d.label ?? d.phrase ?? d.class_name ?? d.class ?? d.category ?? d.text ?? d.name ?? d.caption
  ) as string | undefined;

  // Confidence score
  const score = (
    d.score ?? d.confidence ?? d.logit ?? d.prob ?? d.probability
  ) as number | undefined;

  if (!box || box.length < 4) return null;

  return {
    box:    box.slice(0, 4) as number[],
    phrase: typeof phrase === "string" ? phrase : "object",
    score:  typeof score  === "number" ? score  : 0.5,
  };
}

export function parseOutput(
  output:        unknown,
  naturalWidth:  number,
  naturalHeight: number,
): BoundingBox[] {
  const items: Array<{ box: number[]; phrase: string; score: number }> = [];

  if (Array.isArray(output)) {
    // Format: array of detection objects
    for (const d of output as Array<Record<string, unknown>>) {
      const det = extractDetection(d);
      if (det) items.push(det);
    }
  } else if (output && typeof output === "object") {
    const out = output as Record<string, unknown>;

    if (Array.isArray(out.detections)) {
      // Format: { detections: [...], result_image: "..." }  ← adirik/grounding-dino actual schema
      for (const d of out.detections as Array<Record<string, unknown>>) {
        const det = extractDetection(d);
        if (det) items.push(det);
      }
    } else if (Array.isArray(out.boxes)) {
      // Legacy format: { boxes: [[...]], phrases: [...], logits: [...] }
      const rawBoxes = out.boxes   as number[][];
      const phrases  = ((out.phrases ?? out.labels ?? out.texts) as string[] | undefined) ?? [];
      const logits   = ((out.logits  ?? out.scores)              as number[] | undefined) ?? [];
      rawBoxes.forEach((box, i) => items.push({
        box,
        phrase: phrases[i] ?? "object",
        score:  logits[i]  ?? 0.5,
      }));
    }
    // If output is { result_image: "..." } with no detections key → items stays []
  }
  // If output is a plain string (image URL) → items stays []

  return items.map(({ box, phrase, score }) => {
    const isNorm = box.every((v) => v <= 2);
    return {
      label:      phrase,
      confidence: score,
      x1: Math.round(isNorm ? box[0] * naturalWidth  : box[0]),
      y1: Math.round(isNorm ? box[1] * naturalHeight : box[1]),
      x2: Math.round(isNorm ? box[2] * naturalWidth  : box[2]),
      y2: Math.round(isNorm ? box[3] * naturalHeight : box[3]),
      category: categorize(phrase),
    };
  });
}
