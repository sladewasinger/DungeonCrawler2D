import { depthForCapOccluder } from "../../entities/presentation/depthSort.js";
import type {
  TerrainBatches,
  TerrainCliffEdgeQuad,
  TerrainCliffSide,
} from "../geometry/terrainPlannerModel.js";
import {
  outsideCornersForSides,
  type CliffRimCorner,
} from "./cliffRimGeometry.js";

export interface SideCliffRimPart {
  readonly kind: "side";
  readonly edge: TerrainCliffEdgeQuad;
  readonly side: TerrainCliffSide;
  readonly corners: readonly CliffRimCorner[];
}

export interface CornerCliffRimPart {
  readonly kind: "corner";
  readonly edge: TerrainCliffEdgeQuad;
  readonly corner: CliffRimCorner;
}

export type CliffRimPart = SideCliffRimPart | CornerCliffRimPart;

interface TileEdge {
  readonly edge: TerrainCliffEdgeQuad;
  readonly sides: readonly TerrainCliffSide[];
}

export function groupCliffRimParts(
  edges: TerrainBatches["cliffEdges"],
): Map<number, CliffRimPart[]> {
  const grouped = new Map<number, CliffRimPart[]>();
  for (const tileEdge of groupTileEdges(edges)) appendTileParts(grouped, tileEdge);
  return grouped;
}

function groupTileEdges(edges: TerrainBatches["cliffEdges"]): TileEdge[] {
  const grouped = new Map<string, TileEdge>();
  for (const edge of edges) mergeTileEdge(grouped, edge);
  return [...grouped.values()];
}

function mergeTileEdge(
  grouped: Map<string, TileEdge>,
  edge: TerrainCliffEdgeQuad,
): void {
  const key = tileEdgeKey(edge);
  const current = grouped.get(key);
  if (!current) {
    grouped.set(key, { edge, sides: [...edge.sides] });
    return;
  }
  const sides = new Set([...current.sides, ...edge.sides]);
  grouped.set(key, { edge: current.edge, sides: [...sides] });
}

function tileEdgeKey(edge: TerrainCliffEdgeQuad): string {
  const boundary = edge.voidBoundary === true ? "void" : "floor";
  return `${edge.worldTile.x}:${edge.worldTile.y}:${edge.height}:${boundary}`;
}

function appendTileParts(
  grouped: Map<number, CliffRimPart[]>,
  tileEdge: TileEdge,
): void {
  const corners = outsideCornersForSides(tileEdge.sides);
  for (const side of tileEdge.sides) {
    appendPart(grouped, edgeDepth(tileEdge.edge, side), {
      kind: "side",
      edge: tileEdge.edge,
      side,
      corners,
    });
  }
  for (const corner of corners) {
    appendPart(grouped, cornerDepth(tileEdge.edge, corner), {
      kind: "corner",
      edge: tileEdge.edge,
      corner,
    });
  }
}

function appendPart(
  grouped: Map<number, CliffRimPart[]>,
  depth: number,
  part: CliffRimPart,
): void {
  const parts = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, parts);
  parts.push(part);
}

function cornerDepth(
  edge: TerrainCliffEdgeQuad,
  corner: CliffRimCorner,
): number {
  return Math.max(...cornerSides(corner).map((side) => edgeDepth(edge, side)));
}

function cornerSides(corner: CliffRimCorner): readonly TerrainCliffSide[] {
  return {
    nw: ["north", "west"],
    ne: ["north", "east"],
    se: ["south", "east"],
    sw: ["south", "west"],
  }[corner] as readonly TerrainCliffSide[];
}

function edgeDepth(edge: TerrainCliffEdgeQuad, side: TerrainCliffSide): number {
  const boundaryRow = side === "south" ? edge.viewTile.y + 1 : edge.viewTile.y;
  return depthForCapOccluder(boundaryRow);
}
