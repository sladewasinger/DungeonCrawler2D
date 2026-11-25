/** Deterministic infinite chunk cache and continuous sliding movement collision. */
import { generateChunk } from "./chunkGenerator.js";
import { forEachFootTile, resolveDestElevation } from "./jumpPhysics.js";
import { WorldDeltaOverlay, type DepletedPropDelta, type WorldDeltaSnapshot } from "../survival/worldDeltas.js";
import type { PlacedStructureRecord } from "../survival/campBuilding.js";
import { POI_CHEST_OBSTACLE_SHAPE, buildChunkObstacles, closestObstacleCorePoint, pushPropObstacles, type BlockingObstacle } from "./propFootprints.js";
import { GroundKind, chunkKey, worldTileIndex, worldToChunkCoord, worldToLocalCoord, type ChunkPoi, type ChunkProp, type WorldChunk } from "./types.js";

export type { BlockingObstacle };

export interface TileLookup { readonly ground: GroundKind; readonly elevation: number; readonly stairs: boolean; }

export class WorldChunkCache {
  private static readonly maxCachedChunks = 96;
  private readonly chunks = new Map<string, WorldChunk>();
  private readonly deltaOverlay = new WorldDeltaOverlay();
  private lastChunkKey: string | null = null;
  private lastChunk: WorldChunk | null = null;

  constructor(readonly worldSeed: number) {}

  getChunk(cx: number, cy: number): WorldChunk {
    const key = chunkKey(cx, cy);
    if (key === this.lastChunkKey && this.lastChunk) return this.lastChunk;
    const existing = this.chunks.get(key);
    if (existing) {
      this.chunks.delete(key); this.chunks.set(key, existing);
      this.lastChunkKey = key; this.lastChunk = existing;
      return existing;
    }
    const generated = this.deltaOverlay.applyChunkDeltas(generateChunk(this.worldSeed, cx, cy));
    this.chunks.set(key, generated);
    if (this.chunks.size > WorldChunkCache.maxCachedChunks) this.deleteCachedChunk(this.chunks.keys().next().value);
    this.lastChunkKey = key; this.lastChunk = generated;
    return generated;
  }

  private deleteCachedChunk(key: string | null | undefined): void {
    if (!key) return;
    this.chunks.delete(key);
    if (this.lastChunkKey === key) { this.lastChunkKey = null; this.lastChunk = null; }
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
    if (this.propsNear === WorldChunkCache.prototype.propsNear && this.poisNear === WorldChunkCache.prototype.poisNear) {
      return this.collectNear(wx, wy, buildChunkObstacles);
    }
    const out: BlockingObstacle[] = [];
    for (const prop of this.propsNear(wx, wy)) pushPropObstacles(prop, out);
    const s = POI_CHEST_OBSTACLE_SHAPE;
    for (const poi of this.poisNear(wx, wy)) {
      out.push({
        id: `${poi.id}:chest`, x: poi.chestX, y: poi.chestY + s.offsetY,
        radius: s.radius, halfX: s.halfX, halfY: s.halfY, elevation: poi.elevation,
      });
    }
    return out;
  }

  size(): number { return this.chunks.size; }
  deltaRevision(): number { return this.deltaOverlay.revision; }
  chunkRevision(cx: number, cy: number): number { return this.deltaOverlay.chunkRevision(cx, cy); }
  worldDeltaSnapshot(): WorldDeltaSnapshot { return this.deltaOverlay.toSnapshot(); }
  setDepletedProp(delta: DepletedPropDelta): void { this.deleteCachedChunk(this.deltaOverlay.setDepletedProp(delta)); }
  restoreProp(propId: string): void { this.deleteCachedChunk(this.deltaOverlay.restoreProp(propId)); }
  addPlacedStructure(rec: PlacedStructureRecord): void { this.deleteCachedChunk(this.deltaOverlay.addStructure(rec)); }
  removePlacedStructure(id: string): void { this.deleteCachedChunk(this.deltaOverlay.removeStructure(id)); }
  applyWorldDeltaSnapshot(snap: WorldDeltaSnapshot): void { for (const k of this.deltaOverlay.replaceFromSnapshot(snap)) this.deleteCachedChunk(k); }
}

export interface MovementQuery {
  readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly dx: number; readonly dy: number; readonly radius: number;
  readonly footHalfX?: number | undefined; readonly footSegX?: number | undefined; readonly footSegY?: number | undefined;
  readonly elevation: number; readonly airborne?: boolean | undefined; readonly jumpZ?: number | undefined;
}

export interface MovementResult {
  readonly x: number; readonly y: number; readonly elevation: number; readonly elevationDrop: number;
  readonly speedMultiplier: number; readonly inWater: boolean; readonly inDeepWater: boolean;
}

interface StandCheck {
  readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly radius: number;
  readonly footSegX?: number | undefined; readonly footSegY?: number | undefined;
  readonly fromElevation: number; readonly onStairs: boolean; readonly airborne: boolean; readonly canClimbUp: boolean;
}

function tilePassable(check: StandCheck, tile: TileLookup): boolean {
  if (check.airborne) return tile.elevation <= check.fromElevation + (check.canClimbUp ? 1 : 0);
  const bridged = tile.stairs || check.onStairs;
  return bridged ? Math.abs(tile.elevation - check.fromElevation) <= 1 : tile.elevation === check.fromElevation;
}

function canStandAt(check: StandCheck): boolean {
  return forEachFootTile(check, (tx, ty) => tilePassable(check, check.cache.tileAt(tx, ty)));
}

interface Point2D { readonly x: number; readonly y: number; }
interface SubstepContext {
  readonly radius: number; readonly segX: number; readonly segY: number; readonly obstacles: readonly BlockingObstacle[];
  readonly checkBase: Omit<StandCheck, "x" | "y">; readonly prevOverlap: number;
}
const MAX_SUBSTEP_TILES = 0.08;
const PUSHOUT_ITERATIONS = 4;
const OVERLAP_EPS = 0.015;

function fallbackNormal(ref: Point2D, obs: BlockingObstacle): Point2D {
  const rx = ref.x - obs.x; const ry = ref.y - obs.y;
  const mag = Math.hypot(rx, ry);
  return mag > 1e-4 ? { x: rx / mag, y: ry / mag } : { x: 0, y: 1 };
}

function pushOutOfInnerBox(
  pos: { x: number; y: number }, ref: Point2D,
  opts: { readonly obs: BlockingObstacle; readonly segX: number; readonly segY: number; readonly minDist: number },
): void {
  const hx = (opts.obs.halfX ?? 0) + Math.abs(opts.segX); const hy = (opts.obs.halfY ?? 0) + Math.abs(opts.segY);
  if (hx <= 0 && hy <= 0) {
    const dir = fallbackNormal(ref, opts.obs);
    pos.x = opts.obs.x + dir.x * opts.minDist; pos.y = opts.obs.y + dir.y * opts.minDist;
    return;
  }
  const dx = pos.x - opts.obs.x; const dy = pos.y - opts.obs.y;
  const sx = dx < 0 ? -1 : 1; const sy = dy < 0 ? -1 : 1;
  if (hx - Math.abs(dx) < hy - Math.abs(dy)) pos.x = opts.obs.x + sx * (hx + opts.minDist);
  else pos.y = opts.obs.y + sy * (hy + opts.minDist);
}

function resolveSingleObstacle(
  pos: { x: number; y: number }, ref: Point2D,
  opts: { readonly radius: number; readonly segX: number; readonly segY: number; readonly obs: BlockingObstacle },
): boolean {
  const core = closestObstacleCorePoint(opts.obs, { x: pos.x, y: pos.y, segX: opts.segX, segY: opts.segY });
  const vx = pos.x - core.x; const vy = pos.y - core.y;
  const minDist = opts.radius + opts.obs.radius;
  const distSq = vx * vx + vy * vy;
  if (distSq >= minDist * minDist) return false;
  if (distSq <= 1e-8) { pushOutOfInnerBox(pos, ref, { obs: opts.obs, segX: opts.segX, segY: opts.segY, minDist }); return true; }
  const dist = Math.sqrt(distSq);
  pos.x = core.x + (vx / dist) * minDist; pos.y = core.y + (vy / dist) * minDist;
  return true;
}

function pushOutOfObstacles(input: {
  readonly pos: Point2D; readonly ref: Point2D;
  readonly radius: number; readonly segX: number; readonly segY: number; readonly obstacles: readonly BlockingObstacle[];
}): Point2D {
  const out = { x: input.pos.x, y: input.pos.y };
  for (let pass = 0; pass < PUSHOUT_ITERATIONS; pass++) {
    let moved = false;
    for (const obs of input.obstacles) {
      moved = resolveSingleObstacle(out, input.ref, { radius: input.radius, segX: input.segX, segY: input.segY, obs }) || moved;
    }
    if (!moved) break;
  }
  return out;
}

function maxObstacleOverlap(
  pos: Point2D,
  opts: { readonly radius: number; readonly segX: number; readonly segY: number; readonly obstacles: readonly BlockingObstacle[] },
): number {
  let worst = 0;
  for (const obs of opts.obstacles) {
    const core = closestObstacleCorePoint(obs, { x: pos.x, y: pos.y, segX: opts.segX, segY: opts.segY });
    const overlap = opts.radius + obs.radius - Math.hypot(pos.x - core.x, pos.y - core.y);
    if (overlap > worst) worst = overlap;
  }
  return worst;
}

function acceptCandidate(cand: Point2D, cur: Point2D, ctx: SubstepContext): Point2D | null {
  const pushed = pushOutOfObstacles({ pos: cand, ref: cur, radius: ctx.radius, segX: ctx.segX, segY: ctx.segY, obstacles: ctx.obstacles });
  if (!canStandAt({ ...ctx.checkBase, x: pushed.x, y: pushed.y })) return null;
  const nextOverlap = maxObstacleOverlap(pushed, ctx);
  return nextOverlap <= OVERLAP_EPS || nextOverlap < ctx.prevOverlap - 1e-4 ? pushed : null;
}

function axisMovedPos(cur: Point2D, delta: Point2D, checkBase: Omit<StandCheck, "x" | "y">): Point2D {
  const nx = canStandAt({ ...checkBase, x: cur.x + delta.x, y: cur.y }) ? cur.x + delta.x : cur.x;
  const ny = canStandAt({ ...checkBase, x: nx, y: cur.y + delta.y }) ? cur.y + delta.y : cur.y;
  return { x: nx, y: ny };
}

function advanceSubstep(cur: Point2D, delta: Point2D, ctx: Omit<SubstepContext, "prevOverlap">): Point2D {
  const sctx: SubstepContext = { ...ctx, prevOverlap: maxObstacleOverlap(cur, ctx) };
  const candidates = [axisMovedPos(cur, delta, ctx.checkBase), { x: cur.x + delta.x, y: cur.y }, { x: cur.x, y: cur.y + delta.y }];
  for (const cand of candidates) {
    if (!canStandAt({ ...ctx.checkBase, ...cand })) continue;
    const ok = acceptCandidate(cand, cur, sctx);
    if (ok) return ok;
  }
  return cur;
}

const resolveFootSeg = (q: MovementQuery) => ({ segX: q.footSegX ?? q.footHalfX ?? 0, segY: q.footSegY ?? 0 });

export function resolveMovement(query: MovementQuery): MovementResult {
  const { cache, dx, dy, radius, elevation } = query;
  const { segX, segY } = resolveFootSeg(query);
  const airborne = Boolean(query.airborne);
  const onStairs = cache.tileAt(Math.floor(query.x), Math.floor(query.y)).stairs;
  const checkBase = { cache, radius, footSegX: segX, footSegY: segY, fromElevation: elevation, onStairs, airborne, canClimbUp: (query.jumpZ ?? 0) >= 0.42 };
  const range = Math.hypot(dx, dy) + radius + Math.max(Math.abs(segX), Math.abs(segY)) + 3.5;
  const obstacles = cache.blockingObstaclesNear(query.x, query.y).filter(
    (obs) => Math.abs(obs.x - query.x) <= range && Math.abs(obs.y - query.y) <= range,
  );
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_SUBSTEP_TILES));
  const delta = { x: dx / steps, y: dy / steps };
  let cur: Point2D = { x: query.x, y: query.y };
  for (let i = 0; i < steps; i++) cur = advanceSubstep(cur, delta, { radius, segX, segY, obstacles, checkBase });
  const destTile = cache.tileAt(Math.floor(cur.x), Math.floor(cur.y));
  const { nextElevation, elevationDrop } = resolveDestElevation((tx, ty) => cache.tileAt(tx, ty).elevation, {
    x: cur.x, y: cur.y, radius, footSegX: segX, footSegY: segY, elevation, airborne, stairs: destTile.stairs,
  });
  const inDeepWater = destTile.ground === GroundKind.DeepWater;
  const inWater = inDeepWater || destTile.ground === GroundKind.ShallowWater;
  const speedMultiplier = inDeepWater ? 0.56 : inWater ? 0.78 : 1;
  return { x: cur.x, y: cur.y, elevation: nextElevation, elevationDrop, speedMultiplier, inWater, inDeepWater };
}
