/** Offscreen pixel-art canvas helpers and nearest-neighbor PixiJS texture builders. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import { Texture } from "pixi.js";

export type PixelRect = readonly [x: number, y: number, w: number, h: number, color: string];

export interface OutlineOptions {
  readonly color?: string;
  readonly thickness?: 1;
}

export function createPixelCanvas(
  width: number,
  height: number,
  opts?: { readonly willReadFrequently?: boolean },
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: opts?.willReadFrequently ?? true });
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function drawRects(
  ctx: CanvasRenderingContext2D,
  rects: readonly PixelRect[],
  offset = { x: 0, y: 0 },
): void {
  for (const [x, y, w, h, color] of rects) {
    ctx.fillStyle = color;
    ctx.fillRect(offset.x + x, offset.y + y, w, h);
  }
}

/** Stamps a 1px dark silhouette outline around opaque pixels for crisp pixel-art read. */
export function stampDarkOutline(
  ctx: CanvasRenderingContext2D,
  size: { readonly w: number; readonly h: number },
  color: readonly [number, number, number] = [20, 16, 24],
): void {
  const { w, h } = size;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = new ImageData(new Uint8ClampedArray(src.data), w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      markEdgePixel({ src: src.data, dst: dst.data, x, y, w, h, color });
    }
  }
  ctx.putImageData(dst, 0, 0);
}

function markEdgePixel(input: {
  readonly src: Uint8ClampedArray;
  readonly dst: Uint8ClampedArray;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: readonly [number, number, number];
}): void {
  const idx = (input.y * input.w + input.x) * 4;
  if ((input.src[idx + 3] ?? 0) > 20) return;
  if (!hasOpaqueNeighbor(input)) return;
  input.dst[idx] = input.color[0];
  input.dst[idx + 1] = input.color[1];
  input.dst[idx + 2] = input.color[2];
  input.dst[idx + 3] = 255;
}

function hasOpaqueNeighbor(input: {
  readonly src: Uint8ClampedArray;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}): boolean {
  const { src, x, y, w, h } = input;
  const check = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
    return (src[(ny * w + nx) * 4 + 3] ?? 0) > 20;
  };
  return check(x - 1, y) || check(x + 1, y) || check(x, y - 1) || check(x, y + 1);
}

export function canvasToNearestTexture(canvas: HTMLCanvasElement): Texture {
  const texture = Texture.from({ resource: canvas, scaleMode: "nearest" });
  return texture;
}

export function seededPixelNoise(seed: number, x: number, y: number): number {
  let h = (Math.imul(seed, 374761393) + Math.imul(x, 668265263) + Math.imul(y, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}


export interface PixelEllipseSpec {
  readonly cx: number; readonly cy: number;
  readonly rx: number; readonly ry: number;
  readonly color: string;
}

export function fillEllipsePixel(ctx: CanvasRenderingContext2D, s: PixelEllipseSpec): void {
  ctx.fillStyle = s.color;
  const minY = Math.floor(s.cy - s.ry);
  const maxY = Math.ceil(s.cy + s.ry);
  const ry = Math.max(0.5, s.ry);
  for (let y = minY; y <= maxY; y++) {
    const dy = (y + 0.5 - s.cy) / ry;
    if (Math.abs(dy) >= 1) continue;
    const halfX = Math.max(0, Math.round(s.rx * Math.sqrt(1 - dy * dy)));
    ctx.fillRect(Math.round(s.cx) - halfX, y, halfX * 2 + 1, 1);
  }
}

export function fillCluster(ctx: CanvasRenderingContext2D, blobs: readonly PixelEllipseSpec[]): void {
  for (const blob of blobs) fillEllipsePixel(ctx, blob);
}

function buildOffsetRing(aaRadius: number): readonly (readonly [number, number, number])[] {
  const r = Math.ceil(aaRadius);
  const list: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= aaRadius) list.push([dx, dy, dist]);
    }
  }
  list.sort((a, b) => a[2] - b[2]);
  return list;
}

function toSelOutInk(data: Uint8ClampedArray, idx: number): readonly [number, number, number] {
  return [
    Math.min(255, Math.round(data[idx]! * 0.22 + 5)),
    Math.min(255, Math.round(data[idx + 1]! * 0.20 + 3)),
    Math.min(255, Math.round(data[idx + 2]! * 0.26 + 9)),
  ];
}

function findNearestInk(
  data: Uint8ClampedArray,
  q: { readonly w: number; readonly h: number; readonly x: number; readonly y: number; readonly ring: readonly (readonly [number, number, number])[] },
): { readonly rgb: readonly [number, number, number]; readonly dist: number } | null {
  for (const [dx, dy, dist] of q.ring) {
    const nx = q.x + dx; const ny = q.y + dy;
    const inRange = nx >= 0 && ny >= 0 && nx < q.w && ny < q.h;
    if (!inRange) continue;
    const idx = (ny * q.w + nx) * 4;
    if (data[idx + 3]! >= 128) return { rgb: toSelOutInk(data, idx), dist };
  }
  return null;
}

function paintSelOutPixel(opts: {
  readonly src: Uint8ClampedArray; readonly out: Uint8ClampedArray;
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly ring: readonly (readonly [number, number, number])[];
  readonly overrideRgb?: readonly [number, number, number];
}): void {
  const i = (opts.y * opts.w + opts.x) * 4;
  if (opts.src[i + 3]! >= 128) return;
  const hit = findNearestInk(opts.src, opts);
  if (!hit) return;
  const c = opts.overrideRgb ?? hit.rgb;
  opts.out[i] = c[0]; opts.out[i + 1] = c[1]; opts.out[i + 2] = c[2]; opts.out[i + 3] = 255;
}

export function stampSelOutOutline(
  ctx: CanvasRenderingContext2D,
  opts: {
    readonly w: number; readonly h: number;
    readonly solidPx?: number;
    readonly overrideRgb?: readonly [number, number, number];
  },
): void {
  const rawSolid = opts.solidPx ?? ACTIVE_OUTLINE_STYLE.propSolidPx;
  if (rawSolid <= 0) return;
  const { w, h } = opts;
  const img = ctx.getImageData(0, 0, w, h);
  const out = new Uint8ClampedArray(img.data);
  const solidR = Math.max(0.75, rawSolid);
  const ring = buildOffsetRing(solidR);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      paintSelOutPixel({ src: img.data, out, x, y, w, h, ring, ...(opts.overrideRgb ? { overrideRgb: opts.overrideRgb } : {}) });
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}
