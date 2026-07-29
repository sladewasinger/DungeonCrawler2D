import type { Point } from "../../view/transform/viewTransform.js";
import type {
  TerrainFeatureKind,
  TerrainFeatureQuad,
  TerrainFloorQuad,
  TerrainPropQuad,
  TerrainPropKind,
  TerrainQuadVertices,
  TerrainSource,
} from "./terrainPlannerModel.js";
import { TERRAIN_SURFACES } from "./terrainPlannerModel.js";
import { featureHeightAt, isElevatedWallDoor } from "./wallFeatureGeometry.js";

interface FeatureArtBatches {
  readonly floors: TerrainFloorQuad[];
  readonly features: TerrainFeatureQuad[];
  readonly props: TerrainPropQuad[];
}

export interface FeatureArtRequest {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly height: number;
  readonly vertices: TerrainQuadVertices;
  readonly batches: FeatureArtBatches;
}

export function appendFloorArt(request: FeatureArtRequest): void {
  const { source, worldTile, height, vertices, batches } = request;
  const feature = source.featureAt?.(worldTile.x, worldTile.y) ?? null;
  const prop = source.propAt?.(worldTile.x, worldTile.y) ?? null;
  if (isElevatedWallDoor(source, worldTile, height)) {
    batches.floors.push(floorQuad(request));
    return;
  }
  if (appendFeature(request, feature)) return;
  appendPropOrFloor(request, prop, vertices);
}

function appendFeature(
  request: FeatureArtRequest,
  feature: TerrainFeatureKind | null,
): boolean {
  if (!feature) return false;
  const { worldTile, viewTile, height, vertices, batches } = request;
  batches.features.push({
    kind: "feature", feature, worldTile, viewTile, height, vertices,
  });
  return true;
}

function appendPropOrFloor(
  request: FeatureArtRequest,
  prop: TerrainPropKind | null,
  vertices: TerrainQuadVertices,
): void {
  request.batches.floors.push(floorQuad(request));
  if (!prop) return;
  const { source, worldTile, viewTile, height, batches } = request;
  const featureFace = source.featureFaceAt?.(worldTile.x, worldTile.y);
  batches.props.push({
    kind: "prop", prop, worldTile, viewTile,
    height: featureHeightAt(source, worldTile, height),
    ...(featureFace === undefined ? {} : { featureFace }),
    vertices,
  });
}

function floorQuad(request: FeatureArtRequest): TerrainFloorQuad {
  const { source, worldTile, viewTile, height, vertices } = request;
  const surface = source.surfaceAt?.(worldTile.x, worldTile.y) ??
    TERRAIN_SURFACES.Floor;
  return { kind: "floor", surface, worldTile, viewTile, height, vertices };
}
