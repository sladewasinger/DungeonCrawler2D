/** Draws crisp 1px dark silhouettes around 4-connected opaque pixels of procedural sprites. */
import type { PixelRect } from "../itemIconShapes.js";

const OUTLINE_RGBA = [20, 16, 24, 255] as const;

export interface OutlinedSpriteDraw {
  readonly ox: number;
  readonly oy: number;
  readonly width: number;
  readonly height: number;
  readonly rects: readonly PixelRect[];
}

export function drawOutlinedPixelRects(
  ctx: CanvasRenderingContext2D,
  input: OutlinedSpriteDraw,
): void {
  const scratch = document.createElement("canvas");
  scratch.width = input.width;
  scratch.height = input.height;
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  paintRects(sctx, input.rects);
  applyDarkOutline(sctx, input.width, input.height);
  ctx.drawImage(scratch, input.ox, input.oy);
}

function paintRects(ctx: CanvasRenderingContext2D, rects: readonly PixelRect[]): void {
  for (const [x, y, w, h, color] of rects) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
}

function applyDarkOutline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const img = ctx.getImageData(0, 0, width, height);
  const src = new Uint8ClampedArray(img.data);
  for (let y = 0; y < height; y++) {
    outlineRow({ src, dest: img.data, width, height, y });
  }
  ctx.putImageData(img, 0, 0);
}

function outlineRow(input: {
  readonly src: Uint8ClampedArray;
  readonly dest: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly y: number;
}): void {
  const { src, dest, width, height, y } = input;
  const grid = { src, width, height };
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    if ((src[offset + 3] ?? 0) > 0) continue;
    if (!hasOpaqueNeighbor(grid, x, y)) continue;
    dest[offset] = OUTLINE_RGBA[0];
    dest[offset + 1] = OUTLINE_RGBA[1];
    dest[offset + 2] = OUTLINE_RGBA[2];
    dest[offset + 3] = OUTLINE_RGBA[3];
  }
}

interface AlphaGrid {
  readonly src: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

function hasOpaqueNeighbor(grid: AlphaGrid, x: number, y: number): boolean {
  return isOpaquePixel(grid, x - 1, y)
    || isOpaquePixel(grid, x + 1, y)
    || isOpaquePixel(grid, x, y - 1)
    || isOpaquePixel(grid, x, y + 1);
}

function isOpaquePixel(grid: AlphaGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  return (grid.src[(y * grid.width + x) * 4 + 3] ?? 0) > 0;
}
