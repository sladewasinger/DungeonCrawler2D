import {
  FEATURE_FACE,
  floorBiomeAt,
  TERRAIN,
  TILE,
  type FeatureFace,
  type GeneratedFloor,
  type TerrainType,
  type TileType,
} from "@dc2d/engine";
import { VOID_SOUTH_FACE_MODES } from "../../render/terrain/planning/terrainPlanner.js";

export const EDITOR_VOID_SOUTH_FACE_MODE = VOID_SOUTH_FACE_MODES.OpenEdges;

export function editorFloorContains(
  floor: GeneratedFloor,
  point: { readonly x: number; readonly y: number },
): boolean {
  const { bounds } = floor;
  return point.x >= bounds.minX && point.x <= bounds.maxX &&
    point.y >= bounds.minY && point.y <= bounds.maxY;
}

export function editorFloorTerrain(floor: GeneratedFloor, x: number, y: number): TerrainType {
  return (editorFloorContains(floor, { x, y })
    ? floor.terrain[editorFloorIndex(floor, x, y)] ?? TERRAIN.Void
    : TERRAIN.Void) as TerrainType;
}

export function editorFloorTile(floor: GeneratedFloor, x: number, y: number): TileType {
  return (editorFloorContains(floor, { x, y })
    ? floor.tiles[editorFloorIndex(floor, x, y)] ?? TILE.Void
    : TILE.Void) as TileType;
}

export function editorFloorHeight(floor: GeneratedFloor, x: number, y: number): number {
  return editorFloorContains(floor, { x, y })
    ? floor.height[editorFloorIndex(floor, x, y)] ?? 0
    : 0;
}

export function editorFloorFeature(floor: GeneratedFloor, x: number, y: number): TileType {
  return (editorFloorContains(floor, { x, y })
    ? floor.features[editorFloorIndex(floor, x, y)] ?? TILE.Floor
    : TILE.Void) as TileType;
}

export function editorFloorFeatureFace(floor: GeneratedFloor, x: number, y: number): FeatureFace {
  if (!editorFloorContains(floor, { x, y })) return FEATURE_FACE.Top;
  return (floor.featureFaces[editorFloorIndex(floor, x, y)] ?? FEATURE_FACE.Top) as FeatureFace;
}

export function editorFloorFeatureHeight(floor: GeneratedFloor, x: number, y: number): number {
  return editorFloorContains(floor, { x, y })
    ? floor.featureHeight[editorFloorIndex(floor, x, y)] ?? 0
    : 0;
}

export function editorFloorTerritory(floor: GeneratedFloor, x: number, y: number): number | null {
  return editorFloorContains(floor, { x, y })
    ? floor.territory[editorFloorIndex(floor, x, y)] ?? null
    : null;
}

export function editorFloorBiome(floor: GeneratedFloor, x: number, y: number) {
  return floorBiomeAt(floor, x, y);
}

function editorFloorIndex(floor: GeneratedFloor, x: number, y: number): number {
  return (y - floor.bounds.minY) * floor.bounds.width + x - floor.bounds.minX;
}
