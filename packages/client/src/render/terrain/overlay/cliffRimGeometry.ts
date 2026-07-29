import type { TerrainScreenPoint } from "../batch/quadBatch.js";
import type { TerrainCliffSide } from "../geometry/terrainPlannerModel.js";
import {
  projectedUnitPoint,
  projectedUnitRect,
  type ProjectedTerrainQuad,
  type UnitBounds,
  type UnitPoint,
} from "./projectedTerrainQuad.js";

export type CliffRimCorner = "nw" | "ne" | "se" | "sw";

interface RimSideRequest {
  readonly points: ProjectedTerrainQuad;
  readonly side: TerrainCliffSide;
  readonly width: number;
  readonly corners: readonly CliffRimCorner[];
  readonly radius: number;
}

interface RimCornerRequest {
  readonly points: ProjectedTerrainQuad;
  readonly corner: CliffRimCorner;
  readonly radius: number;
  readonly width: number;
  readonly segments: number;
}

const CORNER_ANGLES: Readonly<Record<
  CliffRimCorner,
  readonly [number, number]
>> = {
  nw: [Math.PI, Math.PI * 1.5],
  ne: [Math.PI * 1.5, Math.PI * 2],
  se: [0, Math.PI * 0.5],
  sw: [Math.PI * 0.5, Math.PI],
};

const CORNER_TRIMS: Readonly<Record<
  CliffRimCorner,
  Partial<Record<TerrainCliffSide, keyof UnitBounds>>
>> = {
  nw: { north: "u0", west: "v0" },
  ne: { north: "u1", east: "v0" },
  se: { south: "u1", east: "v1" },
  sw: { south: "u0", west: "v1" },
};

const CORNER_SIDES: Readonly<Record<
  CliffRimCorner,
  readonly [TerrainCliffSide, TerrainCliffSide]
>> = {
  nw: ["north", "west"],
  ne: ["north", "east"],
  se: ["south", "east"],
  sw: ["south", "west"],
};

export function outsideCornersForSides(
  sides: readonly TerrainCliffSide[],
): CliffRimCorner[] {
  const exposed = new Set(sides);
  return (Object.keys(CORNER_SIDES) as CliffRimCorner[]).filter((corner) => {
    return CORNER_SIDES[corner].every((side) => exposed.has(side));
  });
}

export function cliffRimSideBand(request: RimSideRequest): ProjectedTerrainQuad {
  return projectedUnitRect(request.points, trimmedSideBounds(request));
}

export function roundedCliffRimCorner(
  request: RimCornerRequest,
): readonly TerrainScreenPoint[] {
  const center = cornerCenter(request.corner, request.radius);
  const [start, end] = CORNER_ANGLES[request.corner];
  const outer = arcPoints({
    center, radius: request.radius, start, end, segments: request.segments,
  });
  const inner = arcPoints({
    center,
    radius: Math.max(0, request.radius - request.width),
    start: end,
    end: start,
    segments: request.segments,
  });
  return [...outer, ...inner].map((point) => {
    return projectedUnitPoint(request.points, point);
  });
}

function trimmedSideBounds(request: RimSideRequest): UnitBounds {
  let bounds = baseSideBounds(request.side, request.width);
  for (const corner of request.corners) {
    const trim = CORNER_TRIMS[corner][request.side];
    if (trim) bounds = applyTrim(bounds, trim, request.radius);
  }
  return bounds;
}

function baseSideBounds(
  side: TerrainCliffSide,
  width: number,
): UnitBounds {
  if (side === "north") return { u0: 0, v0: 0, u1: 1, v1: width };
  if (side === "south") return { u0: 0, v0: 1 - width, u1: 1, v1: 1 };
  if (side === "west") return { u0: 0, v0: 0, u1: width, v1: 1 };
  return { u0: 1 - width, v0: 0, u1: 1, v1: 1 };
}

function applyTrim(
  bounds: UnitBounds,
  trim: keyof UnitBounds,
  radius: number,
): UnitBounds {
  const fromStart = trim === "u0" || trim === "v0";
  return { ...bounds, [trim]: fromStart ? radius : 1 - radius };
}

function cornerCenter(corner: CliffRimCorner, radius: number): UnitPoint {
  return {
    u: corner === "nw" || corner === "sw" ? radius : 1 - radius,
    v: corner === "nw" || corner === "ne" ? radius : 1 - radius,
  };
}

interface ArcRequest {
  readonly center: UnitPoint;
  readonly radius: number;
  readonly start: number;
  readonly end: number;
  readonly segments: number;
}

function arcPoints(request: ArcRequest): UnitPoint[] {
  return Array.from({ length: request.segments + 1 }, (_, index) => {
    const angle = request.start +
      (request.end - request.start) * index / request.segments;
    return {
      u: request.center.u + Math.cos(angle) * request.radius,
      v: request.center.v + Math.sin(angle) * request.radius,
    };
  });
}
