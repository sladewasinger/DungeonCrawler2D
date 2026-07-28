import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld, worldTileToView } from "../../view/transform/viewTransform.js";
import { appendTerrainAmbientOcclusion, appendTerrainCliffEdges } from "../geometry/cliffGeometry.js";
import { TERRAIN_KINDS, TERRAIN_HEIGHT_EPSILON } from "../geometry/terrainPlannerModel.js";
import type {
  TerrainAOQuad, TerrainCliffEdgeQuad, TerrainFeatureKind, TerrainFeatureQuad, TerrainFloorQuad,
  TerrainPropQuad, TerrainQuadVertices, TerrainSouthFaceQuad, TerrainVoidQuad,
} from "../geometry/terrainPlannerModel.js";
import type { TerrainPlanningContext } from "./terrainPlanner.js";

const VOID_FACE_DEPTH = 1;

export type MutableTerrainBatches = {
  floors: TerrainFloorQuad[]; voids: TerrainVoidQuad[]; features: TerrainFeatureQuad[];
  props: TerrainPropQuad[]; southFaces: TerrainSouthFaceQuad[]; cliffEdges: TerrainCliffEdgeQuad[]; ao: TerrainAOQuad[];
};

interface TerrainTileContext extends TerrainPlanningContext {
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly height: number;
}

export function appendPlanTiles(context: TerrainPlanningContext): void {
  const { bounds } = context;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) appendTileGeometry(context, { x, y });
  }
}

function appendTileGeometry(context: TerrainPlanningContext, worldTile: Point): void {
  const terrain = context.source.terrainAt(worldTile.x, worldTile.y);
  const viewTile = worldTileToView(worldTile, context.orientation);
  if (terrain === TERRAIN_KINDS.Void) {
    appendVoidBackdrop(context, worldTile, viewTile);
    return;
  }
  if (terrain !== TERRAIN_KINDS.Floor) return;
  const tileContext = { ...context, worldTile, viewTile, height: finiteHeight(context, worldTile) };
  appendFloorArt(tileContext);
  appendTerrainCliffEdges(tileContext, context.batches.cliffEdges);
  appendTerrainAmbientOcclusion(tileContext, context.batches.ao);
  appendScreenSouthFace(tileContext);
}

function appendVoidBackdrop(context: TerrainPlanningContext, worldTile: Point, viewTile: Point): void {
  context.batches.voids.push(voidQuad(worldTile, viewTile));
  const southView = { x: viewTile.x, y: viewTile.y + 1 };
  const southWorld = viewTileToWorld(southView, context.orientation);
  if (context.source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN_KINDS.Floor) return;
  const rows = Math.max(0, Math.floor(-finiteHeight(context, southWorld) + TERRAIN_HEIGHT_EPSILON));
  for (let offset = 1; offset <= rows; offset++) {
    const backdropView = { x: viewTile.x, y: viewTile.y + offset };
    context.batches.voids.push(voidQuad(worldTile, backdropView));
  }
}

function voidQuad(worldTile: Point, viewTile: Point): TerrainVoidQuad {
  return { kind: "void", worldTile, viewTile, vertices: topQuad(viewTile, 0) };
}

function appendFloorArt(context: TerrainTileContext): void {
  const { source, worldTile, viewTile, height, batches } = context;
  const vertices = topQuad(viewTile, height);
  const feature = source.featureAt?.(worldTile.x, worldTile.y) ?? null;
  const prop = source.propAt?.(worldTile.x, worldTile.y) ?? null;
  if (feature) batches.features.push({ kind: "feature", feature, worldTile, viewTile, height, vertices });
  else if (prop) batches.props.push({ kind: "prop", prop, worldTile, viewTile, height, vertices });
  else batches.floors.push({ kind: "floor", worldTile, viewTile, height, vertices });
}

function appendScreenSouthFace(context: TerrainTileContext): void {
  const southWorld = viewTileToWorld({ x: context.viewTile.x, y: context.viewTile.y + 1 }, context.orientation);
  const southTerrain = context.source.terrainAt(southWorld.x, southWorld.y);
  if (southTerrain === TERRAIN_KINDS.Void) {
    appendVoidSouthFace(context);
    return;
  }
  if (southTerrain === TERRAIN_KINDS.Floor) appendFloorSouthFace(context, southWorld);
}

function appendVoidSouthFace(context: TerrainTileContext): void {
  const bottomHeight = context.height - VOID_FACE_DEPTH;
  context.batches.southFaces.push({
    kind: "south-face", worldTile: context.worldTile, viewTile: context.viewTile,
    topHeight: context.height, bottomHeight, voidWall: true,
    vertices: southFaceQuad(context.viewTile, context.height, bottomHeight),
  });
}

function appendFloorSouthFace(context: TerrainTileContext, southWorld: Point): void {
  const currentFeature = featureAt(context, context.worldTile);
  const southFeature = featureAt(context, southWorld);
  const bottomHeight = finiteHeight(context, southWorld);
  if (context.height - bottomHeight <= TERRAIN_HEIGHT_EPSILON) return;
  const stairWall = currentFeature === "stairs";
  context.batches.southFaces.push({
    kind: "south-face", worldTile: context.worldTile, viewTile: context.viewTile,
    topHeight: context.height, bottomHeight, stairWall,
    southNeighborIsStair: southFeature === "stairs",
    vertices: southFaceQuad(context.viewTile, context.height, bottomHeight),
  });
}

function featureAt(context: TerrainPlanningContext, tile: Point): TerrainFeatureKind | null {
  return context.source.featureAt ? context.source.featureAt(tile.x, tile.y) : null;
}

function finiteHeight(context: TerrainPlanningContext, tile: Point): number {
  const height = context.source.heightAt(tile.x, tile.y);
  if (!Number.isFinite(height)) throw new Error(`Floor at (${tile.x}, ${tile.y}) has a non-finite height`);
  return height;
}

function topQuad(tile: Point, height: number): TerrainQuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height }, { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height }, { x: tile.x, y: tile.y + 1, z: height },
  ];
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number): TerrainQuadVertices {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight }, { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight }, { x: tile.x, y: southY, z: bottomHeight },
  ];
}
