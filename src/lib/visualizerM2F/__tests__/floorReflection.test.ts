import { describe, expect, it } from "vitest";

import { computeFloorReflection } from "@/lib/visualizerM2F/floorReflection";

const W = 60, H = 100;

// Rows 0–29 blue wall, rows 30–49 red furniture, rows 50–99 floor.
function scene() {
  const px = new Uint8ClampedArray(W * H * 4);
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < 30)      px[i * 4 + 2] = 255;
      else if (y < 50) px[i * 4] = 255;
      else             { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 200; mask[i] = 255; }
      px[i * 4 + 3] = 255;
    }
  }
  return { px, mask };
}

describe("computeFloorReflection", () => {
  it("mirrors what stands on the floor about its contact line", () => {
    const { px, mask } = scene();
    const { rgb, alpha } = computeFloorReflection(px, mask, W, H);

    const at = (y: number) => ({ r: rgb[(y * W + 30) * 3]!, b: rgb[(y * W + 30) * 3 + 2]!, a: alpha[y * W + 30]! });
    // 8 rows below the contact line mirrors the red furniture 8 rows above it…
    expect(at(58).r).toBeGreaterThan(200);
    expect(at(58).b).toBeLessThan(40);
    // …and 30 rows below reaches the blue wall behind it.
    expect(at(80).b).toBeGreaterThan(200);
    expect(at(80).r).toBeLessThan(40);
  });

  it("fades with distance from the contact line and is zero off the floor", () => {
    const { px, mask } = scene();
    const { alpha } = computeFloorReflection(px, mask, W, H);
    expect(alpha[58 * W + 30]!).toBeGreaterThan(alpha[85 * W + 30]!);
    expect(alpha[85 * W + 30]!).toBeGreaterThan(0);
    expect(alpha[20 * W + 30]).toBe(0);
  });

  it("shows nothing where the mirrored point is outside the photo", () => {
    const px = new Uint8ClampedArray(W * H * 4).fill(200);
    const mask = new Uint8Array(W * H);
    for (let y = 10; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = 255;
    const { alpha } = computeFloorReflection(px, mask, W, H);
    expect(alpha[90 * W + 30]).toBe(0); // 80 rows below a contact line that is only 10 rows from the top
  });
});
