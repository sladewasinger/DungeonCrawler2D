import type { Point } from "../view/viewTransform.js";
import { viewTileToWorld, worldTileToView } from "../view/viewTransform.js";
import { appendTerrain4AmbientOcclusion, appendTerrain4CliffEdges } from "./geometry/terrain4CliffGeometry.js";
import { TERRAIN4, TERRAIN4_HEIGHT_EPSILON } from "./geometry/terrainPlannerModel.js";
import type {
  Terrain4AOQuad, Terrain4CliffEdgeQuad, Terrain4FeatureQuad, Terrain4FloorQuad,
  Terrain4PropQuad, Terrain4QuadVertices, Terrain4SouthFaceQuad, Terrain4VoidQuad,
} from "./geometry/terrainPlannerModel.js";
import type { Terrain4PlanningContext } from "./terrainPlanner.js";

export type MutableTerrain4Batches = {
  floors: Terrain4FloorQuad[]; voids: Terrain4VoidQuad[]; features: Terrain4FeatureQuad[];
  props: Terrain4PropQuad[]; southFaces: Terrain4SouthFaceQuad[]; cliffEdges: Terrain4CliffEdgeQuad[]; ao: Terrain4AOQuad[];
};

interface Terrain4TileContext extends Terrain4PlanningContext {
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly height: number;
}

export function appendPlanTiles(context: Terrain4PlanningContext): void {
  const { bounds } = context;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) appendTileGeometry(context, { x, y });
  }
}

function appendTileGeometry(context: Terrain4PlanningContext, worldTile: Point): void {
  const terrain = context.source.terrainAt(worldTile.x, worldTile.y);
  const viewTile = worldTileToView(worldTile, context.orientation);
  if (terrain === TERRAIN4.Void) {
    context.batches.voids.push({ kind: "void", worldTile, viewTile, vertices: topQuad(viewTile, 0) });
    return;
  }
  if (terrain !== TERRAIN4.Floor) return;
  const tileContext = { ...context, worldTile, viewTile, height: finiteHeight(context, worldTile) };
  appendFloorArt(tileContext);
  appendTerrain4CliffEdges(tileContext, context.batches.cliffEdges);
  appendTerrain4AmbientOcclusion(tileContext, context.batches.ao);
  appendSouthFace(tileContext);
}

function appendFloorArt(context: Terrain4TileContext): void {
  const { source, worldTile, viewTile, height, batches } = context;
  const vertices = topQuad(viewTile, height);
  const feature = source.featureAt?.(worldTile.x, worldTile.y) ?? null;
  const prop = source.propAt?.(worldTile.x, worldTile.y) ?? null;
  if (feature) batches.features.push({ kind: "feature", feature, worldTile, viewTile, height, vertices });
  else if (prop) batches.props.push({ kind: "prop", prop, worldTile, viewTile, height, vertices });
  else batches.floors.push({ kind: "floor", worldTile, viewTile, height, vertices });
}

function appendSouthFace(context: Terrain4TileContext): void {
  const southWorld = viewTileToWorld({ x: context.viewTile.x, y: context.viewTile.y + 1 }, context.orientation);
  if (context.source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN4.Floor) return;
  const bottomHeight = finiteHeight(context, southWorld);
  if (context.height - bottomHeight <= TERRAIN4_HEIGHT_EPSILON) return;
  context.batches.southFaces.push({
    kind: "south-face", worldTile: context.worldTile, viewTile: context.viewTile,
    topHeight: context.height, bottomHeight, vertices: southFaceQuad(context.viewTile, context.height, bottomHeight),
  });
}

function finiteHeight(context: Terrain4PlanningContext, tile: Point): number {
  const height = context.source.heightAt(tile.x, tile.y);
  if (!Number.isFinite(height)) throw new Error(`Floor at (${tile.x}, ${tile.y}) has a non-finite height`);
  return height;
}

function topQuad(tile: Point, height: number): Terrain4QuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height }, { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height }, { x: tile.x, y: tile.y + 1, z: height },
  ];
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number): Terrain4QuadVertices {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight }, { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight }, { x: tile.x, y: southY, z: bottomHeight },
  ];
}
