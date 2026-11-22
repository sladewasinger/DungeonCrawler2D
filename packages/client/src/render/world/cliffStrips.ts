/** Renders lifted 3/4 cliff plateau rows, vertical cliff strata, rim bevels, and sloped staircases. */
import { CHUNK_SIZE, TILE_PX, worldTileIndex, type WorldChunkCache } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";
import type { TerrainTileAtlas } from "../textures/terrainTextures.js";

export const ELEVATION_LIFT_PX = 10;

export interface ElevatedRowStrip {
  readonly texture: Texture;
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
}

const RIM_DARK = "#1b202a";

function paintStairCell(ctx: CanvasRenderingContext2D, px: number): void {
  const height = TILE_PX + ELEVATION_LIFT_PX;
  ctx.fillStyle = "#5c6372";
  ctx.fillRect(px, 0, TILE_PX, height);
  for (let i = 0; i < 6; i++) {
    const sy = 1 + i * 4;
    ctx.fillStyle = "#9ca6b6";
    ctx.fillRect(px + 1, sy, TILE_PX - 2, 2);
    ctx.fillStyle = "#3f4552";
    ctx.fillRect(px + 1, sy + 2, TILE_PX - 2, 2);
  }
  ctx.fillStyle = RIM_DARK;
  ctx.fillRect(px, 0, 1, height);
  ctx.fillRect(px + TILE_PX - 1, 0, 1, height);
}

function paintDropOffBevels(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly px: number;
  readonly elev: number;
}): void {
  const { ctx, cache, wx, wy, px, elev } = input;
  const n = cache.tileAt(wx, wy - 1);
  const w = cache.tileAt(wx - 1, wy);
  const e = cache.tileAt(wx + 1, wy);
  if (n.elevation < elev && !n.stairs) {
    ctx.fillStyle = RIM_DARK;
    ctx.fillRect(px, 0, TILE_PX, 1);
    ctx.fillStyle = "rgba(225, 240, 205, 0.48)";
    ctx.fillRect(px, 1, TILE_PX, 2);
  }
  if (w.elevation < elev && !w.stairs) {
    ctx.fillStyle = RIM_DARK;
    ctx.fillRect(px, 0, 1, TILE_PX);
    ctx.fillStyle = "rgba(225, 240, 205, 0.34)";
    ctx.fillRect(px + 1, 0, 2, TILE_PX);
  }
  if (e.elevation < elev && !e.stairs) {
    ctx.fillStyle = RIM_DARK;
    ctx.fillRect(px + TILE_PX - 1, 0, 1, TILE_PX);
    ctx.fillStyle = "rgba(16, 22, 32, 0.35)";
    ctx.fillRect(px + TILE_PX - 3, 0, 2, TILE_PX);
  }
}

function paintSouthCliffWall(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly px: number;
  readonly elev: number;
}): void {
  const { ctx, cache, wx, wy, px, elev } = input;
  const south = cache.tileAt(wx, wy + 1);
  if (south.elevation >= elev || south.stairs) return;

  ctx.fillStyle = "#6ca156";
  ctx.fillRect(px, TILE_PX - 2, TILE_PX, 2);
  ctx.fillStyle = "#1f2430";
  ctx.fillRect(px, TILE_PX, TILE_PX, 1);
  ctx.fillStyle = "#626978";
  ctx.fillRect(px, TILE_PX + 1, TILE_PX, 4);
  ctx.fillStyle = "#484f5e";
  ctx.fillRect(px, TILE_PX + 5, TILE_PX, 4);
  ctx.fillStyle = RIM_DARK;
  ctx.fillRect(px, TILE_PX + ELEVATION_LIFT_PX - 1, TILE_PX, 1);

  if (cache.tileAt(wx - 1, wy).elevation < elev) ctx.fillRect(px, TILE_PX, 1, ELEVATION_LIFT_PX);
  if (cache.tileAt(wx + 1, wy).elevation < elev) ctx.fillRect(px + TILE_PX - 1, TILE_PX, 1, ELEVATION_LIFT_PX);
}

interface RowCellCtx {
  readonly canvasData: ReturnType<typeof createPixelCanvas>;
  readonly cache: WorldChunkCache;
  readonly atlas: TerrainTileAtlas;
  readonly variant: Uint8Array;
  readonly wx: number;
  readonly wy: number;
  readonly lx: number;
  readonly ly: number;
  readonly elev: number;
  readonly isStair: boolean;
}

function paintRowCell(ctx: RowCellCtx): void {
  const px = ctx.lx * TILE_PX;
  if (ctx.isStair) { paintStairCell(ctx.canvasData.ctx, px); return; }
  const tile = ctx.cache.tileAt(ctx.wx, ctx.wy);
  const v = ctx.variant[worldTileIndex(ctx.lx, ctx.ly)] ?? 0;
  const img = ctx.atlas.variants.get(tile.ground)?.[v % 4];
  if (img) ctx.canvasData.ctx.drawImage(img, px, 0);
  paintDropOffBevels({ ctx: ctx.canvasData.ctx, cache: ctx.cache, wx: ctx.wx, wy: ctx.wy, px, elev: ctx.elev });
  paintSouthCliffWall({ ctx: ctx.canvasData.ctx, cache: ctx.cache, wx: ctx.wx, wy: ctx.wy, px, elev: ctx.elev });
}

function bakeSingleElevationRow(input: {
  readonly cache: WorldChunkCache; readonly atlas: TerrainTileAtlas; readonly variant: Uint8Array;
  readonly cx: number; readonly cy: number; readonly ly: number; readonly elev: number;
}): ElevatedRowStrip | null {
  const wy = input.cy * CHUNK_SIZE + input.ly;
  const stripW = CHUNK_SIZE * TILE_PX;
  let canvasData: ReturnType<typeof createPixelCanvas> | null = null;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const wx = input.cx * CHUNK_SIZE + lx;
    const tile = input.cache.tileAt(wx, wy);
    const isStair = input.elev === 1 && tile.stairs;
    if (!isStair && tile.elevation < input.elev) continue;
    canvasData ??= createPixelCanvas(stripW, TILE_PX + ELEVATION_LIFT_PX);
    paintRowCell({ canvasData, cache: input.cache, atlas: input.atlas, variant: input.variant, wx, wy, lx, ly: input.ly, elev: input.elev, isStair });
  }
  if (!canvasData) return null;
  return { texture: canvasToNearestTexture(canvasData.canvas), x: input.cx * stripW, y: wy * TILE_PX - input.elev * ELEVATION_LIFT_PX, zIndex: wy * TILE_PX + (input.elev - 1) };
}

export function playerVisualElevation(input: {
  readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly baseElev: number;
}): { readonly visualElev: number; readonly sortBoost: number } {
  const tile = input.cache.tileAt(Math.floor(input.x), Math.floor(input.y));
  if (!tile.stairs) return { visualElev: input.baseElev, sortBoost: input.baseElev * 2 };
  const fracY = input.y - Math.floor(input.y);
  return { visualElev: Math.max(0, Math.min(1, 1 - fracY)), sortBoost: 2 };
}

export function bakeElevatedChunkRows(
  cache: WorldChunkCache,
  atlas: TerrainTileAtlas,
  coords: { readonly cx: number; readonly cy: number },
): readonly ElevatedRowStrip[] {
  const chunk = cache.getChunk(coords.cx, coords.cy);
  const strips: ElevatedRowStrip[] = [];
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (const elev of [1, 2]) {
      const row = bakeSingleElevationRow({ cache, atlas, variant: chunk.variant, cx: coords.cx, cy: coords.cy, ly, elev });
      if (row) strips.push(row);
    }
  }
  return strips;
}
