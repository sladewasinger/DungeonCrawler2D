/** Pure Node PNG decoder and pixel entropy analyzer for non-blank WebGL canvas verification. */
import { inflateSync } from "node:zlib";

export interface PngEntropyStats {
  readonly width: number;
  readonly height: number;
  readonly meanLuma: number;
  readonly lumaStdDev: number;
  readonly uniqueColors: number;
  readonly nonBlank: boolean;
}

interface PngHeaderState {
  width: number;
  height: number;
  channels: number;
  readonly chunks: Buffer[];
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function applyChunk(kind: string, data: Buffer, state: PngHeaderState): boolean {
  if (kind === "IHDR") {
    state.width = data.readUInt32BE(0);
    state.height = data.readUInt32BE(4);
    state.channels = data[9] === 2 ? 3 : 4;
    return false;
  }
  if (kind === "IDAT") state.chunks.push(data);
  return kind === "IEND";
}

function readPngHeaderAndIdat(buf: Buffer): { readonly width: number; readonly height: number; readonly channels: number; readonly idat: Buffer } {
  if (buf.subarray(0, 8).compare(PNG_SIG) !== 0) throw new Error("Invalid PNG signature");
  const state: PngHeaderState = { width: 0, height: 0, channels: 4, chunks: [] };
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.subarray(off + 4, off + 8).toString("ascii");
    const done = applyChunk(kind, buf.subarray(off + 8, off + 8 + len), state);
    if (done) break;
    off += 12 + len;
  }
  return { width: state.width, height: state.height, channels: state.channels, idat: Buffer.concat(state.chunks) };
}

function unfilterByte(opts: {
  readonly filter: number; readonly val: number; readonly left: number; readonly up: number; readonly upLeft: number;
}): number {
  const { filter, val, left, up, upLeft } = opts;
  if (filter === 0) return val;
  if (filter === 1) return (val + left) & 0xff;
  if (filter === 2) return (val + up) & 0xff;
  if (filter === 3) return (val + ((left + up) >> 1)) & 0xff;
  return (val + paethPredictor(left, up, upLeft)) & 0xff;
}

function readNeighbors(opts: {
  readonly pixels: Uint8Array; readonly dstRow: number; readonly stride: number; readonly bpp: number; readonly x: number; readonly y: number;
}): { readonly left: number; readonly up: number; readonly upLeft: number } {
  const { pixels, dstRow, stride, bpp, x, y } = opts;
  const hasLeft = x >= bpp;
  const hasUp = y > 0;
  return {
    left: hasLeft ? (pixels[dstRow + x - bpp] ?? 0) : 0,
    up: hasUp ? (pixels[dstRow - stride + x] ?? 0) : 0,
    upLeft: hasLeft && hasUp ? (pixels[dstRow - stride + x - bpp] ?? 0) : 0,
  };
}

function decodeRow(opts: {
  readonly raw: Buffer; readonly pixels: Uint8Array; readonly stride: number; readonly bpp: number; readonly y: number;
}): void {
  const { raw, pixels, stride, bpp, y } = opts;
  const srcRow = y * (stride + 1);
  const filter = raw[srcRow] ?? 0;
  const dstRow = y * stride;
  for (let x = 0; x < stride; x++) {
    const nb = readNeighbors({ pixels, dstRow, stride, bpp, x, y });
    pixels[dstRow + x] = unfilterByte({ filter, val: raw[srcRow + 1 + x] ?? 0, ...nb });
  }
}

function decodeScanlines(opts: { readonly raw: Buffer; readonly width: number; readonly height: number; readonly bpp: number }): Uint8Array {
  const stride = opts.width * opts.bpp;
  const pixels = new Uint8Array(opts.height * stride);
  for (let y = 0; y < opts.height; y++) {
    decodeRow({ raw: opts.raw, pixels, stride, bpp: opts.bpp, y });
  }
  return pixels;
}

function sampleEntropyPixels(opts: {
  readonly pixels: Uint8Array; readonly width: number; readonly height: number; readonly channels: number;
}): { readonly lumas: number[]; readonly colors: Set<number> } {
  const stepX = Math.max(1, Math.floor(opts.width / 80));
  const stepY = Math.max(1, Math.floor(opts.height / 80));
  const lumas: number[] = [];
  const colors = new Set<number>();
  for (let y = 0; y < opts.height; y += stepY) {
    for (let x = 0; x < opts.width; x += stepX) {
      const i = (y * opts.width + x) * opts.channels;
      const r = opts.pixels[i] ?? 0;
      const g = opts.pixels[i + 1] ?? 0;
      const b = opts.pixels[i + 2] ?? 0;
      lumas.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
  }
  return { lumas, colors };
}

export function analyzePngEntropy(buf: Buffer): PngEntropyStats {
  const { width, height, channels, idat } = readPngHeaderAndIdat(buf);
  const pixels = decodeScanlines({ raw: inflateSync(idat), width, height, bpp: channels });
  const { lumas, colors } = sampleEntropyPixels({ pixels, width, height, channels });
  const meanLuma = lumas.reduce((s, v) => s + v, 0) / Math.max(1, lumas.length);
  const variance = lumas.reduce((s, v) => s + (v - meanLuma) ** 2, 0) / Math.max(1, lumas.length);
  const lumaStdDev = Math.sqrt(variance);
  return {
    width, height, meanLuma, lumaStdDev, uniqueColors: colors.size,
    nonBlank: lumaStdDev >= 6 && colors.size >= 12,
  };
}
