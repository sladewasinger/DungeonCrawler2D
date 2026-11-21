import { FEATURE_FACE, type AdminMap, type AdminMapCell, type BiomeKind, type FeatureFace } from "@dc2d/engine";
import {
  TERRAIN_KINDS,
  TERRAIN_SURFACES,
  type TerrainSource,
} from "../../../render/terrain/planning/terrainPlanner.js";
import { terrainFeatureForTile, terrainPropForTile } from "../../../render/terrain/planning/tileFeatures.js";

export interface SpectatorTerrainSource {
  readonly source: TerrainSource;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly biomeAt: (x: number, y: number) => BiomeKind;
}

export function createSpectatorTerrainSource(map: AdminMap): SpectatorTerrainSource {
  const cells = new Map(map.cells.map((cell) => [cellKey(cell.x, cell.y), cell]));
  const bounds = mapBounds(map.cells);
  const cellAt = (x: number, y: number): AdminMapCell | undefined => cells.get(cellKey(x, y));
  const biomeAt = (x: number, y: number): BiomeKind => cellAt(x, y)?.biome ?? "maze";
  return {
    bounds,
    biomeAt,
    source: {
      voidTerrain: true,
      finiteBounds: bounds,
      isInBoundsAt: (x, y) => cellAt(x, y) !== undefined,
      terrainAt: (x, y) => cellAt(x, y)?.terrain === "floor" ? TERRAIN_KINDS.Floor : TERRAIN_KINDS.Void,
      surfaceAt: (x, y) => cellSurface(cellAt(x, y)),
      heightAt: (x, y) => cellAt(x, y)?.height ?? 0,
      territoryAt: (x, y) => cellAt(x, y)?.territory ?? null,
      featureFaceAt: (x, y) => featureFaceAt(cellAt(x, y)),
      featureHeightAt: (x, y) => cellAt(x, y)?.featureHeight ?? cellAt(x, y)?.height ?? 0,
      featureAt: (x, y) => terrainFeatureForTile(cellAt(x, y)?.feature ?? 0),
      propAt: (x, y) => terrainPropForTile(cellAt(x, y)?.feature ?? 0),
    },
  };
}

function cellSurface(cell: AdminMapCell | undefined): (typeof TERRAIN_SURFACES)[keyof typeof TERRAIN_SURFACES] {
  if (cell?.surface !== undefined) return cell.surface;
  return cell?.walkable === true ? TERRAIN_SURFACES.Floor : TERRAIN_SURFACES.Bedrock;
}

function featureFaceAt(cell: AdminMapCell | undefined): FeatureFace {
  return cell?.featureFace === undefined ? FEATURE_FACE.Top : cell.featureFace as FeatureFace;
}

function mapBounds(cells: readonly AdminMapCell[]): SpectatorTerrainSource["bounds"] {
  if (cells.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = cells.map(({ x }) => x);
  const ys = cells.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
}

function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}
