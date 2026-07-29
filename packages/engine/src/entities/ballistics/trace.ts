import type { WorldView } from "../../world/core/types.js";
import {
  sampleBallisticFlight,
} from "./resolution.js";
import type {
  BallisticFlight,
  BallisticPoint,
} from "./contract.js";

export interface BallisticTraceRequest {
  readonly world: WorldView;
  readonly flight: BallisticFlight;
  readonly endTime?: number;
  readonly segments?: number;
}

export interface BallisticTrace {
  readonly points: readonly BallisticPoint[];
  /** First terrain point reached by the shared simulation/preview trace. */
  readonly impact?: BallisticPoint;
  readonly elapsed: number;
}

/**
 * Traces the resolved throw through terrain. The server and client call this
 * same function, so a guide terminates at the first impact the simulation uses.
 */
export function traceBallisticFlight(
  request: BallisticTraceRequest,
): BallisticTrace {
  const startTime = request.flight.elapsed;
  const endTime = traceEndTime(request.flight, request.endTime);
  const start = sampleBallisticFlight(request.flight, startTime);
  const segments = traceSegmentCount(request, start, endTime);
  return traceSegments({ ...request, start, startTime, endTime, segments });
}

/** Returns the trace endpoint or fails loudly if a malformed trace has no points. */
export function lastBallisticTracePoint(trace: BallisticTrace): BallisticPoint {
  const point = trace.points[trace.points.length - 1];
  if (point === undefined) throw new Error("Ballistic trace must contain its launch point");
  return point;
}

function traceEndTime(flight: BallisticFlight, requested: number | undefined): number {
  const endTime = requested ?? flight.duration;
  return Math.max(flight.elapsed, Math.min(endTime, flight.duration));
}

function traceSegmentCount(
  request: BallisticTraceRequest,
  start: BallisticPoint,
  endTime: number,
): number {
  const end = sampleBallisticFlight(request.flight, endTime);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const terrainSegments = Math.ceil(distance / 0.125);
  return Math.max(1, request.segments ?? 0, terrainSegments);
}

interface SegmentTraceRequest extends BallisticTraceRequest {
  readonly start: BallisticPoint;
  readonly startTime: number;
  readonly endTime: number;
  readonly segments: number;
}

function traceSegments(request: SegmentTraceRequest): BallisticTrace {
  const points: BallisticPoint[] = [request.start];
  const duration = request.endTime - request.startTime;
  for (let index = 1; index <= request.segments; index++) {
    const elapsed = request.startTime + duration * (index / request.segments);
    const point = sampleBallisticFlight(request.flight, elapsed);
    const impact = terrainImpact(request.world, lastPoint(points), point);
    if (impact) return impactTrace(points, impact, elapsed);
    points.push(point);
  }
  return { points, elapsed: request.endTime };
}

function impactTrace(
  points: readonly BallisticPoint[],
  impact: BallisticPoint,
  elapsed: number,
): BallisticTrace {
  const finalPoints = samePoint(lastPoint(points), impact) ? points : [...points, impact];
  return { points: finalPoints, impact, elapsed };
}

function lastPoint(points: readonly BallisticPoint[]): BallisticPoint {
  const point = points[points.length - 1];
  if (point === undefined) throw new Error("Ballistic trace must contain a point");
  return point;
}

function terrainImpact(
  world: WorldView,
  previous: BallisticPoint,
  point: BallisticPoint,
): BallisticPoint | undefined {
  const tileX = Math.floor(point.x);
  const tileY = Math.floor(point.y);
  if (!world.isWalkable(tileX, tileY) && world.heightAt(tileX, tileY) <= 0) return previous;
  const terrain = world.groundAt(point.x, point.y);
  return point.z <= terrain ? { ...point, z: terrain } : undefined;
}

function samePoint(left: BallisticPoint, right: BallisticPoint): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}
