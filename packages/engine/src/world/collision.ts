/** Deterministic infinite chunk cache and continuous sliding movement collision. */
import { clamp } from "../math/noise.js";
import { generateChunk } from "./chunkGenerator.js";
import {
  GroundKind,
  chunkKey,
  worldTileIndex,
  worldToChunkCoord,
  worldToLocalCoord,
  type ChunkProp,
  type WorldChunk,
} from "./types.js";

export interface TileLookup {
  readonly ground: GroundKind;
  readonly elevation: number;
  readonly stairs: boolean;
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
    const cx = worldToChunkCoord(wx);
    const cy = worldToChunkCoord(wy);
    const chunk = this.getChunk(cx, cy);
    const idx = worldTileIndex(worldToLocalCoord(wx, cx), worldToLocalCoord(wy, cy));
    return {
      ground: (chunk.ground[idx] ?? GroundKind.Grass) as GroundKind,
      elevation: chunk.elevation[idx] ?? 0,
      stairs: (chunk.stairs[idx] ?? 0) === 1,
    };
  }

  propsNear(wx: number, wy: number): readonly ChunkProp[] {
    const cx = worldToChunkCoord(Math.floor(wx));
    const cy = worldToChunkCoord(Math.floor(wy));
    const out: ChunkProp[] = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) out.push(...this.getChunk(cx + ox, cy + oy).props);
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
}

function tilePassable(check: StandCheck, tile: TileLookup): boolean {
  if (tile.ground === GroundKind.DeepWater) return false;
  if (check.airborne) return tile.elevation <= check.fromElevation;
  const bridged = tile.stairs || check.onStairs;
  return bridged ? Math.abs(tile.elevation - check.fromElevation) <= 1 : tile.elevation === check.fromElevation;
}

function rowPassable(check: StandCheck, ty: number, bounds: { minTx: number; maxTx: number }): boolean {
  for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
    if (!tilePassable(check, check.cache.tileAt(tx, ty))) return false;
  }
  return true;
}

function canStandAt(check: StandCheck): boolean {
  const footDepth = Math.min(check.radius, 0.14);
  const minTx = Math.floor(check.x - check.radius);
  const maxTx = Math.floor(check.x + check.radius);
  const minTy = Math.floor(check.y - footDepth);
  const maxTy = Math.floor(check.y + footDepth);
  for (let ty = minTy; ty <= maxTy; ty++) {
    if (!rowPassable(check, ty, { minTx, maxTx })) return false;
  }
  return true;
}

function maxRowElevation(cache: WorldChunkCache, ty: number, bounds: { minTx: number; maxTx: number }): number {
  let highest = 0;
  for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
    highest = Math.max(highest, cache.tileAt(tx, ty).elevation);
  }
  return highest;
}

function maxElevationUnderFeet(cache: WorldChunkCache, pos: { readonly x: number; readonly y: number; readonly radius: number }): number {
  const footDepth = Math.min(pos.radius, 0.14);
  const minTx = Math.floor(pos.x - pos.radius);
  const maxTx = Math.floor(pos.x + pos.radius);
  const minTy = Math.floor(pos.y - footDepth);
  const maxTy = Math.floor(pos.y + footDepth);
  let highest = 0;
  for (let ty = minTy; ty <= maxTy; ty++) {
    highest = Math.max(highest, maxRowElevation(cache, ty, { minTx, maxTx }));
  }
  return highest;
}

function resolveDestElevation(
  cache: WorldChunkCache,
  dest: {
    readonly x: number; readonly y: number; readonly radius: number;
    readonly elevation: number; readonly airborne: boolean; readonly stairs: boolean;
  },
): { readonly nextElevation: number; readonly elevationDrop: number } {
  if (dest.stairs) return { nextElevation: dest.elevation, elevationDrop: 0 };
  if (!dest.airborne) {
    return { nextElevation: clamp(cache.tileAt(Math.floor(dest.x), Math.floor(dest.y)).elevation, 0, 2), elevationDrop: 0 };
  }
  const support = clamp(maxElevationUnderFeet(cache, dest), 0, 2);
  if (support < dest.elevation) return { nextElevation: support, elevationDrop: dest.elevation - support };
  return { nextElevation: dest.elevation, elevationDrop: 0 };
}

function pushOutOfProps(input: {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly props: readonly ChunkProp[];
}): { x: number; y: number } {
  let { x, y } = input;
  for (const prop of input.props) {
    if (!prop.blocksMovement || prop.radius <= 0) continue;
    const vx = x - prop.x;
    const vy = y - prop.y;
    const minDist = input.radius + prop.radius;
    const distSq = vx * vx + vy * vy;
    if (distSq >= minDist * minDist || distSq <= 1e-8) continue;
    const dist = Math.sqrt(distSq);
    const push = minDist - dist;
    x += (vx / dist) * push;
    y += (vy / dist) * push;
  }
  return { x, y };
}

export function resolveMovement(query: MovementQuery): MovementResult {
  const { cache, dx, dy, radius, elevation } = query;
  const airborne = Boolean(query.airborne);
  const onStairs = cache.tileAt(Math.floor(query.x), Math.floor(query.y)).stairs;
  const checkBase = { cache, radius, fromElevation: elevation, onStairs, airborne };
  let { x, y } = query;
  if (canStandAt({ ...checkBase, x: x + dx, y })) x += dx;
  if (canStandAt({ ...checkBase, x, y: y + dy })) y += dy;
  const pushed = pushOutOfProps({ x, y, radius, props: cache.propsNear(x, y) });
  if (canStandAt({ ...checkBase, x: pushed.x, y: pushed.y })) {
    x = pushed.x;
    y = pushed.y;
  }
  const destTile = cache.tileAt(Math.floor(x), Math.floor(y));
  const { nextElevation, elevationDrop } = resolveDestElevation(cache, {
    x, y, radius, elevation, airborne, stairs: destTile.stairs,
  });
  const inWater = destTile.ground === GroundKind.ShallowWater;
  return { x, y, elevation: nextElevation, elevationDrop, speedMultiplier: inWater ? 0.65 : 1, inWater };
}
