import { featureFromTile, type StoredFeature } from "./featureOverrides.js";
import {
  SOLID_TILES,
  TERRAIN,
  TILE,
  type TerrainType,
  type TileType,
} from "./types.js";
import type { TerrainCell } from "./worldTerrain.js";

export interface CachedTerrainTile {
  readonly height: number;
  readonly walkable: boolean;
}

export interface CachedTerrainRequest {
  readonly cell: TerrainCell;
  readonly wx: number;
  readonly wy: number;
  readonly tileOverrides: ReadonlyMap<string, TileType>;
  readonly featureOverrides: ReadonlyMap<string, StoredFeature>;
}

export const cachedTerrainAt = ({
  cell,
  wx,
  wy,
  tileOverrides,
  featureOverrides,
}: CachedTerrainRequest): CachedTerrainTile => {
  const terrain = cachedTerrainValues({ cell, wx, wy, tileOverrides, featureOverrides });
  return {
    height: cell.chunk.height[cell.index] ?? 0,
    walkable: isWalkable(terrain),
  };
};

interface CachedTerrainValues {
  readonly feature: TileType;
  readonly surface: TileType;
  readonly terrain: TerrainType;
}

const cachedTerrainValues = (request: CachedTerrainRequest): CachedTerrainValues => ({
  feature: cachedFeature(request),
  surface: cachedSurface(request),
  terrain: cachedTerrainKind(request),
});

const cachedFeature = ({
  cell,
  wx,
  wy,
  tileOverrides,
  featureOverrides,
}: CachedTerrainRequest): TileType => {
  const tileOverride = tileOverrides.get(tileKey(wx, wy));
  if (tileOverride !== undefined) return featureFromTile(tileOverride);
  return featureOverrides.get(tileKey(wx, wy))?.tile
    ?? (cell.chunk.features[cell.index] as TileType | undefined)
    ?? TILE.Floor;
};

const cachedSurface = ({
  cell,
  wx,
  wy,
  tileOverrides,
}: CachedTerrainRequest): TileType => {
  const tileOverride = tileOverrides.get(tileKey(wx, wy));
  if (tileOverride !== undefined) return surfaceOverride(tileOverride);
  return (cell.chunk.tiles[cell.index] ?? TILE.Floor) as TileType;
};

const cachedTerrainKind = ({
  cell,
  wx,
  wy,
  tileOverrides,
}: CachedTerrainRequest): TerrainType => {
  const tileOverride = tileOverrides.get(tileKey(wx, wy));
  if (tileOverride !== undefined) return terrainOverride(tileOverride);
  return (cell.chunk.terrain[cell.index] ?? TERRAIN.Floor) as TerrainType;
};

const isWalkable = ({ feature, surface, terrain }: CachedTerrainValues): boolean =>
  !SOLID_TILES.has(feature) && !SOLID_TILES.has(surface) && terrain !== TERRAIN.Void;

const tileKey = (wx: number, wy: number): string => `${wx},${wy}`;

const surfaceOverride = (tile: TileType): TileType =>
  featureFromTile(tile) === TILE.Floor ? tile : TILE.Floor;

const terrainOverride = (tile: TileType): TerrainType =>
  tile === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
