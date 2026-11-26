/** Ground-footprint center offsets and collision shapes for props and world structures. */
import { PROP_SPECS } from "@dc2d/content";
import { PropKind } from "@dc2d/contracts";
import type { ChunkProp, WorldChunk } from "./types.js";

export interface BlockingObstacle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly elevation: number;
  readonly halfX?: number | undefined;
  readonly halfY?: number | undefined;
}

export interface GroundColliderShape {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly angleRad?: number | undefined;
  readonly elevation: number;
}

export function obstacleToColliderShape(obs: BlockingObstacle): GroundColliderShape {
  return {
    x: obs.x,
    y: obs.y,
    radius: obs.radius,
    halfX: obs.halfX ?? 0,
    halfY: obs.halfY ?? 0,
    elevation: obs.elevation,
  };
}

export interface StructureFootprintSpec {
  readonly offsetY: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly radius: number;
}

const CHEST_COLLISION = PROP_SPECS[PropKind.WoodChest].collision;
const DEFAULT_CHEST_SHAPE: StructureFootprintSpec = {
  offsetY: CHEST_COLLISION.offsetY,
  halfX: CHEST_COLLISION.halfX ?? 0.22,
  halfY: CHEST_COLLISION.halfY ?? 0.04,
  radius: CHEST_COLLISION.radius ?? 0.16,
};

/** Ground footprint used by ruined-outpost POI chests (matches wooden storage chests). */
export const POI_CHEST_OBSTACLE_SHAPE: StructureFootprintSpec = DEFAULT_CHEST_SHAPE;

export function propStructureShape(kind: PropKind): StructureFootprintSpec | undefined {
  const c = PROP_SPECS[kind].collision;
  if (c.shape !== "aabb") return undefined;
  return { offsetY: c.offsetY, halfX: c.halfX ?? 0, halfY: c.halfY ?? 0, radius: c.radius ?? 0 };
}

export function propCollisionOffsetY(kind: PropKind): number {
  return PROP_SPECS[kind].collision.offsetY;
}

export function propFootprintCenter(prop: {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
}): { readonly x: number; readonly y: number } {
  return { x: prop.x, y: prop.y + propCollisionOffsetY(prop.kind) };
}

export interface ObstacleCoreQuery {
  readonly x: number;
  readonly y: number;
  readonly halfX?: number | undefined;
  readonly halfY?: number | undefined;
  readonly segX?: number | undefined;
  readonly segY?: number | undefined;
}

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pushAxisBreaks(o: {
  readonly breaks: number[]; readonly pos: number; readonly min: number; readonly max: number; readonly step: number;
}): void {
  if (Math.abs(o.step) <= 1e-6) return;
  for (const bound of [o.min, o.max]) {
    const t = (bound - o.pos) / o.step;
    if (t > -1 && t < 1) o.breaks.push(t);
  }
}

function axisResidual(o: {
  readonly pos: number; readonly midPos: number; readonly step: number; readonly min: number; readonly max: number;
}): { readonly alpha: number; readonly beta: number } {
  if (o.midPos < o.min) return { alpha: o.pos - o.min, beta: o.step };
  if (o.midPos > o.max) return { alpha: o.pos - o.max, beta: o.step };
  return { alpha: 0, beta: 0 };
}

function intervalClosest(o: {
  readonly a: number; readonly b: number; readonly obs: BlockingObstacle; readonly pt: ObstacleCoreQuery;
}): { readonly t: number; readonly cx: number; readonly cy: number; readonly dSq: number } {
  const sx = o.pt.segX ?? 0; const sy = o.pt.segY ?? 0;
  const hx = o.obs.halfX ?? 0; const hy = o.obs.halfY ?? 0;
  const mid = 0.5 * (o.a + o.b);
  const rx = axisResidual({ pos: o.pt.x, midPos: o.pt.x + mid * sx, step: sx, min: o.obs.x - hx, max: o.obs.x + hx });
  const ry = axisResidual({ pos: o.pt.y, midPos: o.pt.y + mid * sy, step: sy, min: o.obs.y - hy, max: o.obs.y + hy });
  const denom = rx.beta * rx.beta + ry.beta * ry.beta;
  const rawT = denom > 1e-8 ? -(rx.alpha * rx.beta + ry.alpha * ry.beta) / denom : o.a;
  const t = clampVal(rawT, o.a, o.b);
  const qx = o.pt.x + t * sx; const qy = o.pt.y + t * sy;
  const cx = clampVal(qx, o.obs.x - hx, o.obs.x + hx);
  const cy = clampVal(qy, o.obs.y - hy, o.obs.y + hy);
  return { t, cx, cy, dSq: (qx - cx) * (qx - cx) + (qy - cy) * (qy - cy) };
}

function buildSegmentBreaks(obs: BlockingObstacle, pt: ObstacleCoreQuery, seg: { readonly x: number; readonly y: number }): number[] {
  const hx = obs.halfX ?? 0; const hy = obs.halfY ?? 0;
  const breaks = [-1, 1];
  pushAxisBreaks({ breaks, pos: pt.x, min: obs.x - hx, max: obs.x + hx, step: seg.x });
  pushAxisBreaks({ breaks, pos: pt.y, min: obs.y - hy, max: obs.y + hy, step: seg.y });
  return breaks.sort((p, q) => p - q);
}

function closestSegmentObstacleCore(obs: BlockingObstacle, pt: ObstacleCoreQuery, seg: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const breaks = buildSegmentBreaks(obs, pt, seg);
  let best = { t: 0, cx: obs.x, cy: obs.y, dSq: Number.POSITIVE_INFINITY };
  let prev = breaks[0] ?? -1;
  for (const b of breaks.slice(1)) {
    if (b - prev > 1e-7) {
      const cand = intervalClosest({ a: prev, b, obs, pt });
      if (cand.dSq < best.dSq) best = cand;
    }
    prev = b;
  }
  return { x: best.cx - best.t * seg.x, y: best.cy - best.t * seg.y };
}

function readQuerySeg(point: ObstacleCoreQuery): { readonly x: number; readonly y: number } {
  return { x: point.segX ?? 0, y: point.segY ?? 0 };
}

/** Clamps a query shape onto the obstacle's Minkowski core segment/rectangle. */
export function closestObstacleCorePoint(
  obs: BlockingObstacle,
  point: ObstacleCoreQuery,
): { readonly x: number; readonly y: number } {
  const seg = readQuerySeg(point);
  if (Math.abs(seg.x) > 1e-6 || Math.abs(seg.y) > 1e-6) {
    return closestSegmentObstacleCore(obs, point, seg);
  }
  const hx = (obs.halfX ?? 0) + (point.halfX ?? 0);
  const hy = (obs.halfY ?? 0) + (point.halfY ?? 0);
  return {
    x: clampVal(point.x, obs.x - hx, obs.x + hx),
    y: clampVal(point.y, obs.y - hy, obs.y + hy),
  };
}

export function pushPropObstacles(prop: ChunkProp, out: BlockingObstacle[]): void {
  if (!prop.blocksMovement || prop.radius <= 0) return;
  const shape = propStructureShape(prop.kind);
  if (shape) {
    out.push({
      id: prop.id,
      x: prop.x,
      y: prop.y + shape.offsetY,
      radius: shape.radius,
      halfX: shape.halfX,
      halfY: shape.halfY,
      elevation: prop.elevation,
    });
    return;
  }
  const center = propFootprintCenter(prop);
  out.push({ id: prop.id, x: center.x, y: center.y, radius: prop.radius, elevation: prop.elevation });
}

const CHUNK_OBSTACLE_CACHE = new WeakMap<WorldChunk, readonly BlockingObstacle[]>();

export function buildChunkObstacles(chunk: WorldChunk): readonly BlockingObstacle[] {
  const cached = CHUNK_OBSTACLE_CACHE.get(chunk);
  if (cached) return cached;
  const out: BlockingObstacle[] = [];
  for (const prop of chunk.props) pushPropObstacles(prop, out);
  const s = POI_CHEST_OBSTACLE_SHAPE;
  for (const poi of chunk.pois) {
    if (poi.hasChest === false) continue;
    out.push({ id: `${poi.id}:chest`, x: poi.chestX, y: poi.chestY + s.offsetY, radius: s.radius, halfX: s.halfX, halfY: s.halfY, elevation: poi.elevation });
  }
  CHUNK_OBSTACLE_CACHE.set(chunk, out);
  return out;
}
