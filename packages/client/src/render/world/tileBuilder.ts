/** Packs chunk terrain & shoreline metadata into 4 KB GPU lookup buffers and builds tilemap meshes. */
import { CHUNK_SIZE, GroundKind, worldTileIndex, type WorldChunkCache } from "@dc2d/engine";
import { createChunkTilemapLayer, type TilemapLayerHandle } from "../shaders/tilemapMesh.js";
import type { TerrainTileAtlas } from "../textures/terrainTextures.js";

export interface BakedChunkTilemaps {
  readonly ground: TilemapLayerHandle;
  readonly water: TilemapLayerHandle;
}

const FRINGE_CODE: Partial<Record<GroundKind, number>> = {
  [GroundKind.Sand]: 1,
  [GroundKind.DirtPath]: 2,
  [GroundKind.MeadowGrass]: 3,
  [GroundKind.Grass]: 4,
  [GroundKind.AutumnGrass]: 5,
  [GroundKind.BogMoss]: 6,
  [GroundKind.CursedMoss]: 7,
};

function isWater(kind: GroundKind): boolean {
  return kind === GroundKind.DeepWater || kind === GroundKind.ShallowWater;
}

function fringeCodeFor(self: GroundKind, neighbor: GroundKind): number {
  if (neighbor === self || isWater(neighbor)) return 0;
  return FRINGE_CODE[neighbor] ?? 0;
}

function computeCliffAoMask(opts: {
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly elev: number;
}): number {
  const { cache, wx, wy, elev } = opts;
  const n = cache.tileAt(wx, wy - 1);
  const w = cache.tileAt(wx - 1, wy);
  const e = cache.tileAt(wx + 1, wy);
  const s = cache.tileAt(wx, wy + 1);
  return (n.elevation > elev && !n.stairs ? 1 : 0)
    | (w.elevation > elev ? 2 : 0)
    | (e.elevation > elev ? 4 : 0)
    | (s.elevation > elev && !s.stairs ? 8 : 0);
}

function landNeighbor(cache: WorldChunkCache, wx: number, wy: number): boolean {
  return !isWater(cache.tileAt(wx, wy).ground);
}

function cornerBit(a: boolean, b: boolean, bit: number): number {
  return a && b ? bit : 0;
}

function computeShoreCornerMask(opts: { readonly cache: WorldChunkCache; readonly wx: number; readonly wy: number }): number {
  const { cache, wx, wy } = opts;
  const n = landNeighbor(cache, wx, wy - 1);
  const s = landNeighbor(cache, wx, wy + 1);
  const w = landNeighbor(cache, wx - 1, wy);
  const e = landNeighbor(cache, wx + 1, wy);
  return cornerBit(n, w, 1) | cornerBit(n, e, 2) | cornerBit(s, w, 4) | cornerBit(s, e, 8);
}

function packCellBytes(input: {
  readonly groundOut: Uint8Array;
  readonly waterOut: Uint8Array;
  readonly cache: WorldChunkCache;
  readonly wx: number;
  readonly wy: number;
  readonly offset: number;
  readonly variant: number;
}): void {
  const { groundOut, waterOut, cache, wx, wy, offset, variant } = input;
  const tile = cache.tileAt(wx, wy);
  const water = isWater(tile.ground);
  const aoMask = water || tile.stairs ? 0 : computeCliffAoMask({ cache, wx, wy, elev: tile.elevation });
  const nf = water ? 0 : fringeCodeFor(tile.ground, cache.tileAt(wx, wy - 1).ground);
  const wf = water ? 0 : fringeCodeFor(tile.ground, cache.tileAt(wx - 1, wy).ground);
  groundOut[offset] = water ? Number(GroundKind.Sand) : Number(tile.ground);
  groundOut[offset + 1] = (variant & 3) | ((aoMask & 15) << 2);
  groundOut[offset + 2] = (nf & 7) | ((wf & 7) << 3);
  groundOut[offset + 3] = 255;

  if (!water) {
    waterOut[offset] = 0;
    waterOut[offset + 3] = 255;
    return;
  }
  const corners = computeShoreCornerMask({ cache, wx, wy });
  waterOut[offset] = tile.ground === GroundKind.ShallowWater ? 1 : 2;
  waterOut[offset + 1] = (variant & 3) | ((corners & 15) << 2);
  waterOut[offset + 2] = 0;
  waterOut[offset + 3] = 255;
}

export function packChunkTilemapBuffers(
  cache: WorldChunkCache,
  coords: { readonly cx: number; readonly cy: number },
): { readonly groundData: Uint8Array; readonly waterData: Uint8Array } {
  const byteCount = CHUNK_SIZE * CHUNK_SIZE * 4;
  const groundData = new Uint8Array(byteCount);
  const waterData = new Uint8Array(byteCount);
  const chunk = cache.getChunk(coords.cx, coords.cy);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    const wy = coords.cy * CHUNK_SIZE + ly;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const idx = worldTileIndex(lx, ly);
      packCellBytes({
        groundOut: groundData,
        waterOut: waterData,
        cache,
        wx: coords.cx * CHUNK_SIZE + lx,
        wy,
        offset: idx * 4,
        variant: chunk.variant[idx] ?? 0,
      });
    }
  }
  return { groundData, waterData };
}

export function buildChunkTilemapMeshes(
  cache: WorldChunkCache,
  atlas: TerrainTileAtlas,
  coords: { readonly cx: number; readonly cy: number },
): BakedChunkTilemaps {
  const { groundData, waterData } = packChunkTilemapBuffers(cache, coords);
  return {
    ground: createChunkTilemapLayer({ atlas, mapData: groundData, mode: "ground" }),
    water: createChunkTilemapLayer({ atlas, mapData: waterData, mode: "water" }),
  };
}
