/** Pure Sentinel-palette recoloring (with two-tone hair gradients) and 4px Borderlands sel-out outlining. */
import { EYE_PALETTES, HAIR_PALETTES, SKIN_PALETTES, type HairPalette, type ToneTriad } from "@dc2d/content";
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

function buildDiskOffsets(radiusPx: number): readonly (readonly [number, number])[] {
  const r = Math.max(1, Math.round(radiusPx));
  const out: [number, number][] = [];
  const rSq = (r + 0.22) * (r + 0.22);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if ((dx !== 0 || dy !== 0) && dx * dx + dy * dy <= rSq) out.push([dx, dy]);
    }
  }
  return out;
}

const DISK_4PX_OFFSETS = buildDiskOffsets(4);

function readOpaqueAt(src: Uint8ClampedArray, w: number, coord: { readonly x: number; readonly y: number }): RgbTriad | null {
  const p = (coord.y * w + coord.x) * 4;
  if ((src[p + 3] ?? 0) === 0) return null;
  return [src[p] ?? 0, src[p + 1] ?? 0, src[p + 2] ?? 0];
}

function darkestNeighbor(src: Uint8ClampedArray, idx: number, ctx: { readonly w: number; readonly h: number }): RgbTriad | null {
  const x = idx % ctx.w;
  const y = (idx - x) / ctx.w;
  let best: RgbTriad | null = null;
  let bestLuma = Infinity;
  for (const [dx, dy] of DISK_4PX_OFFSETS) {
    const nx = x + dx; const ny = y + dy;
    if (nx < 0 || nx >= ctx.w || ny < 0 || ny >= ctx.h) continue;
    const rgb = readOpaqueAt(src, ctx.w, { x: nx, y: ny });
    if (!rgb) continue;
    const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    if (luma < bestLuma) { bestLuma = luma; best = rgb; }
  }
  return best;
}

export function applyUnifiedSelOut(data: Uint8ClampedArray, w: number, h: number): void {
  const src = new Uint8ClampedArray(data);
  const total = w * h;
  for (let i = 0; i < total; i++) {
    if ((src[i * 4 + 3] ?? 0) > 0) continue;
    const n = darkestNeighbor(src, i, { w, h });
    if (!n) continue;
    const edge = computeSelOutRgb(n[0], n[1], n[2]);
    const p = i * 4;
    data[p] = edge[0]; data[p + 1] = edge[1]; data[p + 2] = edge[2]; data[p + 3] = 255;
  }
}
