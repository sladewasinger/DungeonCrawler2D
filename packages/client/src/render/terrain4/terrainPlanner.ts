import type { Point } from "../view/viewTransform.js";
import { viewTileToWorld, worldTileToView } from "../view/viewTransform.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { appendTerrain4AmbientOcclusion, appendTerrain4CliffEdges } from "./geometry/terrain4CliffGeometry.js";

export * from "./geometry/terrainPlannerModel.js";
import { TERRAIN4, TERRAIN4_HEIGHT_EPSILON } from "./geometry/terrainPlannerModel.js";
import type {
  Terrain4AOQuad, Terrain4CliffEdgeQuad, Terrain4FeatureQuad, Terrain4FloorQuad,
  Terrain4Plan, Terrain4PlanOptions, Terrain4PropQuad, Terrain4QuadVertices, Terrain4Rect, Terrain4Source,
  Terrain4SouthFaceQuad, Terrain4VoidQuad,
} from "./geometry/terrainPlannerModel.js";

/**
 * Produces the height-map renderer's minimal geometry in view space.
 *
 * Void produces only a flat cap quad. A vertical face is similarly strict:
 * both cells must be finite Floor surfaces, and only a positive drop toward
 * view-south emits a face. Mapping the south neighbor through view space makes
 * the same rule work for all four cardinal camera orientations.
 */
export function planTerrain4(source: Terrain4Source, options: Terrain4PlanOptions): Terrain4Plan {
  assertRect(options.bounds, "bounds");
  const seamApron = options.seamApron ?? 1;
  if (!Number.isInteger(seamApron) || seamApron < 0) {
    throw new Error("seamApron must be a non-negative integer");
  }

  const floors: Terrain4FloorQuad[] = [];
  const voids: Terrain4VoidQuad[] = [];
  const features: Terrain4FeatureQuad[] = [];
  const props: Terrain4PropQuad[] = [];
  const southFaces: Terrain4SouthFaceQuad[] = [];
  const cliffEdges: Terrain4CliffEdgeQuad[] = [];
  const ao: Terrain4AOQuad[] = [];
  const { bounds, orientation } = options;

  for (let worldY = bounds.y; worldY < bounds.y + bounds.height; worldY += 1) {
    for (let worldX = bounds.x; worldX < bounds.x + bounds.width; worldX += 1) {
      appendTileGeometry(source, { x: worldX, y: worldY }, orientation, floors, voids, features, props, southFaces, cliffEdges, ao);
    }
  }

  return {
    bounds,
    sampleBounds: expandRect(bounds, seamApron),
    orientation,
    batches: { floors, voids, features, props, southFaces, cliffEdges, ao },
  };
}

function appendTileGeometry(
  source: Terrain4Source,
  worldTile: Point,
  orientation: ViewOrientation,
  floors: Terrain4FloorQuad[],
  voids: Terrain4VoidQuad[],
  features: Terrain4FeatureQuad[],
  props: Terrain4PropQuad[],
  southFaces: Terrain4SouthFaceQuad[],
  cliffEdges: Terrain4CliffEdgeQuad[],
  ao: Terrain4AOQuad[],
): void {
  const terrain = source.terrainAt(worldTile.x, worldTile.y);
  const viewTile = worldTileToView(worldTile, orientation);
  if (terrain === TERRAIN4.Void) {
    voids.push({ kind: "void", worldTile, viewTile, vertices: topQuad(viewTile, 0) });
    return;
  }
  if (terrain !== TERRAIN4.Floor) return;
  const height = finiteHeight(source, worldTile);
  appendFloorArt(source, worldTile, viewTile, height, floors, features, props);
  appendTerrain4CliffEdges(source, worldTile, viewTile, orientation, height, cliffEdges);
  appendTerrain4AmbientOcclusion(source, worldTile, viewTile, orientation, height, ao);

  // Express the adjacent screen-south cell in view space, then map it back to
  // world space. This is intentionally not `worldY + 1` at 90/180/270.
  const southWorld = viewTileToWorld({ x: viewTile.x, y: viewTile.y + 1 }, orientation);
  if (source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN4.Floor) return;
  const southHeight = finiteHeight(source, southWorld);
  if (height - southHeight <= TERRAIN4_HEIGHT_EPSILON) return;
  southFaces.push({
    kind: "south-face", worldTile, viewTile, topHeight: height, bottomHeight: southHeight,
    vertices: southFaceQuad(viewTile, height, southHeight),
  });
}

function appendFloorArt(
  source: Terrain4Source,
  worldTile: Point,
  viewTile: Point,
  height: number,
  floors: Terrain4FloorQuad[],
  features: Terrain4FeatureQuad[],
  props: Terrain4PropQuad[],
): void {
  const vertices = topQuad(viewTile, height);
  const feature = source.featureAt?.(worldTile.x, worldTile.y) ?? null;
  const prop = source.propAt?.(worldTile.x, worldTile.y) ?? null;
  if (feature) features.push({ kind: "feature", feature, worldTile, viewTile, height, vertices });
  else if (prop) props.push({ kind: "prop", prop, worldTile, viewTile, height, vertices });
  else floors.push({ kind: "floor", worldTile, viewTile, height, vertices });
}

function finiteHeight(source: Terrain4Source, tile: Point): number {
  const height = source.heightAt(tile.x, tile.y);
  if (!Number.isFinite(height)) {
    throw new Error(`Floor at (${tile.x}, ${tile.y}) has a non-finite height`);
  }
  return height;
}

function topQuad(tile: Point, height: number): Terrain4QuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ];
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number): Terrain4QuadVertices {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight },
    { x: tile.x, y: southY, z: bottomHeight },
  ];
}

function expandRect(rect: Terrain4Rect, apron: number): Terrain4Rect {
  return {
    x: rect.x - apron,
    y: rect.y - apron,
    width: rect.width + apron * 2,
    height: rect.height + apron * 2,
  };
}

function assertRect(rect: Terrain4Rect, name: string): void {
  if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y) ||
      !Number.isInteger(rect.width) || !Number.isInteger(rect.height) ||
      rect.width < 0 || rect.height < 0) {
    throw new Error(`${name} must have integer coordinates and non-negative dimensions`);
  }
}
