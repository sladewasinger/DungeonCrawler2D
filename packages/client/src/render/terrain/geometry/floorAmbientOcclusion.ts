import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type {
  TerrainAOMask,
  TerrainAOQuad,
  TerrainPresentation,
  TerrainQuadVertices,
  TerrainSource,
} from "./terrainPlannerModel.js";

const FLOOR = "floor";
const FLOOR_EDGE_MIN_DROP = 0.1;

interface FloorAmbientOcclusionContext {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly orientation: ViewOrientation;
  readonly presentation: TerrainPresentation;
  readonly height: number;
}

export function appendTerrainAmbientOcclusion(
  context: FloorAmbientOcclusionContext,
  target: TerrainAOQuad[],
): void {
  const mask = aoMask(context);
  if (!Object.values(mask).some(Boolean)) return;
  const { worldTile, viewTile, height } = context;
  target.push({
    kind: "ao", surface: "floor", worldTile, viewTile, height, mask,
    vertices: topQuad(viewTile, height),
  });
}

function aoMask(context: FloorAmbientOcclusionContext): TerrainAOMask {
  const north = isHigherFloor(context, { x: 0, y: -1 });
  if (context.presentation.mode === "inside") {
    return {
      north,
      south: false, east: false, west: false,
      nw: false, ne: false, sw: false, se: false,
    };
  }
  const south = isHigherFloor(context, { x: 0, y: 1 });
  const east = isHigherFloor(context, { x: 1, y: 0 });
  const west = isHigherFloor(context, { x: -1, y: 0 });
  return {
    north, south, east, west,
    nw: diagonalHigherFloor(context, { offset: { x: -1, y: -1 }, blockedA: north, blockedB: west }),
    ne: diagonalHigherFloor(context, { offset: { x: 1, y: -1 }, blockedA: north, blockedB: east }),
    sw: diagonalHigherFloor(context, { offset: { x: -1, y: 1 }, blockedA: south, blockedB: west }),
    se: diagonalHigherFloor(context, { offset: { x: 1, y: 1 }, blockedA: south, blockedB: east }),
  };
}

function diagonalHigherFloor(
  context: FloorAmbientOcclusionContext,
  { offset, blockedA, blockedB }: {
    readonly offset: Point;
    readonly blockedA: boolean;
    readonly blockedB: boolean;
  },
): boolean {
  return !blockedA && !blockedB && isHigherFloor(context, offset);
}

function isHigherFloor(context: FloorAmbientOcclusionContext, offset: Point): boolean {
  const neighbor = viewTileToWorld({
    x: context.viewTile.x + offset.x,
    y: context.viewTile.y + offset.y,
  }, context.orientation);
  if (context.source.terrainAt(neighbor.x, neighbor.y) !== FLOOR) return false;
  const difference = context.source.heightAt(neighbor.x, neighbor.y) - context.height;
  return Number.isFinite(difference) && difference >= FLOOR_EDGE_MIN_DROP;
}

function topQuad(tile: Point, height: number): TerrainQuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ];
}
