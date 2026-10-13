import { describe, expect, it } from "vitest";

import { refineMasksWithSegments } from "@/lib/visualizerM2F/segmentVote";

const W = 40, H = 40, N = W * H;

function rect(x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(N);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 255;
  return m;
}
const at = (m: Uint8Array, x: number, y: number) => m[y * W + x];

describe("refineMasksWithSegments", () => {
  it("fills a gap the labelled floor missed inside a floor segment", () => {
    const floor = rect(0, 20, 39, 39);
    for (let y = 20; y <= 24; y++) for (let x = 10; x <= 15; x++) floor[y * W + x] = 0; // missed patch
    const { surfMask } = refineMasksWithSegments(floor, new Uint8Array(N), [rect(0, 20, 39, 39)], W, H);
    expect(at(surfMask, 12, 22)).toBe(255);
  });

  it("clears a leak that sits inside a non-floor segment", () => {
    const floor = rect(0, 20, 39, 39);
    for (let y = 14; y <= 19; y++) for (let x = 2; x <= 5; x++) floor[y * W + x] = 255; // leak up a door frame
    const doorFrame = rect(2, 0, 5, 19);
    const { surfMask } = refineMasksWithSegments(floor, new Uint8Array(N), [doorFrame], W, H);
    expect(at(surfMask, 3, 16)).toBe(0);
    expect(at(surfMask, 3, 25)).toBe(255); // floor below it untouched
  });

  it("releases occluder pixels that a floor segment claims", () => {
    const floor = rect(0, 20, 39, 39);
    for (let y = 30; y <= 33; y++) for (let x = 20; x <= 23; x++) floor[y * W + x] = 0;
    const occ = rect(20, 30, 23, 33); // floor between table legs, labelled as table
    const out = refineMasksWithSegments(floor, occ, [rect(0, 20, 39, 39)], W, H);
    expect(at(out.surfMask, 21, 31)).toBe(255);
    expect(at(out.occMask, 21, 31)).toBe(0);
  });

  it("lets a nested smaller segment overrule the larger one", () => {
    const floor = rect(0, 20, 39, 39);
    for (let y = 26; y <= 31; y++) for (let x = 26; x <= 31; x++) floor[y * W + x] = 0; // a pot standing on the floor
    const out = refineMasksWithSegments(floor, new Uint8Array(N), [rect(0, 20, 39, 39), rect(26, 26, 31, 31)], W, H);
    expect(at(out.surfMask, 28, 28)).toBe(0);
    expect(at(out.surfMask, 10, 28)).toBe(255);
  });

  it("leaves labels alone for a segment that straddles the floor boundary", () => {
    const floor = rect(0, 20, 39, 39);
    const out = refineMasksWithSegments(floor, new Uint8Array(N), [rect(0, 10, 39, 29)], W, H); // half on, half off
    expect(at(out.surfMask, 5, 15)).toBe(0);
    expect(at(out.surfMask, 5, 25)).toBe(255);
  });
});

describe("refineMasksWithSegments boundary smoothing", () => {
  it("files a one-pixel tooth off the floor edge and keeps the straight edge where it was", () => {
    const floor = rect(0, 20, 39, 39);
    floor[19 * W + 20] = 255; // a single-pixel spike above the edge
    const { surfMask } = refineMasksWithSegments(floor, new Uint8Array(N), [], W, H);
    expect(at(surfMask, 20, 19)).toBe(0);
    expect(at(surfMask, 20, 20)).toBe(255);
    expect(at(surfMask, 5, 19)).toBe(0);
  });
});
