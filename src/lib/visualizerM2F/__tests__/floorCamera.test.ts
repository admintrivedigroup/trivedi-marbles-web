import { describe, expect, it } from "vitest";

import { estimateFloorHomography } from "@/lib/visualizerM2F/floorCamera";

const W = 640, H = 480;
const CX = W / 2, CY = H / 2;

// Synthetic room: a level camera pitched down, looking at a tiled floor. Tile joints are
// dark lines on a light floor; everything above the horizon is flat grey.
function renderTiledFloor(f: number, pitchDeg: number, yawDeg = 0) {
  const pitch = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
  const down  = [0, Math.cos(pitch), Math.sin(pitch)];
  const fwd   = [0, -Math.sin(pitch), Math.cos(pitch)];
  const right = [1, 0, 0];
  const px   = new Uint8ClampedArray(W * H * 4);
  const mask = new Uint8Array(W * H);
  const uv   = new Float32Array(W * H * 2);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d  = [(x - CX) / f, (y - CY) / f, 1];
      const dn = d[0]! * down[0]! + d[1]! * down[1]! + d[2]! * down[2]!;
      const i  = y * W + x;
      let shade = 128;
      if (dn > 0.05) {
        const a0 = (d[0]! * right[0]! + d[1]! * right[1]! + d[2]! * right[2]!) / dn;
        const b0 = (d[0]! * fwd[0]!   + d[1]! * fwd[1]!   + d[2]! * fwd[2]!)   / dn;
        const a  = Math.cos(yaw) * a0 - Math.sin(yaw) * b0;
        const b  = Math.sin(yaw) * a0 + Math.cos(yaw) * b0;
        uv[i * 2] = a; uv[i * 2 + 1] = b;
        mask[i] = 255;
        const fa = Math.abs(a - Math.round(a)), fb = Math.abs(b - Math.round(b));
        shade = Math.min(fa, fb) < 0.03 ? 30 : 220;
      }
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = shade;
      px[i * 4 + 3] = 255;
    }
  }
  return { px, mask, uv };
}

function applyH(h: number[], x: number, y: number) {
  const w = h[6]! * x + h[7]! * y + 1;
  return { u: (h[0]! * x + h[1]! * y + h[2]!) / w, v: (h[3]! * x + h[4]! * y + h[5]!) / w };
}

describe("estimateFloorHomography", () => {
  it("finds the central vanishing point of a one-point-perspective floor", () => {
    const f = 500, pitch = 15;
    const { px, mask } = renderTiledFloor(f, pitch);
    const r = estimateFloorHomography(px, mask, W, H);

    expect(r?.source).toBe("vanishing-points");
    const horizonY = CY - f * Math.tan((pitch * Math.PI) / 180);
    const vp = r!.vanishingPoints.find((p) => Math.abs(p.x - CX) < W);
    expect(vp).toBeDefined();
    expect(Math.abs(vp!.x - CX)).toBeLessThan(8);
    expect(Math.abs(vp!.y - horizonY)).toBeLessThan(8);
  });

  it("maps floor rows to constant V and floor columns to constant U", () => {
    const { px, mask, uv } = renderTiledFloor(500, 15);
    const { h } = estimateFloorHomography(px, mask, W, H)!;

    // Two pixels on the same floor row (same depth b) must share V; same column (same a) must share U.
    const at = (x: number, y: number) => ({ ...applyH(h, x, y), a: uv[(y * W + x) * 2]!, b: uv[(y * W + x) * 2 + 1]! });
    const p = at(200, 400), q = at(440, 400);
    expect(Math.abs(p.b - q.b)).toBeLessThan(1e-3);
    expect(Math.abs(p.v - q.v)).toBeLessThan(0.02);
    expect(q.u).toBeGreaterThan(p.u);

    // Farther from the camera = smaller V.
    expect(at(320, 300).v).toBeLessThan(at(320, 450).v);
  });

  it("is not skewed by a floor mask that is only a sliver at the top", () => {
    const { px, mask } = renderTiledFloor(500, 15);
    const full = estimateFloorHomography(px, mask, W, H)!;

    // Hide the upper floor except a thin strip on the left — the shape that broke the old mask-outline quad.
    const clipped = mask.slice();
    for (let y = 0; y < 330; y++) for (let x = 60; x < W; x++) clipped[y * W + x] = 0;
    const sliver = estimateFloorHomography(px, clipped, W, H)!;

    // Same camera ⇒ lines of constant U still converge on the same vanishing point.
    expect(sliver.vanishingPoints[0]!.x).toBeCloseTo(full.vanishingPoints[0]!.x, 3);
    const a = applyH(sliver.h, 200, 400), b = applyH(sliver.h, 440, 400);
    expect(Math.abs(a.v - b.v)).toBeLessThan(0.02);
  });

  it("falls back to a level camera when the photo has no straight lines", () => {
    const px = new Uint8ClampedArray(W * H * 4).fill(128);
    const mask = new Uint8Array(W * H);
    for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = 255;
    const r = estimateFloorHomography(px, mask, W, H);

    expect(r?.source).toBe("fallback");
    const a = applyH(r!.h, 100, 400), b = applyH(r!.h, 500, 400);
    expect(Math.abs(a.v - b.v)).toBeLessThan(1e-6);
    expect(b.u).toBeGreaterThan(a.u);
  });
});

describe("estimateFloorHomography with furniture", () => {
  it("ignores lines that lie on an occluder", () => {
    const { px, mask } = renderTiledFloor(500, 15);
    const clean = estimateFloorHomography(px, mask, W, H)!;

    // A rotated "rug" of strong parallel stripes on the floor, marked as furniture.
    const occ = new Uint8Array(W * H);
    for (let y = 300; y < 460; y++) {
      for (let x = 150; x < 500; x++) {
        const i = y * W + x;
        occ[i] = 255;
        const stripe = Math.floor((x * 0.5 + y * 0.87) / 6) % 2 === 0 ? 20 : 240;
        px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = stripe;
      }
    }
    const withOcc = estimateFloorHomography(px, mask, W, H, occ)!;
    expect(withOcc.source).toBe("vanishing-points");
    const near = (p: { x: number; y: number }) => Math.abs(p.x - CX) < W;
    const a = clean.vanishingPoints.find(near)!, b = withOcc.vanishingPoints.find(near)!;
    expect(Math.abs(a.x - b.x)).toBeLessThan(10);
    expect(Math.abs(a.y - b.y)).toBeLessThan(10);
  });
});
