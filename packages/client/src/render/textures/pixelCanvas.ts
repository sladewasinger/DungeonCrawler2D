/** Offscreen pixel-art canvas helpers and nearest-neighbor PixiJS texture builders. */
import { Texture } from "pixi.js";

export type PixelRect = readonly [x: number, y: number, w: number, h: number, color: string];

export interface OutlineOptions {
  readonly color?: string;
  readonly thickness?: 1;
}

export function createPixelCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
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
