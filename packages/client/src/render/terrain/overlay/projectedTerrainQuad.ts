import type { TerrainScreenPoint } from "../batch/quadBatch.js";
import type { TerrainQuadVertices } from "../geometry/terrainPlannerModel.js";

export type ProjectedTerrainQuad = readonly [
  TerrainScreenPoint,
  TerrainScreenPoint,
  TerrainScreenPoint,
  TerrainScreenPoint,
];

export interface UnitPoint {
  readonly u: number;
  readonly v: number;
}

export interface UnitBounds {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export function projectTerrainQuad(
  vertices: TerrainQuadVertices,
  project: (point: TerrainQuadVertices[number]) => TerrainScreenPoint,
): ProjectedTerrainQuad {
  return [
    project(vertices[0]),
    project(vertices[1]),
    project(vertices[2]),
    project(vertices[3]),
  ];
}

export function projectedUnitRect(
  points: ProjectedTerrainQuad,
  bounds: UnitBounds,
): ProjectedTerrainQuad {
  return [
    projectedUnitPoint(points, { u: bounds.u0, v: bounds.v0 }),
    projectedUnitPoint(points, { u: bounds.u1, v: bounds.v0 }),
    projectedUnitPoint(points, { u: bounds.u1, v: bounds.v1 }),
    projectedUnitPoint(points, { u: bounds.u0, v: bounds.v1 }),
  ];
}

export function projectedUnitPoint(
  [tl, tr, br, bl]: ProjectedTerrainQuad,
  point: UnitPoint,
): TerrainScreenPoint {
  const top = lerp(tl, tr, point.u);
  const bottom = lerp(bl, br, point.u);
  return lerp(top, bottom, point.v);
}

function lerp(
  a: TerrainScreenPoint,
  b: TerrainScreenPoint,
  amount: number,
): TerrainScreenPoint {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}
