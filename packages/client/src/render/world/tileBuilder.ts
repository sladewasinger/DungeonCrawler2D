/** Bakes chunk ground tiles, cliff walls, stairs, biome fringes, and water masks into 512x512 canvases. */
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

function drawTileEdges(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly px: number;
  readonly py: number;
  readonly kind: GroundKind;
}): void {
  const { ctx, cache, wx, wy, px, py, kind } = input;
  paintEdgeStrip({ ctx, neighbor: cache.tileAt(wx, wy - 1).ground, kind, rect: [px, py, TILE_PX, 2] });
  paintEdgeStrip({ ctx, neighbor: cache.tileAt(wx - 1, wy).ground, kind, rect: [px, py, 2, TILE_PX] });
  const tile = cache.tileAt(wx, wy);
  const south = cache.tileAt(wx, wy + 1);
  if (tile.elevation > south.elevation && !tile.stairs) {
    ctx.fillStyle = "rgba(18, 24, 34, 0.35)";
    ctx.fillRect(px, py + TILE_PX - 3, TILE_PX, 3);
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
  input.wCtx.globalAlpha = ground === GroundKind.ShallowWater ? 0.84 : 1;
  input.wCtx.drawImage(wTile, input.px, input.py);
  input.wCtx.globalAlpha = 1;
}

function paintCliffOrBaseTile(input: PaintCellInput): void {
  const { gCtx, atlas, cache, wx, wy, px, py, variant } = input;
  const tile = cache.tileAt(wx, wy);
  if (isWater(tile.ground)) { paintWaterCell(input, tile.ground); return; }
  if (tile.stairs) { gCtx.drawImage(atlas.stairFace, px, py); return; }
  const north = cache.tileAt(wx, wy - 1);
  if (north.elevation > tile.elevation && !north.stairs) { gCtx.drawImage(atlas.cliffFace, px, py); return; }
  const img = atlas.variants.get(tile.ground)?.[variant % 4];
  if (img) gCtx.drawImage(img, px, py);
  drawTileEdges({ ctx: gCtx, cache, wx, wy, px, py, kind: tile.ground });
  if (north.elevation > tile.elevation) {
    gCtx.fillStyle = "rgba(10, 14, 22, 0.24)";
    gCtx.fillRect(px, py, TILE_PX, 4);
  }
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
      const wx = coords.cx * CHUNK_SIZE + lx;
      paintCliffOrBaseTile({
        gCtx: gCanvas.ctx,
        wCtx: wCanvas.ctx,
        atlas,
        cache,
        wx,
        wy,
        px: lx * TILE_PX,
        py: ly * TILE_PX,
        variant: chunk.variant[worldTileIndex(lx, ly)] ?? 0,
      });
    }
  }
  return {
    ground: canvasToNearestTexture(gCanvas.canvas),
    water: canvasToNearestTexture(wCanvas.canvas),
  };
}
