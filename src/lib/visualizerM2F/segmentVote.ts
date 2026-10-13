// Pure math — no Canvas/DOM, so it runs in the browser and under Vitest.
//
// Snaps the floor mask to edge-accurate, class-agnostic segments (SAM 2). Each segment
// votes as a whole: if it lies almost entirely on the labelled floor it IS floor, gaps
// included; if it lies almost entirely off it, it is not floor, leaks included. Where
// segments nest, the smallest one containing a pixel decides. Pixels no segment covers,
// and segments that straddle the boundary, keep the original labels.

const FLOOR_VOTE       = 0.7;  // share of a segment on the floor mask to claim it all as floor
const NOT_FLOOR_VOTE   = 0.3;  // …or at most this share to clear it all from the floor
const MIN_SEGMENT_FRAC = 1e-4; // segments smaller than this share of the image are ignored
const SMOOTH_PX_FRAC   = 1 / 320; // boundary smoothing radius, fraction of min(W, H)

/**
 * @param surfMask floor mask, >128 = floor
 * @param occMask  occluder (furniture) mask, >128 = occluder
 * @param segments one mask per segment, >128 = inside
 * @returns new 0/255 masks; inputs are not modified
 */
export function refineMasksWithSegments(
  surfMask: Uint8Array, occMask: Uint8Array, segments: Uint8Array[], W: number, H: number,
): { surfMask: Uint8Array; occMask: Uint8Array } {
  const n = W * H;
  const voters: Array<{ seg: Uint8Array; area: number; floor: boolean }> = [];
  for (const seg of segments) {
    let area = 0, onFloor = 0;
    for (let i = 0; i < n; i++) {
      if ((seg[i] ?? 0) > 128) { area++; if ((surfMask[i] ?? 0) > 128) onFloor++; }
    }
    if (area < MIN_SEGMENT_FRAC * n) continue;
    const share = onFloor / area;
    if (share >= FLOOR_VOTE)          voters.push({ seg, area, floor: true });
    else if (share <= NOT_FLOOR_VOTE) voters.push({ seg, area, floor: false });
  }

  const surf = new Uint8Array(n), occ = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    surf[i] = (surfMask[i] ?? 0) > 128 ? 255 : 0;
    occ[i]  = (occMask[i]  ?? 0) > 128 ? 255 : 0;
  }

  // Largest first, so smaller (more specific) segments overwrite.
  voters.sort((a, b) => b.area - a.area);
  for (const { seg, floor } of voters) {
    for (let i = 0; i < n; i++) {
      if ((seg[i] ?? 0) <= 128) continue;
      if (floor) { surf[i] = 255; occ[i] = 0; }
      else       { surf[i] = 0; }
    }
  }
  return { surfMask: smoothBoundary(surf, W, H), occMask: occ };
}

// Segment edges on a glossy floor come out saw-toothed where floor meets its own
// reflection. A local majority vote (box blur, threshold at half) files the teeth off
// without moving a straight edge.
function smoothBoundary(mask: Uint8Array, W: number, H: number): Uint8Array {
  const r = Math.max(1, Math.round(Math.min(W, H) * SMOOTH_PX_FRAC));
  const tmp = new Float32Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const off = y * W;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += mask[off + Math.min(W - 1, Math.max(0, x))]!;
    for (let x = 0; x < W; x++) {
      tmp[off + x] = sum;
      sum += mask[off + Math.min(W - 1, x + r + 1)]! - mask[off + Math.max(0, x - r)]!;
    }
  }
  const half = 255 * (2 * r + 1) * (2 * r + 1) / 2;
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]!;
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum > half ? 255 : 0;
      sum += tmp[Math.min(H - 1, y + r + 1) * W + x]! - tmp[Math.max(0, y - r) * W + x]!;
    }
  }
  return out;
}
