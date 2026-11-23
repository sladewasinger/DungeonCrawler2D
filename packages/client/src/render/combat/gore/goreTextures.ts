/** Supersampled organic contour liquid textures paired with crisp pixel-art solid gore masks. */
import { Texture } from "pixi.js";
import {
  ARC_MASKS, BONE_PILE_MASK, CHUNK_MASKS, DROPLET_MASK, FOOTPRINT_MASKS, GOOP_BLOB_MASKS,
  GOOP_PUDDLE_MASKS, GROUND_CRACK_MASK, POOL_MASKS, RUBBLE_PILE_MASK, SPARK_MASK, SPLATTER_MASKS,
  STREAK_MASKS, WATER_PLUME_MASKS,
} from "./goreArtMasks.js";

export type ChunkKind = "soft" | "bone" | "stone" | "straw";

export interface GoreTextureSet {
  readonly splatters: readonly Texture[];
  readonly arcs: readonly Texture[];
  readonly streaks: readonly Texture[];
  readonly goopBlobs: readonly Texture[];
  readonly goopPuddles: readonly Texture[];
  readonly pools: readonly Texture[];
  readonly chunks: Readonly<Record<ChunkKind, readonly Texture[]>>;
  readonly bonePile: Texture;
  readonly rubblePile: Texture;
  readonly waterPlumes: readonly Texture[];
  readonly footprints: readonly Texture[];
  readonly droplet: Texture;
  readonly spark: Texture;
  readonly crack: Texture;
}

const SUPERSAMPLE = 4;
const LIQUID_PAD = 1;
const KERNEL_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const GLYPH_LUMA: Readonly<Record<string, { readonly cov: number; readonly luma: number; readonly alpha: number }>> = {
  "+": { cov: 0.85, luma: 214, alpha: 235 },
  "o": { cov: 1.0, luma: 232, alpha: 255 },
  "*": { cov: 1.0, luma: 255, alpha: 255 },
  "#": { cov: 1.0, luma: 172, alpha: 255 },
  "1": { cov: 0.28, luma: 255, alpha: 75 },
  "2": { cov: 0.56, luma: 255, alpha: 145 },
  "3": { cov: 0.86, luma: 255, alpha: 215 },
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleCell(mask: readonly string[], ix: number, iy: number): { readonly cov: number; readonly luma: number } {
  const ch = mask[iy]?.[ix];
  return (ch && GLYPH_LUMA[ch]) || { cov: 0, luma: 224 };
}

function sumSmoothKernel(opts: {
  readonly mask: readonly string[]; readonly fx: number; readonly fy: number; readonly invTwoVar: number;
}): { readonly sumCov: number; readonly sumWgt: number; readonly sumLuma: number } {
  const bx = Math.round(opts.fx);
  const by = Math.round(opts.fy);
  let sumCov = 0;
  let sumWgt = 0;
  let sumLuma = 0;
  for (const [ox, oy] of KERNEL_OFFSETS) {
    const nx = bx + ox;
    const ny = by + oy;
    const dx = opts.fx - nx;
    const dy = opts.fy - ny;
    const wgt = Math.exp(-(dx * dx + dy * dy) * opts.invTwoVar);
    const cell = sampleCell(opts.mask, nx, ny);
    sumCov += wgt * cell.cov;
    sumWgt += wgt;
    sumLuma += wgt * cell.cov * cell.luma;
  }
  return { sumCov, sumWgt, sumLuma };
}

function evalSmoothPixel(opts: {
  readonly mask: readonly string[]; readonly fx: number; readonly fy: number; readonly diffuse: boolean;
}): readonly [number, number, number, number] {
  const sigma = opts.diffuse ? 0.72 : 0.48;
  const { sumCov, sumWgt, sumLuma } = sumSmoothKernel({ ...opts, invTwoVar: 1 / (2 * sigma * sigma) });
  const cov = sumWgt > 0 ? sumCov / sumWgt : 0;
  const alphaNorm = opts.diffuse ? Math.min(1, cov * 0.92) : smoothstep(0.28, 0.44, cov);
  if (alphaNorm <= 0.004) return [0, 0, 0, 0];
  const baseLuma = sumCov > 0.001 ? sumLuma / sumCov : 228;
  const meniscus = opts.diffuse ? 1 : 0.88 + 0.12 * smoothstep(0.42, 0.68, cov);
  const lum = Math.min(255, Math.round(baseLuma * meniscus));
  return [lum, lum, lum, Math.round(alphaNorm * 255)];
}

function createCanvas2d(w: number, h: number): { readonly canvas: HTMLCanvasElement; readonly ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
}

function rasterizeLiquidMask(mask: readonly string[], diffuse = false): Texture {
  const w = ((mask[0]?.length ?? 1) + LIQUID_PAD * 2) * SUPERSAMPLE;
  const h = (mask.length + LIQUID_PAD * 2) * SUPERSAMPLE;
  const surf = createCanvas2d(w, h);
  if (!surf) return Texture.WHITE;
  const img = surf.ctx.createImageData(w, h);
  for (let sy = 0; sy < h; sy++) {
    const fy = (sy + 0.5) / SUPERSAMPLE - LIQUID_PAD - 0.5;
    for (let sx = 0; sx < w; sx++) {
      const fx = (sx + 0.5) / SUPERSAMPLE - LIQUID_PAD - 0.5;
      const [r, g, b, a] = evalSmoothPixel({ mask, fx, fy, diffuse });
      const off = (sy * w + sx) * 4;
      img.data[off] = r; img.data[off + 1] = g; img.data[off + 2] = b; img.data[off + 3] = a;
    }
  }
  surf.ctx.putImageData(img, 0, 0);
  return Texture.from({ resource: surf.canvas, resolution: SUPERSAMPLE, scaleMode: "linear" });
}

function writeCrispCell(data: Uint8ClampedArray, row: string, opts: { readonly x: number; readonly y: number; readonly w: number }): void {
  const ch = row[opts.x];
  const glyph = ch ? GLYPH_LUMA[ch] : undefined;
  if (!glyph) return;
  const off = (opts.y * opts.w + opts.x) * 4;
  data[off] = glyph.luma; data[off + 1] = glyph.luma; data[off + 2] = glyph.luma; data[off + 3] = glyph.alpha;
}

function rasterizeCrispMask(mask: readonly string[]): Texture {
  const h = mask.length;
  const w = mask[0]?.length ?? 1;
  const surf = createCanvas2d(w, h);
  if (!surf) return Texture.WHITE;
  const img = surf.ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = mask[y] ?? "";
    for (let x = 0; x < w; x++) writeCrispCell(img.data, row, { x, y, w });
  }
  surf.ctx.putImageData(img, 0, 0);
  return Texture.from({ resource: surf.canvas, resolution: 1, scaleMode: "nearest" });
}

let cachedSet: GoreTextureSet | null = null;

export function getGoreTextures(): GoreTextureSet {
  if (cachedSet) return cachedSet;
  cachedSet = {
    splatters: SPLATTER_MASKS.map((m) => rasterizeLiquidMask(m)),
    arcs: ARC_MASKS.map((m) => rasterizeLiquidMask(m)),
    streaks: STREAK_MASKS.map((m) => rasterizeLiquidMask(m)),
    goopBlobs: GOOP_BLOB_MASKS.map((m) => rasterizeLiquidMask(m)),
    goopPuddles: GOOP_PUDDLE_MASKS.map((m) => rasterizeLiquidMask(m)),
    pools: POOL_MASKS.map((m) => rasterizeLiquidMask(m)),
    chunks: {
      soft: CHUNK_MASKS.soft.map(rasterizeCrispMask),
      bone: CHUNK_MASKS.bone.map(rasterizeCrispMask),
      stone: CHUNK_MASKS.stone.map(rasterizeCrispMask),
      straw: CHUNK_MASKS.straw.map(rasterizeCrispMask),
    },
    bonePile: rasterizeCrispMask(BONE_PILE_MASK),
    rubblePile: rasterizeCrispMask(RUBBLE_PILE_MASK),
    waterPlumes: WATER_PLUME_MASKS.map((m) => rasterizeLiquidMask(m, true)),
    footprints: FOOTPRINT_MASKS.map((m) => rasterizeLiquidMask(m)),
    droplet: rasterizeLiquidMask(DROPLET_MASK),
    spark: rasterizeCrispMask(SPARK_MASK),
    crack: rasterizeCrispMask(GROUND_CRACK_MASK),
  };
  return cachedSet;
}
