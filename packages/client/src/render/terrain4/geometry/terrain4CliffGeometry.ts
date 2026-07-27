import type { Point } from "../../view/viewTransform.js";
import { viewTileToWorld } from "../../view/viewTransform.js";
import type { ViewOrientation } from "../../view/viewOrientation.js";
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

export function appendTerrain4CliffEdges(
  source: Terrain4Source,
  worldTile: Point,
  viewTile: Point,
  orientation: ViewOrientation,
  height: number,
  target: Terrain4CliffEdgeQuad[],
): void {
  const sides = VIEW_SIDES.filter(({ dx, dy }) => {
    const neighbor = viewTileToWorld({ x: viewTile.x + dx, y: viewTile.y + dy }, orientation);
    return isLowerFloor(source, neighbor.x, neighbor.y, height);
  }).map(({ side }) => side);
  if (sides.length === 0) return;
  const vertices = topQuad(viewTile, height);
  if (sides.length === 2 && areAdjacentSides(sides[0]!, sides[1]!)) {
    target.push({
      kind: "cliff-edge", cliff: "corner", rotation: cornerRotation(sides[0]!, sides[1]!),
      worldTile, viewTile, height, sides, vertices,
    });
    return;
  }
  for (const side of sides) {
    target.push({
      kind: "cliff-edge", cliff: "middle", rotation: middleRotation(side),
      worldTile, viewTile, height, sides: [side], vertices,
    });
  }
}

export function appendTerrain4AmbientOcclusion(
  source: Terrain4Source,
  worldTile: Point,
  viewTile: Point,
  orientation: ViewOrientation,
  height: number,
  target: Terrain4AOQuad[],
): void {
  const sideAt = (dx: number, dy: number): boolean => {
    const neighbor = viewTileToWorld({ x: viewTile.x + dx, y: viewTile.y + dy }, orientation);
    return isHigherFloor(source, neighbor.x, neighbor.y, height);
  };
  const north = sideAt(0, -1);
  const south = sideAt(0, 1);
  const east = sideAt(1, 0);
  const west = sideAt(-1, 0);
  const diagonalAt = (dx: number, dy: number, blockedA: boolean, blockedB: boolean): boolean => {
    if (blockedA || blockedB) return false;
    const neighbor = viewTileToWorld({ x: viewTile.x + dx, y: viewTile.y + dy }, orientation);
    return isHigherFloor(source, neighbor.x, neighbor.y, height);
  };
  const mask: Terrain4AOMask = {
    north, south, east, west,
    nw: diagonalAt(-1, -1, north, west),
    ne: diagonalAt(1, -1, north, east),
    sw: diagonalAt(-1, 1, south, west),
    se: diagonalAt(1, 1, south, east),
  };
  if (!Object.values(mask).some(Boolean)) return;
  target.push({ kind: "ao", worldTile, viewTile, height, mask, vertices: topQuad(viewTile, height) });
}

function isHigherFloor(source: Terrain4Source, x: number, y: number, height: number): boolean {
  if (source.terrainAt(x, y) !== FLOOR) return false;
  const neighborHeight = source.heightAt(x, y);
  return Number.isFinite(neighborHeight) && neighborHeight - height >= FLOOR_EDGE_MIN_DROP;
}

function isLowerFloor(source: Terrain4Source, x: number, y: number, height: number): boolean {
  if (source.terrainAt(x, y) !== FLOOR) return false;
  const neighborHeight = source.heightAt(x, y);
  return Number.isFinite(neighborHeight) && height - neighborHeight >= FLOOR_EDGE_MIN_DROP;
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
