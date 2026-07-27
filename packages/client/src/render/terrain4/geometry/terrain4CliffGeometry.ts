import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  type Terrain4AOQuad,
  type Terrain4AOMask,
  type Terrain4CliffEdgeQuad,
  type Terrain4CliffSide,
  type Terrain4QuarterTurn,
  type Terrain4QuadVertices,
  type Terrain4Source,
} from "./terrainPlannerModel.js";

const FLOOR = "floor";
const FLOOR_EDGE_MIN_DROP = 0.1;

const VIEW_SIDES: readonly { readonly side: Terrain4CliffSide; readonly dx: number; readonly dy: number }[] = [
  { side: "north", dx: 0, dy: -1 },
  { side: "east", dx: 1, dy: 0 },
  { side: "south", dx: 0, dy: 1 },
  { side: "west", dx: -1, dy: 0 },
];

interface Terrain4TileContext {
  readonly source: Terrain4Source;
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly orientation: ViewOrientation;
  readonly height: number;
}

export function appendTerrain4CliffEdges(
  context: Terrain4TileContext,
  target: Terrain4CliffEdgeQuad[],
): void {
  const sides = lowerFloorSides(context);
  if (sides.length === 0) return;
  const vertices = topQuad(context.viewTile, context.height);
  if (sides.length === 2 && areAdjacentSides(sides[0]!, sides[1]!)) {
    target.push(cornerEdge(context, sides, vertices));
    return;
  }
  for (const side of sides) {
    target.push(middleEdge(context, side, vertices));
  }
}

export function appendTerrain4AmbientOcclusion(
  context: Terrain4TileContext,
  target: Terrain4AOQuad[],
): void {
  const mask = aoMask(context);
  if (!Object.values(mask).some(Boolean)) return;
  target.push({ ...context, kind: "ao", mask, vertices: topQuad(context.viewTile, context.height) });
}

function lowerFloorSides(context: Terrain4TileContext): Terrain4CliffSide[] {
  return VIEW_SIDES.filter(({ dx, dy }) => isLowerFloor(context, { x: dx, y: dy })).map(({ side }) => side);
}

function cornerEdge(
  context: Terrain4TileContext, sides: Terrain4CliffSide[], vertices: Terrain4QuadVertices,
): Terrain4CliffEdgeQuad {
  return { ...context, kind: "cliff-edge", cliff: "corner", rotation: cornerRotation(sides[0]!, sides[1]!), sides, vertices };
}

function middleEdge(
  context: Terrain4TileContext, side: Terrain4CliffSide, vertices: Terrain4QuadVertices,
): Terrain4CliffEdgeQuad {
  return { ...context, kind: "cliff-edge", cliff: "middle", rotation: middleRotation(side), sides: [side], vertices };
}

function aoMask(context: Terrain4TileContext): Terrain4AOMask {
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
  context: Terrain4TileContext,
  { offset, blockedA, blockedB }: { readonly offset: Point; readonly blockedA: boolean; readonly blockedB: boolean },
): boolean {
  return !blockedA && !blockedB && isHigherFloor(context, offset);
}

function isHigherFloor(context: Terrain4TileContext, offset: Point): boolean {
  return hasHeightDifference(context, offset, 1);
}

function isLowerFloor(context: Terrain4TileContext, offset: Point): boolean {
  return hasHeightDifference(context, offset, -1);
}

function hasHeightDifference(context: Terrain4TileContext, offset: Point, sign: 1 | -1): boolean {
  const neighbor = viewTileToWorld({ x: context.viewTile.x + offset.x, y: context.viewTile.y + offset.y }, context.orientation);
  if (context.source.terrainAt(neighbor.x, neighbor.y) !== FLOOR) return false;
  const difference = (context.source.heightAt(neighbor.x, neighbor.y) - context.height) * sign;
  return Number.isFinite(difference) && difference >= FLOOR_EDGE_MIN_DROP;
}

function areAdjacentSides(a: Terrain4CliffSide, b: Terrain4CliffSide): boolean {
  const axis = { north: 0, east: 1, south: 2, west: 3 } as const;
  const difference = Math.abs(axis[a] - axis[b]);
  return difference === 1 || difference === 3;
}

function middleRotation(side: Terrain4CliffSide): Terrain4QuarterTurn {
  return ({ south: 0, west: 90, north: 180, east: 270 } as const)[side];
}

function cornerRotation(a: Terrain4CliffSide, b: Terrain4CliffSide): Terrain4QuarterTurn {
  const pair = [a, b].sort().join(":");
  return ({
    "east:south": 0,
    "south:west": 90,
    "north:west": 180,
    "east:north": 270,
  } as const)[pair as "east:south" | "south:west" | "north:west" | "east:north"] ?? 0;
}

function topQuad(tile: Point, height: number): Terrain4QuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ];
}
