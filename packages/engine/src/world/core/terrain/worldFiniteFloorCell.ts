import {
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
  ZONE,
  type FeatureFace,
  type TerrainType,
  type TileType,
  type ZoneType,
} from "../types.js";
import type { GeneratedFloor } from "../../generate/finiteFloorTypes.js";
import { isRoomIsolationChunk } from "../../features/rooms/locations/roomLocations.js";

export interface FiniteFloorCell {
  readonly tile: TileType; readonly feature: TileType; readonly featureFace: FeatureFace;
  readonly featureHeight: number; readonly terrain: TerrainType; readonly height: number; readonly zone: ZoneType;
}

export function finiteFloorCellAt(floor: GeneratedFloor | undefined, wx: number, wy: number): FiniteFloorCell | null {
  if (!floor) return null;
  if (isRoomIsolationChunk(Math.floor(wy / CHUNK_SIZE))) return null;
  const index = floorIndex(floor, wx, wy);
  return index === null ? boundaryCell(floor) : cellAt(floor, index);
}

function cellAt(floor: GeneratedFloor, index: number): FiniteFloorCell {
  return {
    tile: floor.tiles[index] as TileType,
    feature: (floor.features[index] ?? TILE.Floor) as TileType,
    featureFace: (floor.featureFaces[index] ?? FEATURE_FACE.Top) as FeatureFace,
    featureHeight: floor.featureHeight[index] ?? 0,
    terrain: (floor.terrain[index] ?? TERRAIN.Floor) as TerrainType,
    height: floor.height[index] ?? 0,
    zone: (floor.zones[index] ?? ZONE.None) as ZoneType,
  };
}

function floorIndex(floor: GeneratedFloor, wx: number, wy: number): number | null {
  if (wx < floor.bounds.minX || wx > floor.bounds.maxX || wy < floor.bounds.minY || wy > floor.bounds.maxY) return null;
  return (wy - floor.bounds.minY) * floor.bounds.width + wx - floor.bounds.minX;
}

function boundaryCell(floor: GeneratedFloor): FiniteFloorCell {
  const voidTerrain = floor.voidTerrain;
  return {
    tile: (voidTerrain ? TILE.Void : TILE.Bedrock) as TileType, feature: TILE.Floor,
    featureFace: FEATURE_FACE.Top, featureHeight: 0,
    terrain: (voidTerrain ? TERRAIN.Void : TERRAIN.Floor) as TerrainType,
    height: voidTerrain ? 0 : 2, zone: ZONE.None,
  };
}
