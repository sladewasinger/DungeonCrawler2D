import type { TerrainFeatureKind, TerrainSurface } from "../geometry/terrainPlannerModel.js";
import { territoryFloorRole, territoryWallRole, type TerrainTileRole } from "../planning/tileset.js";

export const TERRAIN_HEIGHT_EPSILON = 1e-6;

export interface TerrainWallMaterialInput {
  readonly territory: number | null | undefined;
  readonly voidWall?: boolean | undefined;
  readonly stairWall?: boolean | undefined;
  readonly bedrockWall?: boolean | undefined;
  readonly topSegment?: boolean | undefined;
  readonly wallFeature?: { readonly feature: TerrainFeatureKind; readonly topHeight: number } | undefined;
}

export interface TerrainWallSegment {
  readonly bottom: number;
  readonly height: number;
}

export function terrainFloorRole(
  surface: TerrainSurface,
  territory: number | null | undefined,
  useTerritory = true,
): TerrainTileRole {
  if (surface === "bedrock") return "bedrock";
  return useTerritory ? territoryFloorRole(territory) : "floor";
}

export function terrainWallRole(input: TerrainWallMaterialInput, segmentTop: number): TerrainTileRole {
  if (input.wallFeature && approximatelyEqual(input.wallFeature.topHeight, segmentTop)) {
    return input.wallFeature.feature;
  }
  if (input.voidWall === true || input.bedrockWall === true) return "void-wall-face";
  if (input.stairWall === true) return "stair-wall-face";
  const role = territoryWallRole(input.territory);
  if (input.topSegment === false && role !== "territory-gaol-wall") return "south-face";
  return role;
}

/** Splits a wall face at unit boundaries so material and UV seams stay aligned. */
export function terrainWallSegments(bottomHeight: number, topHeight: number): TerrainWallSegment[] {
  const segments: TerrainWallSegment[] = [];
  let bottom = bottomHeight;
  while (topHeight - bottom > TERRAIN_HEIGHT_EPSILON) {
    const top = Math.min(topHeight, nextUnitHeight(bottom));
    segments.push({ bottom, height: top - bottom });
    bottom = top;
  }
  if (isUnitHeight(topHeight) && !isUnitHeight(bottomHeight)) segments.reverse();
  return segments;
}

function nextUnitHeight(height: number): number {
  const nearest = Math.round(height);
  return isUnitHeight(height) ? nearest + 1 : Math.ceil(height);
}

function isUnitHeight(height: number): boolean {
  return approximatelyEqual(height, Math.round(height));
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= TERRAIN_HEIGHT_EPSILON;
}
