/** 32x32 pixel-art organic detail painters (grass tufts, pebbles, ripples, rock strata) and cliff/stair faces. */
import { GroundKind } from "@dc2d/engine";
import { createPixelCanvas, seededPixelNoise } from "./pixelCanvas.js";

export const TERRAIN_TEX_PX = 32;

export interface TilePalette {
  readonly base: string;
  readonly mid: string;
  readonly dark: string;
  readonly highlight: string;
  readonly accent?: string;
}

const GRASS_SET = new Set<GroundKind>([GroundKind.Grass, GroundKind.MeadowGrass, GroundKind.ForestFloor]);

function px(ctx: CanvasRenderingContext2D, c: string, rect: readonly [number, number, number, number]): void {
  ctx.fillStyle = c;
  ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
}

function paintTuft(ctx: CanvasRenderingContext2D, pos: { readonly bx: number; readonly by: number }, p: TilePalette): void {
  const { bx, by } = pos;
  px(ctx, p.dark, [bx - 1, by, 3, 1]);
  px(ctx, p.mid, [bx - 1, by - 1, 1, 1]);
  px(ctx, p.highlight, [bx, by - 2, 1, 2]);
  px(ctx, p.highlight, [bx + 1, by - 1, 1, 1]);
}

function paintFlowerCluster(ctx: CanvasRenderingContext2D, pos: { readonly fx: number; readonly fy: number }, p: TilePalette): void {
  const { fx, fy } = pos;
  px(ctx, p.dark, [fx, fy + 1, 1, 2]);
  px(ctx, p.accent ?? p.highlight, [fx - 1, fy, 1, 1]);
  px(ctx, p.accent ?? p.highlight, [fx + 1, fy, 1, 1]);
  px(ctx, p.highlight, [fx, fy - 1, 1, 1]);
  px(ctx, "#f8fafc", [fx, fy, 1, 1]);
}

export interface DetailPaintInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly kind: GroundKind;
  readonly variant: number;
  readonly palette: TilePalette;
}

export function paintOrganicDetails(input: DetailPaintInput): void {
  if (GRASS_SET.has(input.kind)) paintFoliageOverlay(input);
  else if (input.kind === GroundKind.Sand || input.kind === GroundKind.DirtPath) paintEarthOverlay(input);
  else if (input.kind === GroundKind.CliffStone || input.kind === GroundKind.MossStone) paintStoneOverlay(input);
  else paintWaterRipples(input.ctx, input.variant, input.palette);
}

function paintFoliageOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  const tufts = 4 + (variant % 3);
  for (let i = 0; i < tufts; i++) {
    const bx = 4 + Math.floor(seededPixelNoise(901 + variant, i, 1) * 24);
    const by = 5 + Math.floor(seededPixelNoise(907 + variant, i, 2) * 24);
    paintTuft(ctx, { bx, by }, p);
  }
  if (kind === GroundKind.MeadowGrass && variant % 2 === 0) {
    const fx = 6 + Math.floor(seededPixelNoise(951, variant, 3) * 20);
    const fy = 6 + Math.floor(seededPixelNoise(953, variant, 4) * 20);
    paintFlowerCluster(ctx, { fx, fy }, p);
  }
  if (kind === GroundKind.ForestFloor) paintForestLeaves(ctx, variant, p);
}

function paintForestLeaves(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 3; i++) {
    const lx = 4 + Math.floor(seededPixelNoise(971 + variant, i, 5) * 23);
    const ly = 4 + Math.floor(seededPixelNoise(977 + variant, i, 6) * 23);
    px(ctx, p.accent ?? p.dark, [lx, ly, 2, 1]);
  }
}

function paintEarthOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  const pebbles = kind === GroundKind.DirtPath ? 5 : 3;
  for (let i = 0; i < pebbles; i++) {
    const sx = 3 + Math.floor(seededPixelNoise(611 + variant, i, 1) * 24);
    const sy = 3 + Math.floor(seededPixelNoise(613 + variant, i, 2) * 24);
    px(ctx, p.dark, [sx, sy + 1, 3, 1]);
    px(ctx, p.highlight, [sx, sy, 2, 1]);
  }
  if (kind === GroundKind.Sand) paintSandRipples(ctx, variant, p);
}

function paintSandRipples(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 3; i++) {
    const rx = 2 + Math.floor(seededPixelNoise(641 + variant, i, 3) * 18);
    const ry = 5 + i * 9 + (variant % 3);
    px(ctx, p.highlight, [rx, ry, 7, 1]);
    px(ctx, p.mid, [rx + 1, ry + 1, 6, 1]);
  }
}

function paintStoneOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  const sy = 10 + (variant % 3) * 4;
  px(ctx, p.dark, [2, sy, 27, 1]);
  px(ctx, p.highlight, [3, sy + 1, 14, 1]);
  px(ctx, p.dark, [14 + (variant % 5), 2, 1, sy - 2]);
  px(ctx, p.dark, [8 + (variant % 4), sy + 1, 1, 14]);
  if (kind === GroundKind.MossStone) paintMossPatches(ctx, variant, p);
}

function paintMossPatches(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 4; i++) {
    const mx = 4 + Math.floor(seededPixelNoise(731 + variant, i, 1) * 22);
    const my = 4 + Math.floor(seededPixelNoise(739 + variant, i, 2) * 22);
    px(ctx, p.accent ?? p.highlight, [mx, my, 3, 2]);
  }
}

function paintWaterRipples(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 3; i++) {
    const wx = 3 + Math.floor(seededPixelNoise(811 + variant, i, 1) * 19);
    const wy = 4 + i * 9 + (variant % 3);
    px(ctx, p.highlight, [wx, wy, 5 + (i % 2) * 2, 1]);
    px(ctx, p.dark, [wx + 1, wy + 1, 4, 1]);
  }
}

export function paintCliffFaceTile32(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  px(ctx, "#4f4956", [0, 0, 32, 32]);
  px(ctx, "#6b6374", [0, 4, 32, 10]);
  px(ctx, "#3d3845", [0, 17, 32, 13]);
  px(ctx, "#3c7c38", [0, 0, 32, 3]);
  px(ctx, "#58a24f", [0, 3, 32, 1]);
  px(ctx, "#231e29", [0, 30, 32, 2]);
  for (let x = 2; x < 30; x += 6) {
    px(ctx, "#3d3845", [x, 8, 2, 4]);
    px(ctx, "#6b6374", [(x + 3) % 30, 20, 3, 3]);
  }
  return canvas;
}

export function paintStairFaceTile32(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  px(ctx, "#687080", [0, 0, 32, 32]);
  for (let step = 0; step < 6; step++) {
    const y = 1 + step * 5;
    px(ctx, "#9aa4b4", [2, y, 28, 3]);
    px(ctx, "#bcc5d4", [3, y, 26, 1]);
    px(ctx, "#434a58", [2, y + 3, 28, 2]);
  }
  px(ctx, "#222731", [0, 0, 2, 32]);
  px(ctx, "#222731", [30, 0, 2, 32]);
  return canvas;
}
