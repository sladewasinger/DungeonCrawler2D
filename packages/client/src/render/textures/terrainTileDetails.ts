/** 32x32 Cainos-style pixel-art terrain overlays and cliff/stair preview tiles. */
import { GroundKind } from "@dc2d/engine";
import { createPixelCanvas, seededPixelNoise } from "./pixelCanvas.js";
import {
  paintCloverCluster,
  paintDuneRipple,
  paintForestMossAndLeaves,
  paintGrassTuft3,
  paintMossCushion,
  paintNaturalStoneFractures,
  paintSmallPebble,
  paintWaterShimmer,
  paintWildflower,
  px,
  TERRAIN_TEX_PX,
  wrapPx,
  type TilePalette,
} from "./terrainTileMotifs.js";

export { TERRAIN_TEX_PX, type TilePalette } from "./terrainTileMotifs.js";

const GRASS_SET = new Set<GroundKind>([
  GroundKind.Grass, GroundKind.MeadowGrass, GroundKind.ForestFloor,
  GroundKind.AutumnGrass, GroundKind.AutumnFloor, GroundKind.BogMoss, GroundKind.CursedMoss,
]);
const EARTH_SET = new Set<GroundKind>([GroundKind.Sand, GroundKind.DirtPath, GroundKind.BogMud, GroundKind.AshGround]);
const STONE_SET = new Set<GroundKind>([GroundKind.CliffStone, GroundKind.MossStone, GroundKind.SlateRock, GroundKind.RuinFlagstone]);

export interface DetailPaintInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly kind: GroundKind;
  readonly variant: number;
  readonly palette: TilePalette;
}

export function paintOrganicDetails(input: DetailPaintInput): void {
  if (GRASS_SET.has(input.kind)) paintFoliageOverlay(input);
  else if (EARTH_SET.has(input.kind)) paintEarthOverlay(input);
  else if (STONE_SET.has(input.kind)) paintStoneOverlay(input);
  else paintWaterRipples(input.ctx, input.variant, input.palette);
}

function paintClovers(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let c = 0; c < 2; c++) {
    const cx = Math.floor(seededPixelNoise(929 + c * 17, variant, 7) * TERRAIN_TEX_PX);
    const cy = Math.floor(seededPixelNoise(937 + c * 19, variant, 8) * TERRAIN_TEX_PX);
    paintCloverCluster(ctx, { x: cx, y: cy }, p);
  }
}

function paintFoliageOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  const tufts = kind === GroundKind.ForestFloor ? 5 : 6 + (variant % 2);
  for (let i = 0; i < tufts; i++) {
    const qx = ((i & 1) * 16 + Math.floor(seededPixelNoise(901 + variant, i, 1) * 16)) % TERRAIN_TEX_PX;
    const qy = (((i >> 1) & 1) * 16 + Math.floor(seededPixelNoise(907 + variant, i, 2) * 16)) % TERRAIN_TEX_PX;
    paintGrassTuft3(ctx, { x: qx, y: qy }, p);
  }
  if (kind !== GroundKind.ForestFloor) paintClovers(ctx, variant, p);
  if (kind === GroundKind.MeadowGrass && variant === 0) {
    const x = Math.floor(seededPixelNoise(951, variant, 3) * TERRAIN_TEX_PX);
    const y = Math.floor(seededPixelNoise(953, variant, 4) * TERRAIN_TEX_PX);
    paintWildflower(ctx, { x, y }, { p, white: false });
  }
  if (kind === GroundKind.ForestFloor) paintForestMossAndLeaves(ctx, variant, p);
}

function paintEarthOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  if (kind === GroundKind.DirtPath) {
    const pebbles = 8 + (variant % 3);
    for (let i = 0; i < pebbles; i++) {
      const x = ((i & 1) * 16 + Math.floor(seededPixelNoise(611 + variant, i, 1) * 16)) % TERRAIN_TEX_PX;
      const y = (((i >> 1) & 1) * 16 + Math.floor(seededPixelNoise(613 + variant, i, 2) * 16)) % TERRAIN_TEX_PX;
      paintSmallPebble(ctx, { x, y }, { p, wide: i % 3 === 0 });
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(seededPixelNoise(641 + variant, i, 3) * TERRAIN_TEX_PX);
    const y = (4 + i * 8 + variant * 3) % TERRAIN_TEX_PX;
    paintDuneRipple(ctx, { x, y }, p);
  }
  for (let g = 0; g < 3; g++) {
    const gx = Math.floor(seededPixelNoise(673 + variant, g, 4) * TERRAIN_TEX_PX);
    const gy = Math.floor(seededPixelNoise(677 + variant, g, 5) * TERRAIN_TEX_PX);
    wrapPx(ctx, p.accent ?? p.highlight, [gx, gy, 2, 1]);
  }
}

function paintStoneOverlay(input: DetailPaintInput): void {
  const { ctx, kind, variant, palette: p } = input;
  paintNaturalStoneFractures(ctx, variant, p);
  if (kind !== GroundKind.MossStone) return;
  for (let i = 0; i < 4; i++) {
    const x = ((i & 1) * 16 + Math.floor(seededPixelNoise(731 + variant, i, 1) * 16)) % TERRAIN_TEX_PX;
    const y = (((i >> 1) & 1) * 16 + Math.floor(seededPixelNoise(739 + variant, i, 2) * 16)) % TERRAIN_TEX_PX;
    paintMossCushion(ctx, { x, y }, p);
  }
}

function paintWaterRipples(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 4; i++) {
    const x = ((i & 1) * 16 + Math.floor(seededPixelNoise(811 + variant, i, 1) * 16)) % TERRAIN_TEX_PX;
    const y = (3 + i * 8 + variant * 3) % TERRAIN_TEX_PX;
    paintWaterShimmer(ctx, { x, y }, p);
  }
}

export function paintCliffFaceTile32(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  px(ctx, "#474c57", [0, 0, 32, 32]);
  px(ctx, "#7a808a", [0, 6, 32, 10]);
  px(ctx, "#606670", [0, 14, 32, 10]);
  px(ctx, "#242832", [0, 5, 32, 2]);
  px(ctx, "#6ea84b", [0, 0, 32, 3]);
  px(ctx, "#4f843a", [0, 3, 32, 2]);
  for (let x = 2; x < 30; x += 6) {
    px(ctx, "#589340", [x, 4, 3, 2]);
    px(ctx, "#2f3440", [x + 2, 9, 1, 7]);
    px(ctx, "#8c939e", [x, 8, 4, 1]);
    px(ctx, "#2f3440", [(x + 4) % 28, 18, 1, 8]);
  }
  px(ctx, "#1b202a", [0, 30, 32, 2]);
  return canvas;
}

export function paintStairFaceTile32(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  px(ctx, "#6b717c", [0, 0, 32, 32]);
  for (let step = 0; step < 6; step++) {
    const y = 1 + step * 5;
    px(ctx, "#b4bcc8", [2, y, 28, 1]);
    px(ctx, "#8c94a0", [2, y + 1, 28, 2]);
    px(ctx, "#525864", [2, y + 3, 28, 1]);
    px(ctx, "#242832", [2, y + 4, 28, 1]);
  }
  px(ctx, "#4f843a", [1, 3, 2, 3]);
  px(ctx, "#4f843a", [29, 14, 2, 3]);
  px(ctx, "#1b202a", [0, 0, 2, 32]);
  px(ctx, "#1b202a", [30, 0, 2, 32]);
  return canvas;
}
