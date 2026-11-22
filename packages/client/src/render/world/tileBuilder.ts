/** Bakes chunk ground tiles, ambient-occlusion cliff shadows, and rounded water masks into 512x512 canvases. */
import { CHUNK_SIZE, GroundKind, TILE_PX, worldTileIndex, type WorldChunkCache } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";
import type { TerrainTileAtlas } from "../textures/terrainTextures.js";

export interface BakedChunkTextures {
  readonly ground: Texture;
  readonly water: Texture;
}

const BIOME_FRINGE_COLOR: Partial<Record<GroundKind, string>> = {
  [GroundKind.Sand]: "rgba(220, 192, 136, 0.45)",
  [GroundKind.DirtPath]: "rgba(156, 115, 73, 0.45)",
  [GroundKind.MeadowGrass]: "rgba(82, 162, 70, 0.4)",
  [GroundKind.Grass]: "rgba(62, 139, 67, 0.4)",
};

const AO_DEEP = "rgba(10, 14, 22, 0.36)";
const AO_SOFT = "rgba(10, 14, 22, 0.16)";

function isWater(kind: GroundKind): boolean {
  return kind === GroundKind.DeepWater || kind === GroundKind.ShallowWater;
}

function paintEdgeStrip(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly neighbor: GroundKind;
  readonly kind: GroundKind;
  readonly rect: readonly [number, number, number, number];
}): void {
  if (input.neighbor === input.kind || isWater(input.neighbor)) return;
  const color = BIOME_FRINGE_COLOR[input.neighbor];
  if (!color) return;
  input.ctx.fillStyle = color;
  input.ctx.fillRect(...input.rect);
}

function paintGroundCliffAo(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly px: number;
  readonly py: number;
  readonly elev: number;
}): void {
  const { ctx, cache, wx, wy, px, py, elev } = input;
  const north = cache.tileAt(wx, wy - 1);
  if (north.elevation > elev && !north.stairs) {
    ctx.fillStyle = AO_DEEP;
    ctx.fillRect(px, py, TILE_PX, 3);
    ctx.fillStyle = AO_SOFT;
    ctx.fillRect(px, py + 3, TILE_PX, 3);
  }
  if (cache.tileAt(wx - 1, wy).elevation > elev) {
    ctx.fillStyle = AO_DEEP;
    ctx.fillRect(px, py, 2, TILE_PX);
    ctx.fillStyle = AO_SOFT;
    ctx.fillRect(px + 2, py, 2, TILE_PX);
  }
  if (cache.tileAt(wx + 1, wy).elevation > elev) {
    ctx.fillStyle = AO_SOFT;
    ctx.fillRect(px + TILE_PX - 3, py, 3, TILE_PX);
  }
  const south = cache.tileAt(wx, wy + 1);
  if (south.elevation > elev && !south.stairs) {
    ctx.fillStyle = AO_SOFT;
    ctx.fillRect(px, py + TILE_PX - 3, TILE_PX, 3);
  }
}

function carveCornerCutouts(ctx: CanvasRenderingContext2D, input: {
  readonly px: number;
  readonly py: number;
  readonly rightEdge: boolean;
  readonly bottomEdge: boolean;
}): void {
  const bands = [4, 2, 1];
  for (let i = 0; i < bands.length; i++) {
    const w = bands[i] ?? 1;
    const x = input.rightEdge ? input.px + TILE_PX - w : input.px;
    const y = input.bottomEdge ? input.py + TILE_PX - 1 - i : input.py + i;
    ctx.clearRect(x, y, w, 1);
  }
}

function carveRoundedShoreCorners(input: PaintCellInput): void {
  const { wCtx, cache, wx, wy, px, py } = input;
  const n = !isWater(cache.tileAt(wx, wy - 1).ground);
  const s = !isWater(cache.tileAt(wx, wy + 1).ground);
  const w = !isWater(cache.tileAt(wx - 1, wy).ground);
  const e = !isWater(cache.tileAt(wx + 1, wy).ground);
  const corners: readonly (readonly [boolean, boolean, boolean])[] = [
    [n && w, false, false],
    [n && e, true, false],
    [s && w, false, true],
    [s && e, true, true],
  ];
  for (const [carve, rightEdge, bottomEdge] of corners) {
    if (carve) carveCornerCutouts(wCtx, { px, py, rightEdge, bottomEdge });
  }
}

interface PaintCellInput {
  readonly gCtx: CanvasRenderingContext2D;
  readonly wCtx: CanvasRenderingContext2D;
  readonly atlas: TerrainTileAtlas;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly px: number;
  readonly py: number;
  readonly variant: number;
}

function paintWaterCell(input: PaintCellInput, ground: GroundKind): void {
  const shore = input.atlas.variants.get(GroundKind.Sand)?.[input.variant];
  if (shore) input.gCtx.drawImage(shore, input.px, input.py);
  const wTile = input.atlas.variants.get(ground)?.[input.variant];
  if (!wTile) return;
  input.wCtx.globalAlpha = ground === GroundKind.ShallowWater ? 0.86 : 1;
  input.wCtx.drawImage(wTile, input.px, input.py);
  input.wCtx.globalAlpha = 1;
  carveRoundedShoreCorners(input);
}

function paintGroundTile(input: PaintCellInput): void {
  const { gCtx, atlas, cache, wx, wy, px, py, variant } = input;
  const tile = cache.tileAt(wx, wy);
  if (isWater(tile.ground)) { paintWaterCell(input, tile.ground); return; }
  const img = atlas.variants.get(tile.ground)?.[variant % 4];
  if (img) gCtx.drawImage(img, px, py);
  paintEdgeStrip({ ctx: gCtx, neighbor: cache.tileAt(wx, wy - 1).ground, kind: tile.ground, rect: [px, py, TILE_PX, 2] });
  paintEdgeStrip({ ctx: gCtx, neighbor: cache.tileAt(wx - 1, wy).ground, kind: tile.ground, rect: [px, py, 2, TILE_PX] });
  if (!tile.stairs) paintGroundCliffAo({ ctx: gCtx, cache, wx, wy, px, py, elev: tile.elevation });
}

export function bakeChunkTextures(
  cache: WorldChunkCache,
  atlas: TerrainTileAtlas,
  coords: { readonly cx: number; readonly cy: number },
): BakedChunkTextures {
  const size = CHUNK_SIZE * TILE_PX;
  const gCanvas = createPixelCanvas(size, size);
  const wCanvas = createPixelCanvas(size, size);
  const chunk = cache.getChunk(coords.cx, coords.cy);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    const wy = coords.cy * CHUNK_SIZE + ly;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      paintGroundTile({
        gCtx: gCanvas.ctx, wCtx: wCanvas.ctx, atlas, cache,
        wx: coords.cx * CHUNK_SIZE + lx, wy, px: lx * TILE_PX, py: ly * TILE_PX,
        variant: chunk.variant[worldTileIndex(lx, ly)] ?? 0,
      });
    }
  }
  return { ground: canvasToNearestTexture(gCanvas.canvas), water: canvasToNearestTexture(wCanvas.canvas) };
}
