/** Deterministic infinite chunk cache and continuous sliding movement collision. */
import { generateChunk } from "./chunkGenerator.js";
import { forEachFootTile, resolveDestElevation } from "./jumpPhysics.js";
import {
  GroundKind, PropKind, chunkKey, worldTileIndex, worldToChunkCoord, worldToLocalCoord,
  type ChunkPoi, type ChunkProp, type WorldChunk,
} from "./types.js";

export interface TileLookup {
  readonly ground: GroundKind;
  readonly elevation: number;
  readonly stairs: boolean;
}

export interface BlockingObstacle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function pushPropObstacles(prop: ChunkProp, out: BlockingObstacle[]): void {
  if (!prop.blocksMovement || prop.radius <= 0) return;
  if (prop.kind !== PropKind.Tent) {
    out.push({ id: prop.id, x: prop.x, y: prop.y, radius: prop.radius });
    return;
  }
  out.push(
    { id: `${prop.id}:l`, x: prop.x - 0.36, y: prop.y - 0.24, radius: 0.56 },
    { id: `${prop.id}:r`, x: prop.x + 0.36, y: prop.y - 0.24, radius: 0.56 },
  );
}

export class WorldChunkCache {
  private static readonly maxCachedChunks = 96;
  private readonly chunks = new Map<string, WorldChunk>();

  constructor(readonly worldSeed: number) {}

  getChunk(cx: number, cy: number): WorldChunk {
    const key = chunkKey(cx, cy);
    const existing = this.chunks.get(key);
    if (existing) {
      this.chunks.delete(key);
      this.chunks.set(key, existing);
      return existing;
    }
    const generated = generateChunk(this.worldSeed, cx, cy);
    this.chunks.set(key, generated);
    if (this.chunks.size > WorldChunkCache.maxCachedChunks) {
      const oldestKey = this.chunks.keys().next().value;
      if (oldestKey !== undefined) this.chunks.delete(oldestKey);
    }
    return generated;
  }

  tileAt(wx: number, wy: number): TileLookup {
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    const cx = worldToChunkCoord(tx);
    const cy = worldToChunkCoord(ty);
    const chunk = this.getChunk(cx, cy);
    const idx = worldTileIndex(worldToLocalCoord(tx, cx), worldToLocalCoord(ty, cy));
    return {
      ground: (chunk.ground[idx] ?? GroundKind.Grass) as GroundKind,
      elevation: chunk.elevation[idx] ?? 0,
      stairs: (chunk.stairs[idx] ?? 0) === 1,
    };
  }

  private collectNear<T>(wx: number, wy: number, pick: (c: WorldChunk) => readonly T[]): readonly T[] {
    const cx = worldToChunkCoord(Math.floor(wx));
    const cy = worldToChunkCoord(Math.floor(wy));
    const out: T[] = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) out.push(...pick(this.getChunk(cx + ox, cy + oy)));
    }
    return out;
  }

  propsNear(wx: number, wy: number): readonly ChunkProp[] {
    return this.collectNear(wx, wy, (c) => c.props);
  }

  poisNear(wx: number, wy: number): readonly ChunkPoi[] {
    return this.collectNear(wx, wy, (c) => c.pois);
  }

  blockingObstaclesNear(wx: number, wy: number): readonly BlockingObstacle[] {
    const out: BlockingObstacle[] = [];
    for (const prop of this.propsNear(wx, wy)) pushPropObstacles(prop, out);
    for (const poi of this.poisNear(wx, wy)) {
      out.push({ id: `${poi.id}:chest`, x: poi.chestX, y: poi.chestY - 0.14, radius: 0.46 });
    }
    return out;
  }

  size(): number {
    return this.chunks.size;
  }
}

export interface MovementQuery {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly radius: number;
  readonly elevation: number;
  readonly airborne?: boolean | undefined;
  readonly jumpZ?: number | undefined;
}

export interface MovementResult {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly elevationDrop: number;
  readonly speedMultiplier: number;
  readonly inWater: boolean;
}

interface StandCheck {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly fromElevation: number;
  readonly onStairs: boolean;
  readonly airborne: boolean;
  readonly canClimbUp: boolean;
}

function tilePassable(check: StandCheck, tile: TileLookup): boolean {
  if (tile.ground === GroundKind.DeepWater) return false;
  if (check.airborne) return tile.elevation <= check.fromElevation + (check.canClimbUp ? 1 : 0);
  const bridged = tile.stairs || check.onStairs;
  return bridged ? Math.abs(tile.elevation - check.fromElevation) <= 1 : tile.elevation === check.fromElevation;
}

function canStandAt(check: StandCheck): boolean {
  return forEachFootTile(check, (tx, ty) => tilePassable(check, check.cache.tileAt(tx, ty)));
}

interface Point2D { readonly x: number; readonly y: number; }
interface SubstepContext {
  readonly radius: number; readonly obstacles: readonly BlockingObstacle[];
  readonly checkBase: Omit<StandCheck, "x" | "y">; readonly prevOverlap: number;
}
const MAX_SUBSTEP_TILES = 0.08;
const PUSHOUT_ITERATIONS = 4;
const OVERLAP_EPS = 0.015;

function fallbackNormal(ref: Point2D, obs: BlockingObstacle): Point2D {
  const rx = ref.x - obs.x;
  const ry = ref.y - obs.y;
  const mag = Math.hypot(rx, ry);
  return mag > 1e-4 ? { x: rx / mag, y: ry / mag } : { x: 0, y: 1 };
}

function resolveSingleObstacle(
  pos: { x: number; y: number },
  ref: Point2D,
  opts: { readonly radius: number; readonly obs: BlockingObstacle },
): boolean {
  const vx = pos.x - opts.obs.x;
  const vy = pos.y - opts.obs.y;
  const minDist = opts.radius + opts.obs.radius;
  const distSq = vx * vx + vy * vy;
  if (distSq >= minDist * minDist) return false;
  const dir = distSq > 1e-8 ? { x: vx / Math.sqrt(distSq), y: vy / Math.sqrt(distSq) } : fallbackNormal(ref, opts.obs);
  pos.x = opts.obs.x + dir.x * minDist;
  pos.y = opts.obs.y + dir.y * minDist;
  return true;
}

function pushPass(
  out: { x: number; y: number },
  ref: Point2D,
  opts: { readonly radius: number; readonly obstacles: readonly BlockingObstacle[] },
): boolean {
  let moved = false;
  for (const obs of opts.obstacles) {
    moved = resolveSingleObstacle(out, ref, { radius: opts.radius, obs }) || moved;
  }
  return moved;
}

function pushOutOfObstacles(input: {
  readonly pos: Point2D; readonly ref: Point2D; readonly radius: number; readonly obstacles: readonly BlockingObstacle[];
}): Point2D {
  const out = { x: input.pos.x, y: input.pos.y };
  for (let pass = 0; pass < PUSHOUT_ITERATIONS; pass++) {
    if (!pushPass(out, input.ref, input)) break;
  }
  return out;
}

function maxObstacleOverlap(pos: Point2D, radius: number, obstacles: readonly BlockingObstacle[]): number {
  let worst = 0;
  for (const obs of obstacles) {
    const overlap = radius + obs.radius - Math.hypot(pos.x - obs.x, pos.y - obs.y);
    if (overlap > worst) worst = overlap;
  }
  return worst;
}

function acceptCandidate(cand: Point2D, cur: Point2D, ctx: SubstepContext): Point2D | null {
  const pushed = pushOutOfObstacles({ pos: cand, ref: cur, radius: ctx.radius, obstacles: ctx.obstacles });
  if (!canStandAt({ ...ctx.checkBase, x: pushed.x, y: pushed.y })) return null;
  const nextOverlap = maxObstacleOverlap(pushed, ctx.radius, ctx.obstacles);
  return nextOverlap <= OVERLAP_EPS || nextOverlap < ctx.prevOverlap - 1e-4 ? pushed : null;
}

function axisMovedPos(cur: Point2D, delta: Point2D, checkBase: Omit<StandCheck, "x" | "y">): Point2D {
  const nx = canStandAt({ ...checkBase, x: cur.x + delta.x, y: cur.y }) ? cur.x + delta.x : cur.x;
  const ny = canStandAt({ ...checkBase, x: nx, y: cur.y + delta.y }) ? cur.y + delta.y : cur.y;
  return { x: nx, y: ny };
}

function advanceSubstep(cur: Point2D, delta: Point2D, ctx: Omit<SubstepContext, "prevOverlap">): Point2D {
  const sctx: SubstepContext = { ...ctx, prevOverlap: maxObstacleOverlap(cur, ctx.radius, ctx.obstacles) };
  const candidates = [
    axisMovedPos(cur, delta, ctx.checkBase),
    { x: cur.x + delta.x, y: cur.y },
    { x: cur.x, y: cur.y + delta.y },
  ];
  for (const cand of candidates) {
    if (!canStandAt({ ...ctx.checkBase, ...cand })) continue;
    const ok = acceptCandidate(cand, cur, sctx);
    if (ok) return ok;
  }
  return cur;
}

export function resolveMovement(query: MovementQuery): MovementResult {
  const { cache, dx, dy, radius, elevation } = query;
  const airborne = Boolean(query.airborne);
  const onStairs = cache.tileAt(Math.floor(query.x), Math.floor(query.y)).stairs;
  const checkBase = { cache, radius, fromElevation: elevation, onStairs, airborne, canClimbUp: (query.jumpZ ?? 0) >= 0.42 };
  const obstacles = cache.blockingObstaclesNear(query.x, query.y);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_SUBSTEP_TILES));
  const delta = { x: dx / steps, y: dy / steps };
  let cur: Point2D = { x: query.x, y: query.y };
  for (let i = 0; i < steps; i++) cur = advanceSubstep(cur, delta, { radius, obstacles, checkBase });
  const destTile = cache.tileAt(Math.floor(cur.x), Math.floor(cur.y));
  const { nextElevation, elevationDrop } = resolveDestElevation((tx, ty) => cache.tileAt(tx, ty).elevation, {
    x: cur.x, y: cur.y, radius, elevation, airborne, stairs: destTile.stairs,
  });
  const inWater = destTile.ground === GroundKind.ShallowWater;
  return { x: cur.x, y: cur.y, elevation: nextElevation, elevationDrop, speedMultiplier: inWater ? 0.65 : 1, inWater };
}
