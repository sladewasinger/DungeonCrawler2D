/** Luminance-preserving 3D armor layer primary/trim recoloring for frontier armor variants. */
import { createPixelCanvas } from "../../textures/pixelCanvas.js";
import type { AtlasFrameSlot } from "./playerAtlasPacker.js";

export interface StyledLayerEntry {
  readonly id: string;
  readonly recolorPrimary?: string | undefined;
  readonly recolorTrim?: string | undefined;
}

type Rgb3 = readonly [number, number, number];

function parseHex(hex: string): Rgb3 {
  const c = hex.startsWith("#") ? hex.slice(1) : hex;
  return [Number.parseInt(c.slice(0, 2), 16), Number.parseInt(c.slice(2, 4), 16), Number.parseInt(c.slice(4, 6), 16)];
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function isTrimPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const sat = max - Math.min(r, g, b);
  return (sat < 22 && max >= 95) || (r > 180 && g > 140 && b < 110);
}

function recolorPixel(opts: { readonly data: Uint8ClampedArray; readonly p: number; readonly pri: Rgb3; readonly trim: Rgb3 | null }): void {
  const { data, p, pri, trim } = opts;
  const r = data[p]!; const g = data[p + 1]!; const b = data[p + 2]!;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const useTrim = trim !== null && isTrimPixel(r, g, b);
  const palette = useTrim ? trim : pri;
  const scale = Math.max(0.45, Math.min(1.42, lum / (useTrim ? 155 : 112)));
  data[p] = clamp255(palette[0] * scale);
  data[p + 1] = clamp255(palette[1] * scale);
  data[p + 2] = clamp255(palette[2] * scale);
}

function recolorArmorImageData(data: Uint8ClampedArray, primaryHex: string, trimHex?: string): void {
  const pri = parseHex(primaryHex);
  const trim = trimHex ? parseHex(trimHex) : null;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3]! !== 0) recolorPixel({ data, p, pri, trim });
  }
}

export function drawRecoloredSlots(opts: {
  readonly ctx: CanvasRenderingContext2D;
  readonly source: CanvasImageSource;
  readonly slots: readonly AtlasFrameSlot[];
  readonly recolorPrimary?: string | undefined;
  readonly recolorTrim?: string | undefined;
}): void {
  if (!opts.recolorPrimary) {
    for (const s of opts.slots) opts.ctx.drawImage(opts.source, s.srcX, s.srcY, s.w, s.h, s.dstX, s.dstY, s.w, s.h);
    return;
  }
  let maxW = 1; let maxH = 1;
  for (const s of opts.slots) { maxW = Math.max(maxW, s.w); maxH = Math.max(maxH, s.h); }
  const scratch = createPixelCanvas(maxW, maxH);
  for (const s of opts.slots) {
    scratch.ctx.clearRect(0, 0, s.w, s.h);
    scratch.ctx.drawImage(opts.source, s.srcX, s.srcY, s.w, s.h, 0, 0, s.w, s.h);
    const img = scratch.ctx.getImageData(0, 0, s.w, s.h);
    recolorArmorImageData(img.data, opts.recolorPrimary, opts.recolorTrim);
    scratch.ctx.putImageData(img, 0, 0);
    opts.ctx.drawImage(scratch.canvas, 0, 0, s.w, s.h, s.dstX, s.dstY, s.w, s.h);
  }
}

export function drawRecoloredCell(opts: {
  readonly ctx: CanvasRenderingContext2D;
  readonly source: CanvasImageSource;
  readonly sx: number; readonly sy: number;
  readonly w: number; readonly h: number;
  readonly recolorPrimary?: string | undefined;
  readonly recolorTrim?: string | undefined;
}): void {
  if (!opts.recolorPrimary) {
    opts.ctx.drawImage(opts.source, opts.sx, opts.sy, opts.w, opts.h, 0, 0, opts.w, opts.h);
    return;
  }
  const scratch = createPixelCanvas(opts.w, opts.h);
  scratch.ctx.drawImage(opts.source, opts.sx, opts.sy, opts.w, opts.h, 0, 0, opts.w, opts.h);
  const img = scratch.ctx.getImageData(0, 0, opts.w, opts.h);
  recolorArmorImageData(img.data, opts.recolorPrimary, opts.recolorTrim);
  scratch.ctx.putImageData(img, 0, 0);
  opts.ctx.drawImage(scratch.canvas, 0, 0);
}