/** Renders lifted 3/4 cliff plateau rows, vertical cliff strata, rim bevels, and sloped staircases at 32px/tile. */
import { CHUNK_SIZE, TILE_PX, worldTileIndex, type WorldChunkCache } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";
import { TERRAIN_TEX_PX, type TerrainTileAtlas } from "../textures/terrainTextures.js";

export const ELEVATION_LIFT_PX = 10;
const LIFT_TEX_PX = ELEVATION_LIFT_PX * 2;
const STRIP_SCALE = TILE_PX / TERRAIN_TEX_PX;

export interface ElevatedRowStrip {
  readonly texture: Texture;
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
  readonly scale: number;
}

const RIM_DARK = "#1b202a";

function paintStairCell(ctx: CanvasRenderingContext2D, px: number): void {
  const height = TERRAIN_TEX_PX + LIFT_TEX_PX;
  ctx.fillStyle = "#6b717c";
  ctx.fillRect(px, 0, TERRAIN_TEX_PX, height);
  for (let i = 0; i < 6; i++) {
    const sy = 2 + i * 8;
    ctx.fillStyle = "#b4bcc8";
    ctx.fillRect(px + 2, sy, TERRAIN_TEX_PX - 4, 1);
    ctx.fillStyle = "#8c94a0";
    ctx.fillRect(px + 2, sy + 1, TERRAIN_TEX_PX - 4, 4);
    ctx.fillStyle = "#525864";
    ctx.fillRect(px + 2, sy + 5, TERRAIN_TEX_PX - 4, 2);
    ctx.fillStyle = "#242832";
    ctx.fillRect(px + 2, sy + 7, TERRAIN_TEX_PX - 4, 1);
  }
  ctx.fillStyle = "#4f843a";
  ctx.fillRect(px + 1, 5, 2, 4);
  ctx.fillRect(px + TERRAIN_TEX_PX - 3, 21, 2, 4);
  ctx.fillStyle = RIM_DARK;
  ctx.fillRect(px, 0, 2, height);
  ctx.fillRect(px + TERRAIN_TEX_PX - 2, 0, 2, height);
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
    ctx.fillRect(px, 0, TERRAIN_TEX_PX, 2);
    ctx.fillStyle = "rgba(232, 244, 198, 0.42)";
    ctx.fillRect(px, 2, TERRAIN_TEX_PX, 4);
  }
  if (w.elevation < elev && !w.stairs) {
    ctx.fillStyle = RIM_DARK;
    ctx.fillRect(px, 0, 2, TERRAIN_TEX_PX);
    ctx.fillStyle = "rgba(232, 244, 198, 0.30)";
    ctx.fillRect(px + 2, 0, 4, TERRAIN_TEX_PX);
  }
  if (e.elevation < elev && !e.stairs) {
    ctx.fillStyle = RIM_DARK;
    ctx.fillRect(px + TERRAIN_TEX_PX - 2, 0, 2, TERRAIN_TEX_PX);
    ctx.fillStyle = "rgba(18, 24, 34, 0.34)";
    ctx.fillRect(px + TERRAIN_TEX_PX - 6, 0, 4, TERRAIN_TEX_PX);
  }
}

function paintCliffOverhangRim(ctx: CanvasRenderingContext2D, px: number, wx: number): void {
  ctx.fillStyle = "#6ea84b";
  ctx.fillRect(px, TERRAIN_TEX_PX - 4, TERRAIN_TEX_PX, 3);
  ctx.fillStyle = "#589340";
  ctx.fillRect(px, TERRAIN_TEX_PX - 1, TERRAIN_TEX_PX, 2);
  for (let i = 0; i < 4; i++) {
    const sx = px + i * 8 + (((wx * 3 + i) & 1) === 0 ? 1 : 2);
    const drop = 2 + ((wx + i) % 3);
    ctx.fillStyle = "#437632";
    ctx.fillRect(sx, TERRAIN_TEX_PX + 1, 5, drop);
    ctx.fillStyle = "#242832";
    ctx.fillRect(sx, TERRAIN_TEX_PX + 1 + drop, 5, 2);
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

  ctx.fillStyle = "#474c57";
  ctx.fillRect(px, TERRAIN_TEX_PX, TERRAIN_TEX_PX, LIFT_TEX_PX);
  ctx.fillStyle = "#7a808a";
  ctx.fillRect(px, TERRAIN_TEX_PX + 2, TERRAIN_TEX_PX, 7);
  ctx.fillStyle = "#606670";
  ctx.fillRect(px, TERRAIN_TEX_PX + 9, TERRAIN_TEX_PX, 6);
  ctx.fillStyle = RIM_DARK;
  ctx.fillRect(px, TERRAIN_TEX_PX + LIFT_TEX_PX - 2, TERRAIN_TEX_PX, 2);

  for (let col = 0; col < 3; col++) {
    const cx = px + 3 + col * 10 + ((wx + col) % 2);
    ctx.fillStyle = "#8c939e";
    ctx.fillRect(cx, TERRAIN_TEX_PX + 4, 6, 1);
    ctx.fillStyle = "#2f3440";
    ctx.fillRect(cx + 5, TERRAIN_TEX_PX + 3, 2, 7);
    ctx.fillRect(cx - 1, TERRAIN_TEX_PX + 11, 2, 6);
  }
  paintCliffOverhangRim(ctx, px, wx);
  ctx.fillStyle = RIM_DARK;
  if (cache.tileAt(wx - 1, wy).elevation < elev) ctx.fillRect(px, TERRAIN_TEX_PX, 2, LIFT_TEX_PX);
  if (cache.tileAt(wx + 1, wy).elevation < elev) ctx.fillRect(px + TERRAIN_TEX_PX - 2, TERRAIN_TEX_PX, 2, LIFT_TEX_PX);
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
  const px = ctx.lx * TERRAIN_TEX_PX;
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
  const stripArtW = CHUNK_SIZE * TERRAIN_TEX_PX;
  let canvasData: ReturnType<typeof createPixelCanvas> | null = null;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const wx = input.cx * CHUNK_SIZE + lx;
    const tile = input.cache.tileAt(wx, wy);
    const isStair = input.elev === 1 && tile.stairs;
    if (!isStair && tile.elevation < input.elev) continue;
    canvasData ??= createPixelCanvas(stripArtW, TERRAIN_TEX_PX + LIFT_TEX_PX, { willReadFrequently: false });
    paintRowCell({ canvasData, cache: input.cache, atlas: input.atlas, variant: input.variant, wx, wy, lx, ly: input.ly, elev: input.elev, isStair });
  }
  if (!canvasData) return null;
  return {
    texture: canvasToNearestTexture(canvasData.canvas),
    x: input.cx * CHUNK_SIZE * TILE_PX,
    y: wy * TILE_PX - input.elev * ELEVATION_LIFT_PX,
    zIndex: wy * TILE_PX + (input.elev - 1),
    scale: STRIP_SCALE,
  };
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
