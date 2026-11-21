import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld, worldTileToView } from "../../view/transform/viewTransform.js";
import { appendTerrainCliffEdges } from "../geometry/cliffGeometry.js";
import { appendTerrainAmbientOcclusion } from "../geometry/floorAmbientOcclusion.js";
import { appendFloorArt } from "../geometry/featureArt.js";
import { voidWallFeatureQuad } from "../geometry/wallFeatureGeometry.js";
import {
  appendInsideVoidGeometry,
  shouldCullInsideWall,
} from "../geometry/insideRoomGeometry.js";
import { TERRAIN_KINDS, TERRAIN_HEIGHT_EPSILON } from "../geometry/terrainPlannerModel.js";
import type {
  TerrainAOQuad, TerrainCliffEdgeQuad, TerrainFeatureQuad, TerrainFloorQuad,
  TerrainPropQuad, TerrainQuadVertices, TerrainSouthFaceQuad, TerrainVoidQuad,
} from "../geometry/terrainPlannerModel.js";
import {
  appendScreenSouthFace,
  finiteTerrainHeight,
} from "../geometry/walls/southFaceGeometry.js";
import type { TerrainPlanningContext } from "./terrainPlanner.js";

export type MutableTerrainBatches = {
  floors: TerrainFloorQuad[]; voids: TerrainVoidQuad[]; features: TerrainFeatureQuad[];
  props: TerrainPropQuad[]; southFaces: TerrainSouthFaceQuad[]; cliffEdges: TerrainCliffEdgeQuad[]; ao: TerrainAOQuad[];
};

export function appendPlanTiles(context: TerrainPlanningContext): void {
  const { bounds } = context;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      if (context.source.isInBoundsAt?.(x, y) === false) continue;
      appendTileGeometry(context, { x, y });
    }
  }
}

function appendTileGeometry(context: TerrainPlanningContext, worldTile: Point): void {
  const terrain = context.source.terrainAt(worldTile.x, worldTile.y);
  const viewTile = worldTileToView(worldTile, context.orientation);
  if (terrain === TERRAIN_KINDS.Void) {
    if (appendInsideVoidGeometry(context, worldTile, viewTile)) return;
    appendVoidBackdrop(context, worldTile, viewTile);
    return;
  }
  if (terrain !== TERRAIN_KINDS.Floor) return;
  const tileContext = { ...context, worldTile, viewTile, height: finiteTerrainHeight(context, worldTile) };
  if (shouldCullInsideWall(tileContext)) return;
  appendFloorArt({ ...tileContext, vertices: topQuad(viewTile, tileContext.height) });
  appendTerrainCliffEdges(tileContext, context.batches.cliffEdges);
  appendTerrainAmbientOcclusion(tileContext, context.batches.ao);
  appendScreenSouthFace(tileContext);
}

function appendVoidBackdrop(context: TerrainPlanningContext, worldTile: Point, viewTile: Point): void {
  context.batches.voids.push(voidQuad(worldTile, viewTile));
  const southView = { x: viewTile.x, y: viewTile.y + 1 };
  const southWorld = viewTileToWorld(southView, context.orientation);
  const wallFeature = voidWallFeatureQuad({
    source: context.source, worldTile, southWorld, southView,
    orientation: context.orientation,
  });
  if (wallFeature) context.batches.features.push(wallFeature);
  if (context.source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN_KINDS.Floor) return;
  const rows = Math.max(0, Math.floor(-finiteTerrainHeight(context, southWorld) + TERRAIN_HEIGHT_EPSILON));
  for (let offset = 1; offset <= rows; offset++) {
    const backdropView = { x: viewTile.x, y: viewTile.y + offset };
    context.batches.voids.push(voidQuad(worldTile, backdropView));
  }
}

function voidQuad(worldTile: Point, viewTile: Point): TerrainVoidQuad {
  return { kind: "void", worldTile, viewTile, vertices: topQuad(viewTile, 0) };
}

function topQuad(tile: Point, height: number): TerrainQuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height }, { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height }, { x: tile.x, y: tile.y + 1, z: height },
  ];
}
