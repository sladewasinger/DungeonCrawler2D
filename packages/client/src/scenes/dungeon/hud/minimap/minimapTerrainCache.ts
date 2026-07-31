import type { World } from "@dc2d/engine";
import type { MinimapTerrainTile } from "../../../../ui/hud/model/minimap/minimapTypes.js";

export const MINIMAP_RANGE_TILES = 16;

interface TerrainCache {
  readonly centerX: number;
  readonly centerY: number;
  readonly chunkCacheRevision: number;
  readonly tileRevision: number;
  readonly tiles: readonly MinimapTerrainTile[];
}

const terrainCaches = new WeakMap<World, TerrainCache>();

export const cachedMinimapTerrain = (
  world: World | null,
  centerX: number,
  centerY: number,
): readonly MinimapTerrainTile[] => {
  if (!world) return [];
  const tileCenter = { x: Math.floor(centerX), y: Math.floor(centerY) };
  const cached = terrainCaches.get(world);
  if (cached && matchesTerrainCache({ cache: cached, center: tileCenter, world })) return cached.tiles;
  const tiles = buildTerrainTiles(world, tileCenter);
  terrainCaches.set(world, {
    centerX: tileCenter.x,
    centerY: tileCenter.y,
    chunkCacheRevision: world.chunkCacheRevision,
    tileRevision: world.tileRevision,
    tiles,
  });
  return tiles;
};

interface TileCenter {
  readonly x: number;
  readonly y: number;
}

interface TerrainCacheMatch {
  readonly cache: TerrainCache | undefined;
  readonly center: TileCenter;
  readonly world: World;
}

const matchesTerrainCache = ({
  cache,
  center,
  world,
}: TerrainCacheMatch): boolean => Boolean(
  cache &&
  cache.centerX === center.x &&
  cache.centerY === center.y &&
  cache.chunkCacheRevision === world.chunkCacheRevision &&
  cache.tileRevision === world.tileRevision,
);

const buildTerrainTiles = (
  world: World,
  center: TileCenter,
): MinimapTerrainTile[] => {
  const tiles: MinimapTerrainTile[] = [];
  for (let y = center.y - MINIMAP_RANGE_TILES; y <= center.y + MINIMAP_RANGE_TILES; y += 1) {
    appendTerrainRow({ world, center, y, tiles });
  }
  return tiles;
};

interface TerrainRowRequest {
  readonly world: World;
  readonly center: TileCenter;
  readonly y: number;
  readonly tiles: MinimapTerrainTile[];
}

const appendTerrainRow = ({ world, center, y, tiles }: TerrainRowRequest): void => {
  for (let x = center.x - MINIMAP_RANGE_TILES; x <= center.x + MINIMAP_RANGE_TILES; x += 1) {
    if (!isWithinMinimapRange({ center, x, y })) continue;
    const terrain = world.cachedTerrainAt(x, y);
    if (terrain) tiles.push({ x, y, ...terrain });
  }
};

interface MinimapRangeCheck {
  readonly center: TileCenter;
  readonly x: number;
  readonly y: number;
}

const isWithinMinimapRange = ({ center, x, y }: MinimapRangeCheck): boolean =>
  (x - center.x) ** 2 + (y - center.y) ** 2 <= MINIMAP_RANGE_TILES ** 2;
