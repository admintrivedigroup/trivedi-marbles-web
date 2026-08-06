import { describe, expect, it } from "vitest";

import {
  applySpecularHighlight,
  computeSpecularParams,
  findFloorAnchorBelowMask,
} from "@/lib/visualizerM2F/perspectiveRenderer";

const W = 200, H = 300;

function rectMask(x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 255;
  return m;
}

// Simple affine "homography" (h6=h7=0, so w≡1) — normalizes pixel coords to [0,1]²,
// used only so the pure math in computeSpecularParams can be hand-verified directly.
const IDENTITY_H = [1 / W, 0, 0, 0, 1 / H, 0, 0, 0];

describe("findFloorAnchorBelowMask", () => {
  it("finds the floor pixel directly below a window's base, at the window's horizontal center", () => {
    const lightMask = rectMask(50, 20, 100, 60);   // window, x∈[50,100], bottom y=60
    const surfMask  = rectMask(0, 150, W - 1, H - 1); // floor starts at y=150
    const anchor = findFloorAnchorBelowMask(lightMask, surfMask, W, H);
    expect(anchor).not.toBeNull();
    expect(anchor!.x).toBe(75); // (50+100)/2
    expect(anchor!.y).toBe(150); // first floor row below the window
  });

  it("returns null when there's no light-source mask", () => {
    const lightMask = new Uint8Array(W * H); // empty
    const surfMask  = rectMask(0, 150, W - 1, H - 1);
    expect(findFloorAnchorBelowMask(lightMask, surfMask, W, H)).toBeNull();
  });

  it("returns null when no floor exists below the light source within the scan range", () => {
    const lightMask = rectMask(50, 20, 100, 60);
    const surfMask  = new Uint8Array(W * H); // no floor anywhere
    expect(findFloorAnchorBelowMask(lightMask, surfMask, W, H)).toBeNull();
  });

  it("finds floor immediately adjacent to the light source's base", () => {
    const lightMask = rectMask(50, 20, 100, 60);
    const surfMask  = rectMask(0, 61, W - 1, H - 1); // floor starts right below the window
    const anchor = findFloorAnchorBelowMask(lightMask, surfMask, W, H);
    expect(anchor).toEqual({ x: 75, y: 61 });
  });
});

describe("computeSpecularParams", () => {
  it("uses the base intensity when no depth is provided", () => {
    const params = computeSpecularParams({ x: 100, y: 150 }, null, W, IDENTITY_H);
    expect(params.intensity).toBeCloseTo(0.5, 5);
    expect(params.au).toBeCloseTo(100 / W, 5);
    expect(params.av).toBeCloseTo(150 / H, 5);
    expect(params.radiusU).toBeGreaterThan(0);
    expect(params.radiusV).toBeGreaterThan(0);
  });

  it("scales intensity up for a near (bright) depth pixel and down for a far (dark) one, both within bounds", () => {
    const nearDepth = new Uint8Array(W * H).fill(255);
    const farDepth  = new Uint8Array(W * H).fill(0);

    const near = computeSpecularParams({ x: 100, y: 150 }, nearDepth, W, IDENTITY_H);
    const far  = computeSpecularParams({ x: 100, y: 150 }, farDepth, W, IDENTITY_H);

    expect(near.intensity).toBeGreaterThan(far.intensity);
    for (const p of [near, far]) {
      expect(p.intensity).toBeGreaterThanOrEqual(0.25);
      expect(p.intensity).toBeLessThanOrEqual(0.85);
    }
  });
});

describe("applySpecularHighlight", () => {
  const specular = { au: 0.5, av: 0.5, radiusU: 0.15, radiusV: 0.2, intensity: 0.6 };

  it("returns the input unchanged when specular is null", () => {
    expect(applySpecularHighlight(100, 120, 140, 0.5, 0.5, null)).toEqual([100, 120, 140]);
  });

  it("brightens at the exact anchor and never exceeds 255 or drops below the input", () => {
    const [r, g, b] = applySpecularHighlight(100, 120, 140, 0.5, 0.5, specular);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeGreaterThan(120);
    expect(b).toBeGreaterThan(140);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeLessThanOrEqual(255);
  });

  it("leaves pixels far outside the falloff radius unchanged", () => {
    const [r, g, b] = applySpecularHighlight(100, 120, 140, 0.5 + 5, 0.5 + 5, specular);
    expect([r, g, b]).toEqual([100, 120, 140]);
  });

  it("falls off monotonically with distance from the anchor", () => {
    const near = applySpecularHighlight(100, 100, 100, 0.51, 0.5, specular);
    const mid  = applySpecularHighlight(100, 100, 100, 0.55, 0.5, specular);
    const far  = applySpecularHighlight(100, 100, 100, 0.60, 0.5, specular);
    expect(near[0]).toBeGreaterThanOrEqual(mid[0]);
    expect(mid[0]).toBeGreaterThanOrEqual(far[0]);
  });

  it("never darkens a pixel (screen blend only brightens)", () => {
    for (const [du, dv] of [[0, 0], [0.05, 0], [0.1, 0.1], [0.3, 0.3]]) {
      const [r] = applySpecularHighlight(200, 200, 200, 0.5 + du!, 0.5 + dv!, specular);
      expect(r).toBeGreaterThanOrEqual(200);
    }
  });
});
