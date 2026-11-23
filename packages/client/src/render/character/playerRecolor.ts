/** Pure Sentinel-palette recoloring (with two-tone hair gradients) and crisp solid Borderlands sel-out outlining. */
import { ACTIVE_OUTLINE_STYLE, EYE_PALETTES, HAIR_PALETTES, SKIN_PALETTES, type HairPalette, type ToneTriad } from "@dc2d/content";
import type { CharacterAppearance } from "@dc2d/engine";

export type RgbTriad = readonly [number, number, number];
export interface TriadRgbSet { readonly base: RgbTriad; readonly shade: RgbTriad; readonly highlight: RgbTriad; }
export interface SentinelPalettes {
  readonly skin: TriadRgbSet;
  readonly iris: TriadRgbSet;
  readonly hair: TriadRgbSet;
  readonly hairTip?: TriadRgbSet | undefined;
}

function hexToRgb(hex: string): RgbTriad {
  const c = hex.startsWith("#") ? hex.slice(1) : hex;
  return [Number.parseInt(c.slice(0, 2), 16), Number.parseInt(c.slice(2, 4), 16), Number.parseInt(c.slice(4, 6), 16)];
}

export function toTriadRgb(triad: ToneTriad): TriadRgbSet {
  return { base: hexToRgb(triad.base), shade: hexToRgb(triad.shade), highlight: hexToRgb(triad.highlight) };
}

export function resolveSentinelPalettes(appearance: CharacterAppearance): SentinelPalettes {
  const skin = SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!;
  const iris = EYE_PALETTES[appearance.eyeColor] ?? EYE_PALETTES.brown!;
  const hair: HairPalette = HAIR_PALETTES[appearance.hairColor] ?? HAIR_PALETTES.brown!;
  return {
    skin: toTriadRgb(skin),
    iris: toTriadRgb(iris),
    hair: toTriadRgb(hair),
    hairTip: hair.tip ? toTriadRgb(hair.tip) : undefined,
  };
}

function pickBandRgb(triad: TriadRgbSet, dom: number): RgbTriad {
  if (dom >= 230) return triad.highlight;
  if (dom >= 185) return triad.base;
  if (dom >= 135) return triad.shade;
  const k = Math.max(0.55, dom / 160);
  return [Math.round(triad.shade[0] * k), Math.round(triad.shade[1] * k), Math.round(triad.shade[2] * k)];
}

function lerpTriad(a: RgbTriad, b: RgbTriad, t: number): RgbTriad {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const isSkinSentinel = (r: number, g: number, b: number): boolean => r >= 45 && b >= 20 && r - g >= 35 && b - g >= 20;
const isIrisSentinel = (r: number, g: number, b: number): boolean => b >= 65 && g >= 45 && b - r >= 40 && g - r >= 35;
const isHairSentinel = (r: number, g: number, b: number): boolean => g >= 55 && g - b >= 45 && g - r >= 25;

export function remapSentinelPixelAt(rgb: RgbTriad, palettes: SentinelPalettes, hairTipFrac = 0): RgbTriad | null {
  const [r, g, b] = rgb;
  if (isSkinSentinel(r, g, b)) return pickBandRgb(palettes.skin, r);
  if (isIrisSentinel(r, g, b)) return pickBandRgb(palettes.iris, b);
  if (!isHairSentinel(r, g, b)) return null;
  const root = pickBandRgb(palettes.hair, g);
  if (!palettes.hairTip || hairTipFrac <= 0) return root;
  const tip = pickBandRgb(palettes.hairTip, g);
  const smooth = Math.max(0, Math.min(1, (hairTipFrac - 0.18) / 0.64));
  return lerpTriad(root, tip, smooth);
}

export function remapSentinelPixel(rgb: RgbTriad, palettes: SentinelPalettes): RgbTriad | null {
  return remapSentinelPixelAt(rgb, palettes, 0);
}

function isOpaqueHairAt(data: Uint8ClampedArray, p: number): boolean {
  if ((data[p + 3] ?? 0) === 0) return false;
  return isHairSentinel(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0);
}

function rowHasHair(opts: {
  readonly data: Uint8ClampedArray; readonly rowOff: number; readonly x0: number; readonly cellW: number;
}): boolean {
  for (let lx = 0; lx < opts.cellW; lx++) {
    if (isOpaqueHairAt(opts.data, (opts.rowOff + opts.x0 + lx) * 4)) return true;
  }
  return false;
}

function scanCellHairYSpan(opts: {
  readonly data: Uint8ClampedArray; readonly sheetW: number;
  readonly x0: number; readonly y0: number; readonly cellW: number; readonly cellH: number;
}): { readonly minY: number; readonly span: number } {
  let minY = opts.cellH;
  let maxY = 0;
  for (let ly = 0; ly < opts.cellH; ly++) {
    if (!rowHasHair({ data: opts.data, rowOff: (opts.y0 + ly) * opts.sheetW, x0: opts.x0, cellW: opts.cellW })) continue;
    minY = Math.min(minY, ly);
    maxY = Math.max(maxY, ly);
  }
  return { minY, span: Math.max(1, maxY - minY) };
}

function recolorRowPixels(opts: {
  readonly data: Uint8ClampedArray; readonly rowOff: number; readonly x0: number;
  readonly cellW: number; readonly palettes: SentinelPalettes; readonly hairT: number;
}): void {
  for (let lx = 0; lx < opts.cellW; lx++) {
    const p = (opts.rowOff + opts.x0 + lx) * 4;
    if ((opts.data[p + 3] ?? 0) === 0) continue;
    const mapped = remapSentinelPixelAt([opts.data[p] ?? 0, opts.data[p + 1] ?? 0, opts.data[p + 2] ?? 0], opts.palettes, opts.hairT);
    if (!mapped) continue;
    opts.data[p] = mapped[0]; opts.data[p + 1] = mapped[1]; opts.data[p + 2] = mapped[2];
  }
}

function recolorCell(opts: {
  readonly data: Uint8ClampedArray; readonly sheetW: number; readonly palettes: SentinelPalettes;
  readonly x0: number; readonly y0: number; readonly cellW: number; readonly cellH: number;
}): void {
  const { minY, span } = opts.palettes.hairTip ? scanCellHairYSpan(opts) : { minY: 0, span: 1 };
  for (let ly = 0; ly < opts.cellH; ly++) {
    recolorRowPixels({
      data: opts.data, rowOff: (opts.y0 + ly) * opts.sheetW, x0: opts.x0,
      cellW: opts.cellW, palettes: opts.palettes, hairT: (ly - minY) / span,
    });
  }
}

export function applyRecolorPass(opts: {
  readonly data: Uint8ClampedArray; readonly width: number; readonly height: number;
  readonly palettes: SentinelPalettes; readonly cellW?: number | undefined; readonly cellH?: number | undefined;
}): void {
  const cw = opts.cellW ?? opts.width;
  const ch = opts.cellH ?? opts.height;
  for (let y0 = 0; y0 < opts.height; y0 += ch) {
    for (let x0 = 0; x0 < opts.width; x0 += cw) {
      recolorCell({ data: opts.data, sheetW: opts.width, palettes: opts.palettes, x0, y0, cellW: Math.min(cw, opts.width - x0), cellH: Math.min(ch, opts.height - y0) });
    }
  }
}

export function computeSelOutRgb(r: number, g: number, b: number): RgbTriad {
  return [Math.max(10, Math.round(r * 0.22 + 5)), Math.max(9, Math.round(g * 0.20 + 3)), Math.max(15, Math.round(b * 0.26 + 9))];
}

const DISK_OFFSET_CACHE = new Map<number, readonly (readonly [number, number, number])[]>();

function pushDiskRow(ctx: {
  readonly dy: number; readonly r: number; readonly maxSq: number; readonly out: [number, number, number][];
}): void {
  for (let dx = -ctx.r; dx <= ctx.r; dx++) {
    const dSq = dx * dx + ctx.dy * ctx.dy;
    if (dSq > 0 && dSq <= ctx.maxSq) ctx.out.push([dx, ctx.dy, dSq]);
  }
}

function getDiskOffsets(solidRadiusPx: number): readonly (readonly [number, number, number])[] {
  const radius = Math.max(0.75, solidRadiusPx);
  const key = Math.round(radius * 100);
  const cached = DISK_OFFSET_CACHE.get(key);
  if (cached) return cached;
  const r = Math.ceil(radius);
  const maxSq = radius * radius;
  const out: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) pushDiskRow({ dy, r, maxSq, out });
  out.sort((a, b) => a[2] - b[2]);
  DISK_OFFSET_CACHE.set(key, out);
  return out;
}

function hasHoleCardinal(src: Uint8ClampedArray, rowIdx: number, w: number): boolean {
  if (src[(rowIdx - 1) * 4 + 3]! === 0 || src[(rowIdx + 1) * 4 + 3]! === 0) return true;
  return src[(rowIdx - w) * 4 + 3]! === 0 || src[(rowIdx + w) * 4 + 3]! === 0;
}

function isSilhouetteEdge(
  src: Uint8ClampedArray,
  pt: { readonly w: number; readonly h: number; readonly x: number; readonly y: number },
): boolean {
  const { w, h, x, y } = pt;
  if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return true;
  return hasHoleCardinal(src, y * w + x, w);
}

function tryWriteEdge(ctx: {
  readonly src: Uint8ClampedArray; readonly data: Uint8ClampedArray; readonly bestDistSq: Uint8Array;
  readonly ni: number; readonly dSq: number; readonly edgeRgb: RgbTriad;
}): void {
  if (ctx.src[ctx.ni * 4 + 3]! > 0 || ctx.dSq >= ctx.bestDistSq[ctx.ni]!) return;
  ctx.bestDistSq[ctx.ni] = ctx.dSq;
  const p = ctx.ni * 4;
  ctx.data[p] = ctx.edgeRgb[0]; ctx.data[p + 1] = ctx.edgeRgb[1]; ctx.data[p + 2] = ctx.edgeRgb[2]; ctx.data[p + 3] = 255;
}

function splatDisk(ctx: {
  readonly src: Uint8ClampedArray; readonly data: Uint8ClampedArray; readonly bestDistSq: Uint8Array;
  readonly w: number; readonly h: number; readonly x: number; readonly y: number;
  readonly offsets: readonly (readonly [number, number, number])[]; readonly edgeRgb: RgbTriad;
}): void {
  for (const [dx, dy, dSq] of ctx.offsets) {
    const nx = ctx.x + dx;
    const ny = ctx.y + dy;
    const inBounds = nx >= 0 && ny >= 0 && nx < ctx.w && ny < ctx.h;
    if (inBounds) tryWriteEdge({ src: ctx.src, data: ctx.data, bestDistSq: ctx.bestDistSq, ni: ny * ctx.w + nx, dSq, edgeRgb: ctx.edgeRgb });
  }
}

function processRowEdges(ctx: {
  readonly src: Uint8ClampedArray; readonly data: Uint8ClampedArray; readonly bestDistSq: Uint8Array;
  readonly w: number; readonly h: number; readonly y: number;
  readonly offsets: readonly (readonly [number, number, number])[];
}): void {
  for (let x = 0; x < ctx.w; x++) {
    const p = (ctx.y * ctx.w + x) * 4;
    if (ctx.src[p + 3]! === 0 || !isSilhouetteEdge(ctx.src, { w: ctx.w, h: ctx.h, x, y: ctx.y })) continue;
    const edgeRgb = computeSelOutRgb(ctx.src[p]!, ctx.src[p + 1]!, ctx.src[p + 2]!);
    splatDisk({ src: ctx.src, data: ctx.data, bestDistSq: ctx.bestDistSq, w: ctx.w, h: ctx.h, x, y: ctx.y, offsets: ctx.offsets, edgeRgb });
  }
}

export function applyUnifiedSelOut(opts: {
  readonly data: Uint8ClampedArray; readonly width: number; readonly height: number;
  readonly solidRadiusPx?: number | undefined;
}): void {
  const { data, width: w, height: h } = opts;
  const src = new Uint8ClampedArray(data);
  const bestDistSq = new Uint8Array(w * h).fill(255);
  const offsets = getDiskOffsets(opts.solidRadiusPx ?? ACTIVE_OUTLINE_STYLE.actorSolidPx);
  for (let y = 0; y < h; y++) processRowEdges({ src, data, bestDistSq, w, h, y, offsets });
}
