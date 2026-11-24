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
    skin: toTriadRgb(skin), iris: toTriadRgb(iris),
    hair: toTriadRgb(hair), hairTip: hair.tip ? toTriadRgb(hair.tip) : undefined,
  };
}

function resolveBandChannel(triad: TriadRgbSet, dom: number, ch: 0 | 1 | 2): number {
  if (dom >= 230) return triad.highlight[ch];
  if (dom >= 185) return triad.base[ch];
  if (dom >= 135) return triad.shade[ch];
  return Math.round(triad.shade[ch] * Math.max(0.55, dom / 160));
}

function pickBandRgb(triad: TriadRgbSet, dom: number): RgbTriad {
  return [resolveBandChannel(triad, dom, 0), resolveBandChannel(triad, dom, 1), resolveBandChannel(triad, dom, 2)];
}

function lerpTriad(a: RgbTriad, b: RgbTriad, t: number): RgbTriad {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
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
  const smooth = Math.max(0, Math.min(1, (hairTipFrac - 0.18) / 0.64));
  return lerpTriad(root, pickBandRgb(palettes.hairTip, g), smooth);
}

export function remapSentinelPixel(rgb: RgbTriad, palettes: SentinelPalettes): RgbTriad | null {
  return remapSentinelPixelAt(rgb, palettes, 0);
}

function writeBandInPlace(out: {
  readonly data: Uint8ClampedArray; readonly p: number; readonly triad: TriadRgbSet; readonly dom: number;
}): void {
  const { data, p, triad, dom } = out;
  data[p] = resolveBandChannel(triad, dom, 0);
  data[p + 1] = resolveBandChannel(triad, dom, 1);
  data[p + 2] = resolveBandChannel(triad, dom, 2);
}

function writeHairInPlace(opts: {
  readonly data: Uint8ClampedArray; readonly p: number; readonly g: number;
  readonly palettes: SentinelPalettes; readonly hairT: number;
}): void {
  const { data, p, g, palettes, hairT } = opts;
  const root = palettes.hair;
  const tip = palettes.hairTip;
  if (!tip || hairT <= 0) { writeBandInPlace({ data, p, triad: root, dom: g }); return; }
  const smooth = Math.max(0, Math.min(1, (hairT - 0.18) / 0.64));
  const r0 = resolveBandChannel(root, g, 0);
  const g0 = resolveBandChannel(root, g, 1);
  const b0 = resolveBandChannel(root, g, 2);
  data[p] = Math.round(r0 + (resolveBandChannel(tip, g, 0) - r0) * smooth);
  data[p + 1] = Math.round(g0 + (resolveBandChannel(tip, g, 1) - g0) * smooth);
  data[p + 2] = Math.round(b0 + (resolveBandChannel(tip, g, 2) - b0) * smooth);
}

interface RecolorRowOpts {
  readonly data: Uint8ClampedArray; readonly u32: Uint32Array; readonly rowOff: number;
  readonly x0: number; readonly cellW: number; readonly palettes: SentinelPalettes; readonly hairT: number;
}

function rowHasHair(data: Uint8ClampedArray, u32: Uint32Array, span: { readonly start: number; readonly len: number }): boolean {
  for (let lx = 0; lx < span.len; lx++) {
    const idx = span.start + lx;
    if (u32[idx] === 0) continue;
    const p = idx * 4;
    if (data[p + 3]! > 0 && isHairSentinel(data[p]!, data[p + 1]!, data[p + 2]!)) return true;
  }
  return false;
}

function scanCellHairYSpan(opts: {
  readonly data: Uint8ClampedArray; readonly u32: Uint32Array; readonly sheetW: number;
  readonly x0: number; readonly y0: number; readonly cellW: number; readonly cellH: number;
}): { readonly minY: number; readonly span: number } {
  let minY = opts.cellH;
  let maxY = 0;
  for (let ly = 0; ly < opts.cellH; ly++) {
    const start = (opts.y0 + ly) * opts.sheetW + opts.x0;
    if (!rowHasHair(opts.data, opts.u32, { start, len: opts.cellW })) continue;
    minY = Math.min(minY, ly);
    maxY = Math.max(maxY, ly);
  }
  return { minY, span: Math.max(1, maxY - minY) };
}

function recolorPixelAt(opts: RecolorRowOpts, p: number): void {
  const { data, palettes, hairT } = opts;
  const r = data[p]!; const g = data[p + 1]!; const b = data[p + 2]!;
  if (isSkinSentinel(r, g, b)) { writeBandInPlace({ data, p, triad: palettes.skin, dom: r }); return; }
  if (isIrisSentinel(r, g, b)) { writeBandInPlace({ data, p, triad: palettes.iris, dom: b }); return; }
  if (isHairSentinel(r, g, b)) writeHairInPlace({ data, p, g, palettes, hairT });
}

function recolorRowPixels(opts: RecolorRowOpts): void {
  const { data, u32, rowOff, x0, cellW } = opts;
  for (let lx = 0; lx < cellW; lx++) {
    const idx = rowOff + x0 + lx;
    if (u32[idx] === 0 || data[idx * 4 + 3]! === 0) continue;
    recolorPixelAt(opts, idx * 4);
  }
}

function recolorCell(opts: {
  readonly data: Uint8ClampedArray; readonly u32: Uint32Array; readonly sheetW: number;
  readonly palettes: SentinelPalettes; readonly x0: number; readonly y0: number;
  readonly cellW: number; readonly cellH: number;
}): void {
  const { minY, span } = opts.palettes.hairTip ? scanCellHairYSpan(opts) : { minY: 0, span: 1 };
  for (let ly = 0; ly < opts.cellH; ly++) {
    recolorRowPixels({
      data: opts.data, u32: opts.u32, rowOff: (opts.y0 + ly) * opts.sheetW, x0: opts.x0,
      cellW: opts.cellW, palettes: opts.palettes, hairT: (ly - minY) / span,
    });
  }
}

export interface RecolorCellRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }

function runRecolorPass(opts: {
  readonly data: Uint8ClampedArray; readonly u32: Uint32Array; readonly width: number; readonly height: number;
  readonly palettes: SentinelPalettes; readonly cw: number; readonly ch: number; readonly cells?: readonly RecolorCellRect[] | undefined;
}): void {
  const { data, u32, width, height, palettes, cw, ch, cells } = opts;
  if (cells) {
    for (const c of cells) recolorCell({ data, u32, sheetW: width, palettes, x0: c.x, y0: c.y, cellW: c.w, cellH: c.h });
    return;
  }
  for (let y0 = 0; y0 < height; y0 += ch) {
    const cellH = Math.min(ch, height - y0);
    for (let x0 = 0; x0 < width; x0 += cw) recolorCell({ data, u32, sheetW: width, palettes, x0, y0, cellW: Math.min(cw, width - x0), cellH });
  }
}

export function applyRecolorPass(opts: {
  readonly data: Uint8ClampedArray; readonly width: number; readonly height: number;
  readonly palettes: SentinelPalettes; readonly cellW?: number | undefined; readonly cellH?: number | undefined;
  readonly cells?: readonly RecolorCellRect[] | undefined;
}): void {
  const { data, width, height, palettes, cells } = opts;
  const cw = opts.cellW ?? width;
  const ch = opts.cellH ?? height;
  if ((data.byteOffset & 3) === 0 && data.byteLength >= width * height * 4) {
    runRecolorPass({ data, u32: new Uint32Array(data.buffer, data.byteOffset, width * height), width, height, palettes, cw, ch, cells });
    return;
  }
  const aligned = new Uint8ClampedArray(data);
  runRecolorPass({ data: aligned, u32: new Uint32Array(aligned.buffer), width, height, palettes, cw, ch, cells });
  data.set(aligned);
}

export function computeSelOutRgb(r: number, g: number, b: number): RgbTriad {
  return [Math.max(10, Math.round(r * 0.22 + 5)), Math.max(9, Math.round(g * 0.20 + 3)), Math.max(15, Math.round(b * 0.26 + 9))];
}

interface FlatDiskOffsets {
  readonly dx: Int8Array; readonly dy: Int8Array; readonly dSq: Uint16Array; readonly len: number;
}

const DISK_OFFSET_CACHE = new Map<number, FlatDiskOffsets>();

function pushDiskRow(ctx: { readonly dy: number; readonly r: number; readonly maxSq: number; readonly out: [number, number, number][] }): void {
  for (let dx = -ctx.r; dx <= ctx.r; dx++) {
    const dSq = dx * dx + ctx.dy * ctx.dy;
    if (dSq > 0 && dSq <= ctx.maxSq) ctx.out.push([dx, ctx.dy, dSq]);
  }
}

function getDiskOffsets(solidRadiusPx: number): FlatDiskOffsets {
  const radius = Math.max(0.75, solidRadiusPx);
  const key = Math.round(radius * 100);
  const cached = DISK_OFFSET_CACHE.get(key);
  if (cached) return cached;
  const r = Math.ceil(radius);
  const out: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) pushDiskRow({ dy, r, maxSq: radius * radius, out });
  out.sort((a, b) => a[2] - b[2]);
  const built: FlatDiskOffsets = {
    dx: Int8Array.from(out, (e) => e[0]), dy: Int8Array.from(out, (e) => e[1]),
    dSq: Uint16Array.from(out, (e) => e[2]), len: out.length,
  };
  DISK_OFFSET_CACHE.set(key, built);
  return built;
}

interface SelOutState {
  readonly src: Uint8ClampedArray; readonly srcU32: Uint32Array; readonly data: Uint8ClampedArray;
  readonly bestDistSq: Uint8Array; readonly w: number; readonly h: number; readonly offsets: FlatDiskOffsets;
  edgeR: number; edgeG: number; edgeB: number;
}

function hasHoleCardinal(src: Uint8ClampedArray, rowIdx: number, w: number): boolean {
  if (src[(rowIdx - 1) * 4 + 3]! === 0 || src[(rowIdx + 1) * 4 + 3]! === 0) return true;
  return src[(rowIdx - w) * 4 + 3]! === 0 || src[(rowIdx + w) * 4 + 3]! === 0;
}

function isSilhouetteEdge(st: SelOutState, x: number, y: number): boolean {
  if (x === 0 || y === 0 || x === st.w - 1 || y === st.h - 1) return true;
  return hasHoleCardinal(st.src, y * st.w + x, st.w);
}

function tryLoadEdgeInk(st: SelOutState, x: number, y: number): boolean {
  const rowIdx = y * st.w + x;
  if (st.srcU32[rowIdx] === 0) return false;
  const p = rowIdx * 4;
  if (st.src[p + 3]! === 0 || !isSilhouetteEdge(st, x, y)) return false;
  st.edgeR = Math.max(10, Math.round(st.src[p]! * 0.22 + 5));
  st.edgeG = Math.max(9, Math.round(st.src[p + 1]! * 0.20 + 3));
  st.edgeB = Math.max(15, Math.round(st.src[p + 2]! * 0.26 + 9));
  return true;
}

function splatDisk(st: SelOutState, x: number, y: number): void {
  const { dx, dy, dSq, len } = st.offsets;
  for (let k = 0; k < len; k++) {
    const nx = x + dx[k]!; const ny = y + dy[k]!;
    if (nx < 0 || ny < 0 || nx >= st.w || ny >= st.h) continue;
    const ni = ny * st.w + nx;
    const dist = dSq[k]!;
    if (st.src[ni * 4 + 3]! > 0 || dist >= st.bestDistSq[ni]!) continue;
    st.bestDistSq[ni] = dist;
    const p = ni * 4;
    st.data[p] = st.edgeR; st.data[p + 1] = st.edgeG; st.data[p + 2] = st.edgeB; st.data[p + 3] = 255;
  }
}

export function applyUnifiedSelOut(opts: {
  readonly data: Uint8ClampedArray; readonly width: number; readonly height: number;
  readonly solidRadiusPx?: number | undefined;
}): void {
  const { data, width: w, height: h } = opts;
  const src = new Uint8ClampedArray(data);
  const st: SelOutState = {
    src, srcU32: new Uint32Array(src.buffer), data, bestDistSq: new Uint8Array(w * h).fill(255),
    w, h, offsets: getDiskOffsets(opts.solidRadiusPx ?? ACTIVE_OUTLINE_STYLE.actorSolidPx), edgeR: 0, edgeG: 0, edgeB: 0,
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tryLoadEdgeInk(st, x, y)) splatDisk(st, x, y);
    }
  }
}
