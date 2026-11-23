/** Reusable 32x32 Cainos-style pixel motifs for calm, cohesive terrain tiles. */
import { seededPixelNoise } from "./pixelCanvas.js";

export const TERRAIN_TEX_PX = 32;

export interface TilePalette {
  readonly base: string;
  readonly mid: string;
  readonly dark: string;
  readonly highlight: string;
  readonly accent?: string;
}

export interface TilePoint {
  readonly x: number;
  readonly y: number;
}

export function px(
  ctx: CanvasRenderingContext2D,
  color: string,
  rect: readonly [number, number, number, number],
): void {
  ctx.fillStyle = color;
  ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
}

function mod32(n: number): number {
  return ((n % TERRAIN_TEX_PX) + TERRAIN_TEX_PX) % TERRAIN_TEX_PX;
}

export function wrapPx(
  ctx: CanvasRenderingContext2D,
  color: string,
  rect: readonly [number, number, number, number],
): void {
  const [rx, ry, rw, rh] = rect;
  ctx.fillStyle = color;
  for (let dy = 0; dy < rh; dy++) {
    const wy = mod32(ry + dy);
    for (let dx = 0; dx < rw; dx++) ctx.fillRect(mod32(rx + dx), wy, 1, 1);
  }
}

export function paintSoftBlob(
  ctx: CanvasRenderingContext2D,
  center: TilePoint,
  opts: { readonly w: number; readonly h: number; readonly color: string },
): void {
  const x0 = Math.round(center.x - opts.w * 0.5);
  const y0 = Math.round(center.y - opts.h * 0.5);
  wrapPx(ctx, opts.color, [x0 + 1, y0, Math.max(1, opts.w - 2), opts.h]);
  wrapPx(ctx, opts.color, [x0, y0 + 1, opts.w, Math.max(1, opts.h - 2)]);
}

export function paintGrassTuft3(ctx: CanvasRenderingContext2D, pos: TilePoint, p: TilePalette): void {
  wrapPx(ctx, p.dark, [pos.x, pos.y, 2, 1]);
  wrapPx(ctx, p.mid, [pos.x - 1, pos.y - 1, 3, 1]);
  wrapPx(ctx, p.highlight, [pos.x, pos.y - 2, 1, 2]);
  wrapPx(ctx, p.highlight, [pos.x + 1, pos.y - 1, 1, 1]);
}

export function paintCloverCluster(ctx: CanvasRenderingContext2D, pos: TilePoint, p: TilePalette): void {
  wrapPx(ctx, p.dark, [pos.x, pos.y + 1, 2, 1]);
  wrapPx(ctx, p.mid, [pos.x - 1, pos.y, 3, 1]);
  wrapPx(ctx, p.highlight, [pos.x, pos.y - 1, 2, 1]);
  wrapPx(ctx, p.highlight, [pos.x - 1, pos.y - 1, 1, 1]);
}

export function paintWildflower(
  ctx: CanvasRenderingContext2D,
  pos: TilePoint,
  opts: { readonly p: TilePalette; readonly white: boolean },
): void {
  const petal = opts.white ? "#f6f2dc" : (opts.p.accent ?? "#f6e37a");
  const center = opts.white ? "#f6d96a" : "#fff9e2";
  wrapPx(ctx, opts.p.dark, [pos.x, pos.y + 1, 1, 1]);
  wrapPx(ctx, petal, [pos.x - 1, pos.y, 3, 1]);
  wrapPx(ctx, petal, [pos.x, pos.y - 1, 1, 2]);
  wrapPx(ctx, center, [pos.x, pos.y, 1, 1]);
}

export function paintForestMossAndLeaves(
  ctx: CanvasRenderingContext2D,
  variant: number,
  p: TilePalette,
): void {
  for (let i = 0; i < 4; i++) {
    const mx = Math.floor(seededPixelNoise(961 + variant, i, 1) * TERRAIN_TEX_PX);
    const my = Math.floor(seededPixelNoise(967 + variant, i, 2) * TERRAIN_TEX_PX);
    paintSoftBlob(ctx, { x: mx, y: my }, { w: 4, h: 3, color: p.highlight });
    const lx = Math.floor(seededPixelNoise(971 + variant, i, 5) * TERRAIN_TEX_PX);
    const ly = Math.floor(seededPixelNoise(977 + variant, i, 6) * TERRAIN_TEX_PX);
    wrapPx(ctx, p.dark, [lx, ly + 1, 2, 1]);
    wrapPx(ctx, p.accent ?? p.dark, [lx, ly, 2, 1]);
  }
}

export function paintSmallPebble(
  ctx: CanvasRenderingContext2D,
  pos: TilePoint,
  opts: { readonly p: TilePalette; readonly wide: boolean },
): void {
  const w = opts.wide ? 3 : 2;
  wrapPx(ctx, opts.p.dark, [pos.x, pos.y + 1, w, 1]);
  wrapPx(ctx, opts.p.mid, [pos.x, pos.y, w, 1]);
  wrapPx(ctx, opts.p.highlight, [pos.x, pos.y, 1, 1]);
  if (opts.wide) wrapPx(ctx, opts.p.accent ?? opts.p.highlight, [pos.x + 1, pos.y, 1, 1]);
}

export function paintDuneRipple(ctx: CanvasRenderingContext2D, pos: TilePoint, p: TilePalette): void {
  wrapPx(ctx, p.highlight, [pos.x, pos.y, 5, 1]);
  wrapPx(ctx, p.highlight, [pos.x + 4, pos.y + 1, 4, 1]);
  wrapPx(ctx, p.mid, [pos.x + 1, pos.y + 1, 3, 1]);
  wrapPx(ctx, p.dark, [pos.x + 5, pos.y + 2, 3, 1]);
}

export function paintNaturalStoneFractures(ctx: CanvasRenderingContext2D, variant: number, p: TilePalette): void {
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(seededPixelNoise(701 + variant * 13, i, 1) * TERRAIN_TEX_PX);
    const y = Math.floor(seededPixelNoise(709 + variant * 17, i, 2) * TERRAIN_TEX_PX);
    const len = 3 + Math.floor(seededPixelNoise(719 + variant, i, 3) * 5);
    const vertical = (i + variant) % 3 === 0;
    if (vertical) {
      wrapPx(ctx, p.dark, [x, y, 1, len]);
      wrapPx(ctx, p.highlight, [x + 1, y + 1, 1, Math.max(2, len - 2)]);
    } else {
      wrapPx(ctx, p.dark, [x, y, len, 1]);
      wrapPx(ctx, p.highlight, [x + 1, y + 1, Math.max(2, len - 1), 1]);
    }
  }
}

export function paintMossCushion(ctx: CanvasRenderingContext2D, pos: TilePoint, p: TilePalette): void {
  const mossColor = p.accent ?? p.highlight;
  paintSoftBlob(ctx, pos, { w: 5, h: 3, color: "#3d6a2d" });
  paintSoftBlob(ctx, { x: pos.x, y: pos.y - 1 }, { w: 4, h: 2, color: mossColor });
  wrapPx(ctx, "#7ebc56", [pos.x, pos.y - 1, 2, 1]);
}

export function paintWaterShimmer(ctx: CanvasRenderingContext2D, pos: TilePoint, p: TilePalette): void {
  wrapPx(ctx, p.mid, [pos.x + 1, pos.y + 1, 5, 1]);
  wrapPx(ctx, p.highlight, [pos.x, pos.y, 3, 1]);
  wrapPx(ctx, p.highlight, [pos.x + 4, pos.y, 2, 1]);
}
