import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  type TerrainAOQuad,
  type TerrainAOMask,
  type TerrainCliffEdgeQuad,
  type TerrainCliffSide,
  type TerrainQuarterTurn,
  type TerrainQuadVertices,
  type TerrainSource,
} from "./terrainPlannerModel.js";

const FLOOR = "floor";
const FLOOR_EDGE_MIN_DROP = 0.1;

const VIEW_SIDES: readonly { readonly side: TerrainCliffSide; readonly dx: number; readonly dy: number }[] = [
  { side: "north", dx: 0, dy: -1 },
  { side: "east", dx: 1, dy: 0 },
  { side: "south", dx: 0, dy: 1 },
  { side: "west", dx: -1, dy: 0 },
];

interface TerrainTileContext {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly orientation: ViewOrientation;
  readonly height: number;
  readonly voidTerrain: boolean;
}

export function appendTerrainCliffEdges(
  context: TerrainTileContext,
  target: TerrainCliffEdgeQuad[],
): void {
  const edges = boundarySides(context);
  if (edges.length === 0) return;
  const vertices = topQuad(context.viewTile, context.height);
  if (edges.length === 2 && areAdjacentSides(edges[0]!.side, edges[1]!.side) && edges[0]!.voidBoundary === edges[1]!.voidBoundary) {
    target.push(cornerEdge(context, edges, vertices));
    return;
  }
  for (const edge of edges) target.push(middleEdge(context, edge, vertices));
}

export function appendTerrainAmbientOcclusion(
  context: TerrainTileContext,
  target: TerrainAOQuad[],
): void {
  const mask = aoMask(context);
  if (!Object.values(mask).some(Boolean)) return;
  target.push({ ...context, kind: "ao", surface: "floor", mask, vertices: topQuad(context.viewTile, context.height) });
}

function boundarySides(context: TerrainTileContext): BoundarySide[] {
  return VIEW_SIDES.flatMap(({ side, dx, dy }): BoundarySide[] => {
    if (context.voidTerrain && context.source.voidBoundaryAt?.(context.worldTile.x, context.worldTile.y) !== "flat" &&
        isVoidNeighbor(context, { x: dx, y: dy })) return [{ side, voidBoundary: true }];
    if (isLowerFloor(context, { x: dx, y: dy })) return [{ side, voidBoundary: false }];
    return [];
  });
}

function cornerEdge(
  context: TerrainTileContext, edges: BoundarySide[], vertices: TerrainQuadVertices,
): TerrainCliffEdgeQuad {
  return {
    ...context, kind: "cliff-edge", cliff: "corner", rotation: cornerRotation(edges[0]!.side, edges[1]!.side),
    sides: edges.map(({ side }) => side), voidBoundary: edges[0]!.voidBoundary, vertices,
  };
}

function middleEdge(
  context: TerrainTileContext, edge: BoundarySide, vertices: TerrainQuadVertices,
): TerrainCliffEdgeQuad {
  return { ...context, kind: "cliff-edge", cliff: "middle", rotation: middleRotation(edge.side), sides: [edge.side], voidBoundary: edge.voidBoundary, vertices };
}

interface BoundarySide { readonly side: TerrainCliffSide; readonly voidBoundary: boolean; }

function aoMask(context: TerrainTileContext): TerrainAOMask {
  const north = isHigherFloor(context, { x: 0, y: -1 });
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
  context: TerrainTileContext,
  { offset, blockedA, blockedB }: { readonly offset: Point; readonly blockedA: boolean; readonly blockedB: boolean },
): boolean {
  return !blockedA && !blockedB && isHigherFloor(context, offset);
}

function isHigherFloor(context: TerrainTileContext, offset: Point): boolean {
  return hasHeightDifference(context, offset, 1);
}

function isLowerFloor(context: TerrainTileContext, offset: Point): boolean {
  return hasHeightDifference(context, offset, -1);
}

function isVoidNeighbor(context: TerrainTileContext, offset: Point): boolean {
  const neighbor = viewTileToWorld({ x: context.viewTile.x + offset.x, y: context.viewTile.y + offset.y }, context.orientation);
  return context.source.terrainAt(neighbor.x, neighbor.y) === "void";
}

function hasHeightDifference(context: TerrainTileContext, offset: Point, sign: 1 | -1): boolean {
  const neighbor = viewTileToWorld({ x: context.viewTile.x + offset.x, y: context.viewTile.y + offset.y }, context.orientation);
  if (context.source.terrainAt(neighbor.x, neighbor.y) !== FLOOR) return false;
  const difference = (context.source.heightAt(neighbor.x, neighbor.y) - context.height) * sign;
  return Number.isFinite(difference) && difference >= FLOOR_EDGE_MIN_DROP;
}

function areAdjacentSides(a: TerrainCliffSide, b: TerrainCliffSide): boolean {
  const axis = { north: 0, east: 1, south: 2, west: 3 } as const;
  const difference = Math.abs(axis[a] - axis[b]);
  return difference === 1 || difference === 3;
}

function middleRotation(side: TerrainCliffSide): TerrainQuarterTurn {
  return ({ south: 0, west: 90, north: 180, east: 270 } as const)[side];
}

function cornerRotation(a: TerrainCliffSide, b: TerrainCliffSide): TerrainQuarterTurn {
  const pair = [a, b].sort().join(":");
  return ({
    "east:south": 0,
    "south:west": 90,
    "north:west": 180,
    "east:north": 270,
  } as const)[pair as "east:south" | "south:west" | "north:west" | "east:north"] ?? 0;
}

function topQuad(tile: Point, height: number): TerrainQuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ];
}
