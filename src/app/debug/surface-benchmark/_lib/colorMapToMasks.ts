// Server-side only. Pure Node.js — no canvas, no external image libraries.
// Decodes a color-coded segmentation PNG and extracts per-class binary masks.

import zlib from "zlib";

// ─── CRC32 ────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ (buf[i] as number)) & 0xFF]! ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG chunk writer ─────────────────────────────────────────────────────────

function writeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t   = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// ─── PNG decoder ──────────────────────────────────────────────────────────────

type DecodedImage = {
  width:  number;
  height: number;
  rgba:   Uint8Array; // packed RGBA, width * height * 4 bytes, row-major
};

function byteAt(arr: Uint8Array | Buffer, i: number): number {
  return (i >= 0 && i < arr.length) ? (arr[i] as number) : 0;
}

function decodePng(buf: Buffer): DecodedImage {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (byteAt(buf, i) !== SIG[i]) throw new Error("colorMapToMasks: not a PNG file");
  }

  let off = 8;
  let width = 0, height = 0, colorType = 2, bitDepth = 8;
  const idatChunks: Buffer[] = [];

  while (off + 8 <= buf.length) {
    const chunkLen  = buf.readUInt32BE(off);  off += 4;
    const chunkType = buf.toString("ascii", off, off + 4);  off += 4;
    const chunkData = buf.subarray(off, off + chunkLen);
    off += chunkLen + 4; // data + CRC

    if (chunkType === "IHDR") {
      width     = chunkData.readUInt32BE(0);
      height    = chunkData.readUInt32BE(4);
      bitDepth  = byteAt(chunkData, 8);
      colorType = byteAt(chunkData, 9);
    } else if (chunkType === "IDAT") {
      idatChunks.push(Buffer.from(chunkData));
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (width === 0 || height === 0) throw new Error("colorMapToMasks: invalid PNG dimensions");
  if (bitDepth !== 8) throw new Error(`colorMapToMasks: unsupported bit depth ${bitDepth} (only 8-bit)`);

  // channels per pixel for common color types
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 3;
  const rowBytes = ch * width;

  const raw  = zlib.inflateSync(Buffer.concat(idatChunks));
  const rgba = new Uint8Array(width * height * 4);

  let prevRow = new Uint8Array(rowBytes); // start as zeros (PNG spec requirement)

  for (let y = 0; y < height; y++) {
    const base   = y * (rowBytes + 1); // +1 for filter byte
    const filter = byteAt(raw, base);
    const curr   = new Uint8Array(rowBytes);

    for (let x = 0; x < rowBytes; x++) {
      const rb = byteAt(raw, base + 1 + x);
      const a  = x >= ch ? curr[x - ch]!  : 0;
      const b  = prevRow[x]!;
      const c  = x >= ch ? prevRow[x - ch]! : 0;

      switch (filter) {
        case 0: curr[x] = rb; break;
        case 1: curr[x] = (rb + a) & 0xFF; break;
        case 2: curr[x] = (rb + b) & 0xFF; break;
        case 3: curr[x] = (rb + Math.floor((a + b) / 2)) & 0xFF; break;
        case 4: { // Paeth predictor
          const p  = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          curr[x]  = (rb + pr) & 0xFF;
          break;
        }
        default: curr[x] = rb;
      }
    }

    // Convert to RGBA
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      if (ch === 3) {
        rgba[di]     = curr[x * 3]!;
        rgba[di + 1] = curr[x * 3 + 1]!;
        rgba[di + 2] = curr[x * 3 + 2]!;
        rgba[di + 3] = 255;
      } else if (ch === 4) {
        rgba[di]     = curr[x * 4]!;
        rgba[di + 1] = curr[x * 4 + 1]!;
        rgba[di + 2] = curr[x * 4 + 2]!;
        rgba[di + 3] = curr[x * 4 + 3]!;
      } else {
        // Grayscale → replicate into RGB
        const g = curr[x]!;
        rgba[di] = rgba[di + 1] = rgba[di + 2] = g;
        rgba[di + 3] = 255;
      }
    }

    prevRow = curr;
  }

  return { width, height, rgba };
}

// ─── Grayscale 8-bit PNG encoder ──────────────────────────────────────────────

function encodeMaskPng(width: number, height: number, mask: Uint8Array): Buffer {
  const rowLen = width + 1; // filter byte + pixel bytes
  const raw    = Buffer.alloc(height * rowLen);

  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter = None
    for (let x = 0; x < width; x++) {
      raw[y * rowLen + 1 + x] = mask[y * width + x] ? 255 : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type 0 = grayscale
  // bytes 10–12: compression=0, filter=0, interlace=0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    writeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ColorMapObject = {
  label: string;
  color: [number, number, number]; // [R, G, B]
};

export type ExtractedMask = {
  label:       string;
  maskBase64:  string; // grayscale PNG, base64-encoded
  coveragePct: number; // 0–100
};

export function extractMasksFromColorMap(
  pngBuffer: Buffer,
  objects: ColorMapObject[],
  tolerancePerChannel = 3,
): ExtractedMask[] {
  const img   = decodePng(pngBuffer);
  const total = img.width * img.height;

  return objects.map((obj) => {
    const [tr, tg, tb] = obj.color;
    const mask = new Uint8Array(total);
    let hits = 0;

    for (let i = 0; i < total; i++) {
      const r = img.rgba[i * 4]!;
      const g = img.rgba[i * 4 + 1]!;
      const b = img.rgba[i * 4 + 2]!;
      if (
        Math.abs(r - tr) <= tolerancePerChannel &&
        Math.abs(g - tg) <= tolerancePerChannel &&
        Math.abs(b - tb) <= tolerancePerChannel
      ) {
        mask[i] = 1;
        hits++;
      }
    }

    const coveragePct = Math.round((hits / total) * 1000) / 10;
    const pngBuf = encodeMaskPng(img.width, img.height, mask);

    return {
      label:      obj.label.toLowerCase().trim(),
      maskBase64: pngBuf.toString("base64"),
      coveragePct,
    };
  });
}
