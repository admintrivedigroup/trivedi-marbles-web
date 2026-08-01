import type { SurfaceCategory } from "./types";

// ADE20K label → surface category mapping (substring match, longest key wins on tie)
export const LABEL_CATEGORY: Record<string, SurfaceCategory> = {
  // Floor
  "wood floor":    "floor",
  "wood-paneled":  "floor",
  floor:           "floor",
  carpet:          "floor",
  rug:             "floor",
  mat:             "floor",
  linoleum:        "floor",
  // Wall
  wall:            "wall",
  // Ceiling
  ceiling:         "ceiling",
  // Stairs / ramps
  stairway:        "stairs",
  staircase:       "stairs",
  stairs:          "stairs",
  escalator:       "stairs",
  bannister:       "stairs",
  railing:         "stairs",
  step:            "stairs",
  // Openings
  "screen door":   "opening",
  "glass door":    "opening",
  "door frame":    "opening",
  windowpane:      "opening",
  window:          "opening",
  door:            "opening",
  // Furniture
  "coffee table":  "furniture",
  "swivel chair":  "furniture",
  "kitchen island":"countertop",
  bookcase:        "furniture",
  wardrobe:        "furniture",
  armchair:        "furniture",
  ottoman:         "furniture",
  dresser:         "furniture",
  cabinet:         "furniture",
  cushion:         "furniture",
  curtain:         "furniture",
  chair:           "furniture",
  bench:           "furniture",
  table:           "furniture",
  shelf:           "furniture",
  stool:           "furniture",
  sofa:            "furniture",
  couch:           "furniture",
  desk:            "furniture",
  bed:             "furniture",
  // Fixtures
  countertop:      "countertop",
  counter:         "countertop",
  refrigerator:    "fixture",
  dishwasher:      "fixture",
  microwave:       "fixture",
  bathtub:         "fixture",
  shower:          "fixture",
  washer:          "fixture",
  toilet:          "fixture",
  stove:           "fixture",
  sink:            "fixture",
  oven:            "fixture",
};

export const CATEGORY_LABEL: Record<SurfaceCategory, string> = {
  floor:      "Floor",
  wall:       "Wall",
  ceiling:    "Ceiling",
  stairs:     "Stairs",
  opening:    "Opening",
  furniture:  "Furniture",
  fixture:    "Fixture",
  countertop: "Countertop",
  other:      "Other",
};

export const CATEGORY_COLOR: Record<SurfaceCategory, [number, number, number]> = {
  floor:      [128,  64, 128],
  wall:       [ 70, 130, 180],
  ceiling:    [200, 200,  80],
  stairs:     [200, 120,  80],
  opening:    [ 30, 100, 220],
  furniture:  [220,  20,  60],
  fixture:    [107, 180,  60],
  countertop: [180, 140,  80],
  other:      [120, 120, 120],
};

const LABEL_COLORS: Record<string, [number, number, number]> = {
  "wood floor": [160,  90,  60],
  carpet:       [100, 180, 100],
  rug:          [ 80, 160,  80],
  floor:        [128,  64, 128],
  wall:         [ 70, 130, 180],
  ceiling:      [200, 200,  80],
  stairway:     [200, 120,  80],
  staircase:    [200, 120,  80],
  stairs:       [200, 120,  80],
  step:         [180, 110,  70],
  railing:      [220, 160, 100],
  bannister:    [220, 160, 100],
  windowpane:   [ 30, 100, 220],
  window:       [ 30, 100, 220],
  door:         [ 20,  20, 120],
  chair:        [220,  20,  60],
  table:        [  0,   0, 200],
  sofa:         [140,  20,  50],
  couch:        [140,  20,  50],
  armchair:     [180,  40,  70],
  bed:          [220, 100,  40],
  cabinet:      [100,  80, 200],
  bookcase:     [ 80, 120, 180],
  dresser:      [140, 100, 180],
  wardrobe:     [160, 100, 200],
  countertop:   [180, 140,  80],
  counter:      [180, 140,  80],
  sink:         [100, 180, 200],
  toilet:       [200, 180, 160],
  bathtub:      [ 80, 160, 140],
  refrigerator: [160, 200, 220],
  lamp:         [255, 210,  60],
  plant:        [ 60, 170,  60],
  curtain:      [220, 190, 210],
  fireplace:    [255,  90,  30],
};

export function getCategory(label: string): SurfaceCategory {
  const normalized = label.toLowerCase().trim();
  // Try longest match first for specificity
  const keys = Object.keys(LABEL_CATEGORY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized.includes(key)) return LABEL_CATEGORY[key]!;
  }
  return "other";
}

export function getLabelColor(label: string): [number, number, number] {
  const normalized = label.toLowerCase().trim();
  for (const [key, color] of Object.entries(LABEL_COLORS)) {
    if (normalized.includes(key)) return color;
  }
  // Deterministic hash-based color for unknown labels
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return [
    (Math.abs(h)        % 180) + 55,
    (Math.abs(h >> 8)   % 180) + 55,
    (Math.abs(h >> 16)  % 180) + 55,
  ];
}
