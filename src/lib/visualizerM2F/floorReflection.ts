// Pure math — no Canvas/DOM, so it runs in the browser and under Vitest.
//
// A re-textured floor looks flat because the photo's own reflections are thrown away with
// the old floor. This rebuilds them from the photo: a mirror image of whatever stands on
// the floor, flipped about its contact line, for a polished-stone look.

const REFLECTION_FADE_FRAC = 0.22;  // reflection strength falls to 1/e this far (× H) below the contact line
const REFLECTION_BLUR_FRAC = 1 / 220; // softening radius, fraction of min(W, H)
const MIN_CONTACT_RUN      = 4;     // non-floor rows needed to count as an object, not a mask speck

export type FloorReflection = {
  /** RGB per pixel (3 values each) — what the floor mirrors at that pixel. */
  rgb:   Uint8ClampedArray;
  /** 0..1 per pixel — how much reflection to show; 0 off the floor or where nothing is mirrored. */
  alpha: Float32Array;
};

function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const off = y * W;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[off + Math.min(W - 1, Math.max(0, x))]!;
    for (let x = 0; x < W; x++) {
      tmp[off + x] = sum * norm;
      sum += src[off + Math.min(W - 1, x + r + 1)]! - src[off + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]!;
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum * norm;
      sum += tmp[Math.min(H - 1, y + r + 1) * W + x]! - tmp[Math.max(0, y - r) * W + x]!;
    }
  }
  return out;
}

/**
 * For a level camera, an upright object's mirror image in the floor is its picture flipped
 * about the line where it meets the floor. So each floor pixel looks straight up its column
 * to the nearest thing standing on the floor and samples the photo the same distance above
 * that contact row. Strength fades with distance and the layer is blurred, which reads as
 * polished stone rather than a mirror and hides per-column contact jitter.
 */
export function computeFloorReflection(
  px: Uint8ClampedArray, surfMask: Uint8Array, W: number, H: number,
): FloorReflection {
  const n = W * H;
  const fade = Math.max(1, REFLECTION_FADE_FRAC * H);
  // Premultiplied channels so the blur doesn't smear colour in from zero-alpha pixels.
  const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n), pa = new Float32Array(n);

  for (let x = 0; x < W; x++) {
    let contact = -1, run = 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if ((surfMask[i] ?? 0) <= 128) { run++; continue; }
      if (run >= MIN_CONTACT_RUN) contact = y - 1;
      run = 0;
      if (contact < 0) continue;

      const d  = y - contact;
      const sy = contact - d + 1;
      if (sy < 0 || (surfMask[sy * W + x] ?? 0) > 128) continue; // off the photo, or more floor behind the object
      const a  = Math.exp(-d / fade);
      const si = (sy * W + x) * 4;
      pr[i] = px[si]! * a; pg[i] = px[si + 1]! * a; pb[i] = px[si + 2]! * a; pa[i] = a;
    }
  }

  const r = Math.max(2, Math.round(Math.min(W, H) * REFLECTION_BLUR_FRAC));
  const br = boxBlur(pr, W, H, r), bg = boxBlur(pg, W, H, r), bb = boxBlur(pb, W, H, r), ba = boxBlur(pa, W, H, r);

  const rgb   = new Uint8ClampedArray(n * 3);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if ((surfMask[i] ?? 0) <= 128 || ba[i]! < 1e-3) continue;
    rgb[i * 3]     = br[i]! / ba[i]!;
    rgb[i * 3 + 1] = bg[i]! / ba[i]!;
    rgb[i * 3 + 2] = bb[i]! / ba[i]!;
    alpha[i] = Math.min(1, ba[i]!);
  }
  return { rgb, alpha };
}
