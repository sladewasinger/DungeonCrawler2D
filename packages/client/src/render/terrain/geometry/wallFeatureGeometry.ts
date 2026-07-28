import type { Point } from "../../view/transform/viewTransform.js";
import {
  FEATURE_FACE,
  type FeatureFace,
} from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  TERRAIN_HEIGHT_EPSILON,
  TERRAIN_KINDS,
  type TerrainFeatureQuad,
  type TerrainQuadVertices,
  type TerrainSource,
  type TerrainSouthFaceQuad,
} from "./terrainPlannerModel.js";

interface WallFeatureRequest {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly terrainTop: number;
  readonly terrainBottom: number;
  readonly orientation: ViewOrientation;
}

interface VoidFeatureRequest {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly southWorld: Point;
  readonly southView: Point;
  readonly orientation: ViewOrientation;
}

export function isElevatedWallDoor(
  source: TerrainSource,
  tile: Point,
  fallbackHeight: number,
): boolean {
  return source.featureAt?.(tile.x, tile.y) === "door" &&
    featureFaceAt(source, tile) !== FEATURE_FACE.Top &&
    featureHeightAt(source, tile, fallbackHeight) > 0;
}

export function wallFeatureForFace(
  request: WallFeatureRequest,
): TerrainSouthFaceQuad["wallFeature"] | undefined {
  const { source, worldTile, terrainTop, terrainBottom, orientation } = request;
  if (source.featureAt?.(worldTile.x, worldTile.y) !== "door") return undefined;
  if (featureFaceAt(source, worldTile) !== screenSouthFace(orientation)) return undefined;
  const topHeight = featureHeightAt(source, worldTile, terrainTop);
  if (topHeight <= terrainBottom + TERRAIN_HEIGHT_EPSILON ||
      topHeight > terrainTop + TERRAIN_HEIGHT_EPSILON) return undefined;
  return { feature: "door", topHeight };
}

export function voidWallFeatureQuad(
  request: VoidFeatureRequest,
): TerrainFeatureQuad | null {
  const { source, worldTile, southWorld, southView, orientation } = request;
  if (source.featureAt?.(worldTile.x, worldTile.y) !== "door") return null;
  if (featureFaceAt(source, worldTile) !== screenSouthFace(orientation)) return null;
  if (source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN_KINDS.Floor) return null;
  const topHeight = featureHeightAt(source, worldTile, 1);
  return {
    kind: "feature",
    feature: "door",
    worldTile,
    viewTile: southView,
    height: topHeight,
    wallMounted: true,
    vertices: wallQuad(southView, topHeight, topHeight - 1),
  };
}

function featureFaceAt(source: TerrainSource, tile: Point): FeatureFace {
  return source.featureFaceAt?.(tile.x, tile.y) ?? FEATURE_FACE.Top;
}

function screenSouthFace(orientation: ViewOrientation): FeatureFace {
  return {
    0: FEATURE_FACE.South,
    90: FEATURE_FACE.West,
    180: FEATURE_FACE.North,
    270: FEATURE_FACE.East,
  }[orientation];
}

export function featureHeightAt(
  source: TerrainSource,
  tile: Point,
  fallback: number,
): number {
  return source.featureHeightAt?.(tile.x, tile.y) ?? fallback;
}

function wallQuad(edge: Point, topHeight: number, bottomHeight: number): TerrainQuadVertices {
  return [
    { x: edge.x, y: edge.y, z: topHeight },
    { x: edge.x + 1, y: edge.y, z: topHeight },
    { x: edge.x + 1, y: edge.y, z: bottomHeight },
    { x: edge.x, y: edge.y, z: bottomHeight },
  ];
}
