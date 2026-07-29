// Deterministic connection points on a district's four outer borders.
// Neighboring districts hash the same logical edge, so their corridors meet.

import { hash2D, mixSeeds } from "../../../core/rng.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import type { Point, Side } from "../types.js";
import type { DistrictCoordinate } from "./district.js";

const CORRIDOR_TUNING = WORLD_GENERATION_TUNING.corridors;
const VERTICAL_EDGE_SALT = 0xed6e;
const HORIZONTAL_EDGE_SALT = 0xed6f;

export interface EdgeAnchor {
  readonly side: Side;
  readonly point: Point;
  readonly width: number;
}

interface EdgeIdentity {
  readonly x: number;
  readonly y: number;
  readonly salt: number;
}

interface DistrictEdgeRequest extends DistrictCoordinate {
  readonly seed: number;
  readonly districtSize: number;
}

function edgeOffset(seed: number, edge: EdgeIdentity, span: number): number {
  const margin = CORRIDOR_TUNING.edgeAnchorMargin;
  return margin + hash2D(mixSeeds(seed, edge.salt), edge.x, edge.y) % span;
}

function edgeWidth(seed: number, edge: EdgeIdentity): number {
  const { min, max } = CORRIDOR_TUNING.districtEdgeWidth;
  const hash = hash2D(mixSeeds(seed, edge.salt ^ 0x7777), edge.x, edge.y);
  return min + hash % (max - min + 1);
}

function anchor(
  request: DistrictEdgeRequest,
  side: Side,
  edge: EdgeIdentity,
): EdgeAnchor {
  const margin = CORRIDOR_TUNING.edgeAnchorMargin;
  const span = request.districtSize - margin * 2;
  const offset = edgeOffset(request.seed, edge, span);
  const last = request.districtSize - 1;
  const point = side === 0 || side === 2
    ? { x: offset, y: side === 0 ? 0 : last }
    : { x: side === 3 ? 0 : last, y: offset };
  return { side, point, width: edgeWidth(request.seed, edge) };
}

/** Four district-local border anchors in north, east, south, west order. */
export function districtEdgeAnchors(
  request: DistrictEdgeRequest,
): EdgeAnchor[] {
  const north = {
    x: request.dx,
    y: request.dy - 1,
    salt: HORIZONTAL_EDGE_SALT,
  };
  const east = {
    x: request.dx,
    y: request.dy,
    salt: VERTICAL_EDGE_SALT,
  };
  const south = {
    x: request.dx,
    y: request.dy,
    salt: HORIZONTAL_EDGE_SALT,
  };
  const west = {
    x: request.dx - 1,
    y: request.dy,
    salt: VERTICAL_EDGE_SALT,
  };
  return [
    anchor(request, 0, north),
    anchor(request, 1, east),
    anchor(request, 2, south),
    anchor(request, 3, west),
  ];
}
