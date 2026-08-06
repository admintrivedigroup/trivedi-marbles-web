import { describe, expect, it } from "vitest";

import { computeContactShadow } from "@/lib/visualizerM2F/perspectiveRenderer";

const W = 100, H = 100;

function rectMask(x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 255;
  return m;
}

describe("computeContactShadow", () => {
  it("returns all-1 (no darkening) when there are no occluders", () => {
    const occMask = new Uint8Array(W * H);
    const mul = computeContactShadow(occMask, W, H);
    for (let i = 0; i < W * H; i++) expect(mul[i]).toBe(1);
  });

  it("darkens floor pixels just outside an occluder, fading back to 1 further away", () => {
    // A furniture block in the middle of the floor.
    const occMask = rectMask(40, 40, 60, 60);
    const mul = computeContactShadow(occMask, W, H);

    const rowY = 50; // through the vertical center of the block
    const rightEdgeX = 61; // first floor pixel just outside the block's right edge
    const near  = mul[rowY * W + rightEdgeX]!;
    const mid   = mul[rowY * W + rightEdgeX + 4]!;
    const far   = mul[rowY * W + rightEdgeX + 30]!;

    expect(near).toBeLessThan(1);       // darkened right at the boundary
    expect(near).toBeLessThan(mid);     // darkest right at the edge, fading outward
    expect(mid).toBeLessThanOrEqual(far);
    expect(far).toBeCloseTo(1, 1);      // back to ~no darkening a good distance away
  });

  it("never darkens below (1 − CONTACT_SHADOW_STRENGTH) even directly adjacent to a large occluder", () => {
    const occMask = rectMask(0, 0, 79, 79); // large block covering most of the image
    const mul = computeContactShadow(occMask, W, H);
    for (let i = 0; i < W * H; i++) {
      expect(mul[i]!).toBeGreaterThanOrEqual(0.5); // 1 - 0.45 (CONTACT_SHADOW_STRENGTH) with headroom
      expect(mul[i]!).toBeLessThanOrEqual(1);
    }
  });

  it("leaves the multiplier at exactly 1 for pixels inside the occluder itself (value unused, but must stay well-formed)", () => {
    const occMask = rectMask(40, 40, 60, 60);
    const mul = computeContactShadow(occMask, W, H);
    expect(mul[50 * W + 50]).toBe(1);
  });
});
